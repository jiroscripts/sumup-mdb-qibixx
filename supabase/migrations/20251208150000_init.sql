-- Full Production-Ready Migration with Safety, Idempotency, Checks, and Improved Security
-- Includes: safer defaults, idempotency, concurrency-safe triggers, RLS, RPCs, enums/checks

-- 0. Enable Extensions
create extension if not exists pgcrypto with schema extensions;

-- 1. Cleanup old objects
DROP FUNCTION IF EXISTS public.handle_balance_update() CASCADE;
DROP FUNCTION IF EXISTS public.process_vend_payment(uuid, uuid, text) CASCADE;
DROP FUNCTION IF EXISTS public.create_vend_session(numeric, text) CASCADE;
DROP FUNCTION IF EXISTS public._ensure_wallet_for_user(uuid) CASCADE;

DROP TABLE IF EXISTS public.vend_sessions CASCADE;
DROP TABLE IF EXISTS public.transactions CASCADE;
DROP TABLE IF EXISTS public.wallets CASCADE;

-- 2. Create Tables

CREATE TABLE public.wallets (
  user_id uuid PRIMARY KEY REFERENCES auth.users,
  balance numeric(12,2) NOT NULL DEFAULT 0.00,
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  user_id uuid NOT NULL REFERENCES auth.users,
  amount numeric(12,2) NOT NULL,
  type text NOT NULL CHECK (type IN ('RECHARGE', 'VEND')),
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'COMPLETED', 'FAILED')),
  description text,
  metadata jsonb,
  idempotency_key text,
  CONSTRAINT ux_transactions_idempotency_key UNIQUE (idempotency_key) DEFERRABLE INITIALLY IMMEDIATE
);

CREATE TABLE public.vend_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  amount numeric(12,2) NOT NULL,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PAID', 'COMPLETED', 'FAILED', 'CANCELLED')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

-- 3. Enable RLS
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vend_sessions ENABLE ROW LEVEL SECURITY;

-- 4. Policies

-- Wallets
-- Wallets
CREATE POLICY wallets_select_own
ON public.wallets FOR SELECT TO authenticated
USING ((select auth.uid()) = user_id);

-- Transactions
CREATE POLICY transactions_select_own
ON public.transactions FOR SELECT TO authenticated
USING ((select auth.uid()) = user_id);

-- Vend Sessions
CREATE POLICY vend_sessions_select_all_authenticated
ON public.vend_sessions FOR SELECT TO authenticated
USING (true);

CREATE POLICY vend_sessions_select_public_recent_pending
ON public.vend_sessions FOR SELECT TO anon
USING (status = 'PENDING' AND created_at > (now() - interval '30 minutes'));



-- 5. Helper Functions

CREATE OR REPLACE FUNCTION public._ensure_wallet_for_user(p_user uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.wallets (user_id, balance) VALUES (p_user, 0.00)
  ON CONFLICT (user_id) DO NOTHING;
END;
$$;

-- 6. Trigger: Balance Update

CREATE OR REPLACE FUNCTION public.handle_balance_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_balance numeric(12,2);
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.status = 'COMPLETED') OR
     (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM 'COMPLETED' AND NEW.status = 'COMPLETED') THEN

    PERFORM public._ensure_wallet_for_user(NEW.user_id);

    SELECT balance INTO v_balance
    FROM public.wallets
    WHERE user_id = NEW.user_id
    FOR UPDATE;

    UPDATE public.wallets
    SET balance = balance + NEW.amount,
        updated_at = timezone('utc', now())
    WHERE user_id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$;

-- 7. RPC: Process Vend Payment (idempotent)

CREATE OR REPLACE FUNCTION public.process_vend_payment(
  p_session_id uuid,
  p_user_id uuid,
  p_idempotency_key text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_amount numeric;
  v_status text;
  v_metadata jsonb;
  v_balance numeric;
  v_tx_id uuid;
BEGIN
  -- Check idempotency
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id, metadata INTO v_tx_id, v_metadata
    FROM public.transactions
    WHERE idempotency_key = p_idempotency_key;

    IF v_tx_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'success', true,
        'new_balance', (v_metadata::jsonb->>'new_balance')::numeric
      );
    END IF;
  END IF;

  -- Lock session
  SELECT amount, status, metadata INTO v_amount, v_status, v_metadata
  FROM public.vend_sessions
  WHERE id = p_session_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Session invalid'; END IF;
  IF v_status <> 'PENDING' THEN RAISE EXCEPTION 'Session already used'; END IF;

  -- Ensure wallet
  PERFORM public._ensure_wallet_for_user(p_user_id);

  SELECT balance INTO v_balance
  FROM public.wallets
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF v_balance < v_amount THEN RAISE EXCEPTION 'Insufficient funds'; END IF;

  -- Insert transaction
  INSERT INTO public.transactions (user_id, amount, type, status, description, metadata, idempotency_key)
  VALUES (
    p_user_id,
    -v_amount,
    'VEND',
    'COMPLETED',
    'Coffee Purchase',
    jsonb_build_object('session_id', p_session_id),
    p_idempotency_key
  ) RETURNING id INTO v_tx_id;

  -- Update session
  UPDATE public.vend_sessions
  SET status = 'PAID',
      metadata = v_metadata || jsonb_build_object('paid_by', p_user_id, 'paid_at', now())
  WHERE id = p_session_id;

  -- Get new balance
  SELECT balance INTO v_balance
  FROM public.wallets WHERE user_id = p_user_id;

  -- Store new balance inside metadata for idempotency replay
  UPDATE public.transactions
  SET metadata = metadata || jsonb_build_object('new_balance', v_balance)
  WHERE id = v_tx_id;

  RETURN jsonb_build_object('success', true, 'new_balance', v_balance);
END;
$$;

-- 8. RPC: Create Vend Session

CREATE OR REPLACE FUNCTION public.create_vend_session(
  p_amount numeric,
  p_machine_id text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_new_id uuid;
  v_user_role text;
BEGIN
  SELECT auth.jwt() -> 'app_metadata' ->> 'app_role' INTO v_user_role;

  IF current_user <> 'service_role' AND (v_user_role IS NULL OR v_user_role <> 'bridge') THEN
    RAISE EXCEPTION 'Access denied: Only bridge/service can create sessions.';
  END IF;

  UPDATE public.vend_sessions
  SET status = 'CANCELLED'
  WHERE (metadata->>'machine_id') = p_machine_id AND status = 'PENDING';

  INSERT INTO public.vend_sessions (amount, status, metadata)
  VALUES (p_amount, 'PENDING', jsonb_build_object('machine_id', p_machine_id))
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;

-- 9. Triggers

CREATE TRIGGER on_transaction_created
AFTER INSERT ON public.transactions
FOR EACH ROW WHEN (NEW.status = 'COMPLETED')
EXECUTE PROCEDURE public.handle_balance_update();

CREATE TRIGGER on_transaction_completed_update
AFTER UPDATE ON public.transactions
FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM 'COMPLETED' AND NEW.status = 'COMPLETED')
EXECUTE PROCEDURE public.handle_balance_update();

-- 10. Grants

GRANT SELECT ON public.vend_sessions TO anon;
GRANT SELECT ON public.vend_sessions TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.vend_sessions TO service_role;

GRANT SELECT ON public.transactions TO authenticated;
GRANT SELECT ON public.wallets TO authenticated;

GRANT EXECUTE ON FUNCTION public.process_vend_payment(uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_vend_session(numeric, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_vend_session(numeric, text) TO authenticated;

-- 11. Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.vend_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.wallets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;
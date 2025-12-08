-- Consolidated Schema Migration
-- Generated: 2025-12-08
-- Description: Full schema setup including Tables, RLS, Functions, and Triggers.

-- 0. Enable Extensions
create extension if not exists pgcrypto with schema extensions;

-- 1. Clean up old objects (Safety check)
drop table if exists public.vend_requests cascade;
drop table if exists public.vend_sessions cascade;
drop table if exists public.transactions cascade;
drop table if exists public.wallets cascade;
drop function if exists public.handle_new_transaction() cascade;
drop function if exists public.handle_transaction_update() cascade;
drop function if exists public.handle_balance_update() cascade;
drop function if exists public.process_vend_payment(uuid, uuid) cascade;
drop function if exists public.create_vend_session(numeric, text) cascade;

-- 2. Create Tables

-- Wallets (The State)
create table public.wallets (
  user_id uuid references auth.users primary key,
  balance numeric default 0.00 not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Transactions (The Ledger)
create table public.transactions (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  user_id uuid references auth.users not null,
  amount numeric not null,
  type text not null, -- 'RECHARGE' or 'VEND'
  status text default 'COMPLETED', -- PENDING, COMPLETED, FAILED
  description text,
  metadata jsonb -- For storing checkout_id, etc.
);

-- Vend Sessions (The Machine State)
create table public.vend_sessions (
    id uuid default gen_random_uuid() primary key,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    amount numeric not null,
    status text default 'PENDING', -- PENDING, PAID, COMPLETED, FAILED, CANCELLED
    metadata jsonb default '{}'::jsonb
);

-- 3. Enable Security (RLS)
alter table public.transactions enable row level security;
alter table public.wallets enable row level security;
alter table public.vend_sessions enable row level security;

-- 4. Policies

-- Transactions: "I can only see my own data"
create policy "Users can view own transactions"
on public.transactions for select
to authenticated
using (auth.uid() = user_id);

-- Wallets: "I can only see my own wallet"
create policy "Users can view own wallet"
on public.wallets for select
to authenticated
using (auth.uid() = user_id);

-- Vend Sessions: Security Policies
-- A. READ (SELECT)
-- 1. Authenticated Users (Kiosks & Logged-in Users)
-- Any authenticated user (including Kiosk) can see ALL sessions.
create policy "Authenticated users can view all sessions"
on public.vend_sessions for select
to authenticated
using (true);

-- 2. Public (Unauthenticated)
-- Can ONLY see PENDING sessions (for payment page).
create policy "Public can view pending sessions"
on public.vend_sessions for select
using (status = 'PENDING');

-- B. WRITE (INSERT/UPDATE)
-- Only Service Role can write. No policies for anon/authenticated.

-- 5. Functions

-- Function: Handle Balance Update (Trigger)
create or replace function public.handle_balance_update() 
returns trigger as $$
begin
  -- Credit/Debit Wallet only if status is COMPLETED
  if new.status = 'COMPLETED' then
      insert into public.wallets (user_id, balance)
      values (new.user_id, new.amount)
      on conflict (user_id) do update
      set balance = wallets.balance + new.amount,
          updated_at = now();
  end if;
  return new;
end;
$$ language plpgsql security definer;

-- Function: Process Vend Payment (Atomic RPC)
create or replace function public.process_vend_payment(
  p_session_id uuid,
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_amount numeric;
  v_balance numeric;
  v_session_status text;
  v_session_metadata jsonb;
begin
  -- 1. Lock and check Session
  select amount, status, metadata into v_amount, v_session_status, v_session_metadata
  from public.vend_sessions
  where id = p_session_id
  for update;

  if not found then
    raise exception 'Session invalid';
  end if;

  if v_session_status != 'PENDING' then
    raise exception 'Session already processed';
  end if;

  -- 2. Check Balance
  select balance into v_balance
  from public.wallets
  where user_id = p_user_id;

  if v_balance is null or v_balance < v_amount then
    raise exception 'Insufficient funds';
  end if;

  -- 3. Insert Transaction (Debit)
  insert into public.transactions (user_id, amount, type, status, description, metadata)
  values (
    p_user_id,
    -v_amount,
    'VEND',
    'COMPLETED',
    'Coffee Purchase',
    jsonb_build_object('source', 'web_wallet', 'session_id', p_session_id)
  );

  -- 4. Update Session
  update public.vend_sessions
  set status = 'PAID',
      metadata = coalesce(v_session_metadata, '{}'::jsonb) || jsonb_build_object('paid_by', p_user_id)
  where id = p_session_id;

  -- 5. Get new balance
  select balance into v_balance
  from public.wallets
  where user_id = p_user_id;

  return jsonb_build_object('success', true, 'new_balance', v_balance);
end;
$$;

-- Function: Create Vend Session (Atomic RPC)
CREATE OR REPLACE FUNCTION public.create_vend_session(
    p_amount numeric,
    p_machine_id text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_new_id uuid;
BEGIN
    -- 1. Cancel any existing PENDING sessions for this machine
    UPDATE public.vend_sessions
    SET status = 'CANCELLED'
    WHERE metadata->>'machine_id' = p_machine_id
    AND status = 'PENDING';

    -- 2. Create the new session
    INSERT INTO public.vend_sessions (amount, status, metadata)
    VALUES (p_amount, 'PENDING', jsonb_build_object('machine_id', p_machine_id))
    RETURNING id INTO v_new_id;

    RETURN v_new_id;
END;
$$;

-- 6. Triggers

-- Trigger for NEW transactions
create trigger on_transaction_created
after insert on public.transactions
for each row execute procedure public.handle_balance_update();

-- Trigger for UPDATED transactions
create trigger on_transaction_updated
after update on public.transactions
for each row 
when (old.status != 'COMPLETED' and new.status = 'COMPLETED')
execute procedure public.handle_balance_update();

-- 7. Grants
grant select on public.vend_sessions to anon;
grant select on public.vend_sessions to authenticated;
grant insert, update, delete on public.vend_sessions to service_role;

grant execute on function public.process_vend_payment(uuid, uuid) to service_role;
grant execute on function public.create_vend_session(numeric, text) to service_role;
grant execute on function public.create_vend_session(numeric, text) to authenticated;

-- 8. Enable Realtime
alter publication supabase_realtime add table public.vend_sessions;
alter publication supabase_realtime add table public.wallets;

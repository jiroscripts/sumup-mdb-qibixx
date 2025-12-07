-- Function to handle atomic payment processing
-- This combines balance check, debit, and session update in a single transaction.

create or replace function public.process_vend_payment(
  p_session_id uuid,
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer -- Run with privileges of the creator to ensure access to tables
as $$
declare
  v_amount numeric;
  v_balance numeric;
  v_session_status text;
  v_session_metadata jsonb;
begin
  -- 1. Lock and check Session
  -- FOR UPDATE ensures no one else can modify this row while we are processing
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
  -- This will trigger handle_balance_update which updates the wallet
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

-- Grant execute permission to service_role (used by Edge Functions)
grant execute on function public.process_vend_payment(uuid, uuid) to service_role;

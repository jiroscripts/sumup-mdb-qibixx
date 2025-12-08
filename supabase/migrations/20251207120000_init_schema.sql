-- ⚠️ DANGER: This will delete all wallet data!

-- 0. Enable Extensions
create extension if not exists pgcrypto with schema extensions;

-- 1. Clean up old objects
-- We use CASCADE to automatically remove dependent triggers, views, and foreign keys.
drop table if exists public.vend_requests cascade;
drop table if exists public.vend_sessions cascade;
drop table if exists public.transactions cascade;
drop table if exists public.wallets cascade;

-- Drop functions if they are not attached to tables (though CASCADE on tables usually handles triggers, functions might remain)
drop function if exists public.handle_new_transaction() cascade;
drop function if exists public.handle_transaction_update() cascade;
drop function if exists public.handle_balance_update() cascade;
drop view if exists public.user_balances cascade;

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
    status text default 'PENDING', -- PENDING, PAID, COMPLETED, FAILED
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
-- 1. READ: Everyone can read sessions (Kiosk needs to listen, App needs to check status)
create policy "Enable read access for all users"
on public.vend_sessions for select
using (true);

-- 2. INSERT: BLOCKED for public!
-- Only Service Role (MDB Bridge) can create sessions.
-- We simply DO NOT create a policy allowing INSERT for anon/authenticated.

-- 3. UPDATE: BLOCKED for public!
-- Only Service Role (Backend/Edge Functions) can update sessions.

-- 5. Grants
-- We grant SELECT only to anon/authenticated.
grant select on public.vend_sessions to anon;
grant select on public.vend_sessions to authenticated;
grant insert, update, delete on public.vend_sessions to service_role;

-- 6. Logic: Auto-update Wallet Balance

-- Function to handle balance updates
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

-- Trigger for NEW transactions (e.g. VEND)
create trigger on_transaction_created
after insert on public.transactions
for each row execute procedure public.handle_balance_update();

-- Trigger for UPDATED transactions (e.g. RECHARGE becoming COMPLETED)
create trigger on_transaction_updated
after update on public.transactions
for each row 
when (old.status != 'COMPLETED' and new.status = 'COMPLETED')
execute procedure public.handle_balance_update();

-- 7. Enable Realtime
alter publication supabase_realtime add table public.vend_sessions;
alter publication supabase_realtime add table public.wallets;

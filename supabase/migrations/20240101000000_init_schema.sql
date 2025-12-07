-- ⚠️ DANGER: This will delete all wallet data!

-- 1. Clean up old objects
drop trigger if exists on_transaction_created on public.transactions;
drop function if exists public.handle_new_transaction();
drop view if exists public.user_balances;
drop table if exists public.vend_requests;
drop table if exists public.transactions;
drop table if exists public.wallets;

-- 2. Create Transactions Table (The Ledger)
create table public.transactions (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  user_id uuid references auth.users not null,
  amount numeric not null,
  type text not null, -- 'RECHARGE' or 'VEND'
  description text,
  metadata jsonb -- For storing checkout_id, etc.
);

-- 3. Create Wallets Table (The State)
create table public.wallets (
  user_id uuid references auth.users primary key,
  balance numeric default 0.00 not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Create Vend Requests Table (The Command Queue)
create table public.vend_requests (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  user_id uuid references auth.users not null,
  amount numeric not null,
  status text default 'PENDING', -- PENDING, APPROVED, DENIED, COMPLETED, FAILED
  machine_id text -- Optional, for multi-machine support
);

-- 5. Enable Security (RLS)
alter table public.transactions enable row level security;
alter table public.wallets enable row level security;
alter table public.vend_requests enable row level security;

-- 6. Policies

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

-- Vend Requests: "I can insert requests and see my own"
create policy "Users can create vend requests"
on public.vend_requests for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can view own vend requests"
on public.vend_requests for select
to authenticated
using (auth.uid() = user_id);

-- 7. Trigger: Auto-update Wallet Balance
create or replace function public.handle_new_transaction() 
returns trigger as $$
begin
  insert into public.wallets (user_id, balance)
  values (new.user_id, new.amount)
  on conflict (user_id) do update
  set balance = wallets.balance + new.amount,
      updated_at = now();
  return new;
end;
$$ language plpgsql security definer;

create trigger on_transaction_created
after insert on public.transactions
for each row execute procedure public.handle_new_transaction();

-- 8. Enable Realtime for Vend Requests
alter publication supabase_realtime add table public.vend_requests;
alter publication supabase_realtime add table public.wallets;

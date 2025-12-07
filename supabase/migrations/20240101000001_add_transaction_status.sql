-- Add status column to transactions if not exists
alter table public.transactions add column if not exists status text default 'COMPLETED';

-- Update existing rows
update public.transactions set status = 'COMPLETED' where status is null;

-- Modify Trigger to ONLY update wallet if status is COMPLETED
create or replace function public.handle_new_transaction() 
returns trigger as $$
begin
  -- Only update balance if transaction is COMPLETED
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

-- Create Trigger for UPDATES (when PENDING becomes COMPLETED)
create or replace function public.handle_transaction_update() 
returns trigger as $$
begin
  -- If status changed to COMPLETED, credit the wallet
  if old.status != 'COMPLETED' and new.status = 'COMPLETED' then
      insert into public.wallets (user_id, balance)
      values (new.user_id, new.amount)
      on conflict (user_id) do update
      set balance = wallets.balance + new.amount,
          updated_at = now();
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_transaction_updated on public.transactions;
create trigger on_transaction_updated
after update on public.transactions
for each row execute procedure public.handle_transaction_update();

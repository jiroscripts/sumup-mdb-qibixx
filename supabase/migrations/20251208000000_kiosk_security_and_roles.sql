-- Consolidated Migration: Kiosk Security & Roles
-- Combines RLS security, Insert permissions, and Role restrictions.

-- 1. Helper Function to check User Role
-- This function reads the JWT metadata to find the 'app_role' claim.
create or replace function public.auth_has_role(expected_role text)
returns boolean
language sql
security definer
stable
as $$
  select (auth.jwt() -> 'app_metadata' ->> 'app_role') = expected_role;
$$;

-- 2. Reset Policies on vend_sessions to ensure a clean slate
-- We drop existing policies to avoid conflicts if this is re-run.
drop policy if exists "Enable read access for all users" on public.vend_sessions;
drop policy if exists "Public can view pending sessions" on public.vend_sessions;
drop policy if exists "Users can view own paid sessions" on public.vend_sessions;
drop policy if exists "Kiosks can create sessions" on public.vend_sessions;
drop policy if exists "Only Kiosks can create sessions" on public.vend_sessions;
drop policy if exists "Kiosks can update own sessions" on public.vend_sessions;
drop policy if exists "Only Kiosks can update sessions" on public.vend_sessions;

-- 3. Grant Permissions
-- Allow authenticated users to INSERT (we restrict *who* via RLS below)
grant insert on public.vend_sessions to authenticated;

-- 4. Define RLS Policies

-- A. READ (SELECT)
-- Public: Can see PENDING sessions (needed for payment page)
create policy "Public can view pending sessions"
on public.vend_sessions for select
using (
  status = 'PENDING'
);

-- Authenticated Users: Can see their OWN paid sessions
create policy "Users can view own paid sessions"
on public.vend_sessions for select
to authenticated
using (
  (metadata ->> 'paid_by')::uuid = auth.uid()
);

-- B. CREATE (INSERT)
-- Only users with 'app_role': 'kiosk' can create sessions
create policy "Only Kiosks can create sessions"
on public.vend_sessions for insert
to authenticated
with check (
  public.auth_has_role('kiosk')
);

-- C. UPDATE
-- Only users with 'app_role': 'kiosk' can update sessions (e.g. mark as FAILED)
create policy "Only Kiosks can update sessions"
on public.vend_sessions for update
to authenticated
using (
  public.auth_has_role('kiosk')
);

-- =============================================================================
-- WORKFLOWIQ | 09_loan_repayments.sql
-- Forward-looking loan repayment schedule for the accounting home page.
-- Balances remain derived from posted ledger lines; this table only stores due dates.
-- =============================================================================

create table if not exists public.loan_repayments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org_id() references public.organizations(id) on delete cascade,
  loan_account_id uuid not null references public.chart_account(id) on delete cascade,
  due_date date not null,
  amount numeric(14,2) not null default 0,
  is_paid boolean not null default false,
  note text,
  created_by uuid references public.app_users(id) on delete set null default public.current_app_user_id(),
  created_at timestamptz not null default now(),
  constraint loan_repayments_amount_non_negative check (amount >= 0)
);

create index if not exists loan_repayments_org_due_idx
  on public.loan_repayments (org_id, is_paid, due_date);

create index if not exists loan_repayments_org_account_idx
  on public.loan_repayments (org_id, loan_account_id);

alter table public.loan_repayments enable row level security;

drop policy if exists loan_repayments_select on public.loan_repayments;
drop policy if exists loan_repayments_insert on public.loan_repayments;
drop policy if exists loan_repayments_update on public.loan_repayments;
drop policy if exists loan_repayments_delete on public.loan_repayments;

create policy loan_repayments_select on public.loan_repayments for select to authenticated
  using (org_id = public.current_org_id());

create policy loan_repayments_insert on public.loan_repayments for insert to authenticated
  with check (org_id = public.current_org_id() and public.current_app_user_id() is not null);

create policy loan_repayments_update on public.loan_repayments for update to authenticated
  using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());

create policy loan_repayments_delete on public.loan_repayments for delete to authenticated
  using (org_id = public.current_org_id() and public.current_app_role() = 'admin');

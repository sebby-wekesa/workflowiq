-- =============================================================================
-- WORKFLOWIQ | 05_accounting_core.sql
-- Org-scoped double-entry accounting core for the Vite/Supabase app.
-- Creates chart accounts, journal entries, ledger lines, RLS policies, and the
-- atomic journal posting RPC used by every accounting workflow.
-- =============================================================================

create table if not exists public.chart_account (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade,
  code text not null,
  name text not null,
  type text not null check (type in ('ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE')),
  normal_balance text not null check (normal_balance in ('DEBIT', 'CREDIT')),
  is_bank boolean not null default false,
  is_system boolean not null default false,
  is_active boolean not null default true,
  description text,
  created_by uuid references public.app_users(id) on delete set null default public.current_app_user_id(),
  created_at timestamptz not null default now()
);

alter table public.chart_account add column if not exists org_id uuid references public.organizations(id) on delete cascade;
alter table public.chart_account add column if not exists is_active boolean not null default true;
alter table public.chart_account add column if not exists created_by uuid references public.app_users(id) on delete set null default public.current_app_user_id();
alter table public.chart_account add column if not exists created_at timestamptz not null default now();
alter table public.chart_account alter column id set default gen_random_uuid();
alter table public.chart_account alter column org_id set default public.current_org_id();
alter table public.chart_account alter column is_bank set default false;
alter table public.chart_account alter column is_system set default false;
alter table public.chart_account alter column is_active set default true;

update public.chart_account
   set org_id = (select id from public.organizations order by created_at limit 1)
 where org_id is null;

alter table public.chart_account alter column org_id set not null;
alter table public.chart_account drop constraint if exists chart_account_code_key;
drop index if exists chart_account_code_key;
create unique index if not exists chart_account_org_code_uniq
  on public.chart_account (org_id, code);
create index if not exists chart_account_org_type_idx
  on public.chart_account (org_id, type);

create table if not exists public.journal_entry (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org_id() references public.organizations(id) on delete cascade,
  entry_number text not null,
  date timestamptz not null,
  memo text,
  status text not null default 'POSTED',
  source text not null default 'MANUAL',
  source_type text,
  source_id text,
  total_debit numeric(14,2) not null default 0,
  total_credit numeric(14,2) not null default 0,
  posted_at timestamptz,
  posted_by uuid references public.app_users(id) on delete set null,
  created_by uuid references public.app_users(id) on delete set null default public.current_app_user_id(),
  created_at timestamptz not null default now()
);

alter table public.journal_entry add column if not exists org_id uuid references public.organizations(id) on delete cascade;
alter table public.journal_entry add column if not exists total_debit numeric(14,2) not null default 0;
alter table public.journal_entry add column if not exists total_credit numeric(14,2) not null default 0;
alter table public.journal_entry alter column id set default gen_random_uuid();
alter table public.journal_entry alter column org_id set default public.current_org_id();
alter table public.journal_entry alter column status set default 'POSTED';
alter table public.journal_entry alter column source set default 'MANUAL';
alter table public.journal_entry alter column created_at set default now();

do $$
begin
  if exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'journal_entry'
       and column_name = 'organization_id'
  ) then
    execute '
      update public.journal_entry je
         set org_id = je.organization_id
       where je.org_id is null
         and exists (select 1 from public.organizations o where o.id = je.organization_id)
    ';
    execute 'alter table public.journal_entry alter column organization_id drop not null';
  end if;
end $$;

update public.journal_entry
   set org_id = (select id from public.organizations order by created_at limit 1)
 where org_id is null;

alter table public.journal_entry alter column org_id set not null;
alter table public.journal_entry drop constraint if exists journal_entry_entry_number_key;
drop index if exists journal_entry_entry_number_key;
create unique index if not exists journal_entry_org_number_uniq
  on public.journal_entry (org_id, entry_number);
create index if not exists journal_entry_org_date_idx
  on public.journal_entry (org_id, date);
create index if not exists journal_entry_org_source_idx
  on public.journal_entry (org_id, source, source_type, source_id);

create table if not exists public.ledger_line (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org_id() references public.organizations(id) on delete cascade,
  journal_entry_id uuid not null references public.journal_entry(id) on delete cascade,
  account_id uuid not null references public.chart_account(id) on delete restrict,
  debit numeric(14,2) not null default 0,
  credit numeric(14,2) not null default 0,
  description text,
  created_at timestamptz not null default now()
);

alter table public.ledger_line add column if not exists org_id uuid references public.organizations(id) on delete cascade;
alter table public.ledger_line add column if not exists description text;
alter table public.ledger_line add column if not exists created_at timestamptz not null default now();
alter table public.ledger_line alter column id set default gen_random_uuid();
alter table public.ledger_line alter column org_id set default public.current_org_id();
alter table public.ledger_line alter column debit set default 0;
alter table public.ledger_line alter column credit set default 0;

update public.ledger_line ll
   set org_id = je.org_id
  from public.journal_entry je
 where ll.journal_entry_id = je.id
   and ll.org_id is null;

alter table public.ledger_line alter column org_id set not null;
create index if not exists ledger_line_org_account_idx
  on public.ledger_line (org_id, account_id);
create index if not exists ledger_line_org_entry_idx
  on public.ledger_line (org_id, journal_entry_id);

alter table public.chart_account enable row level security;
alter table public.journal_entry enable row level security;
alter table public.ledger_line enable row level security;

drop policy if exists chart_account_select on public.chart_account;
drop policy if exists chart_account_insert on public.chart_account;
drop policy if exists chart_account_update on public.chart_account;
drop policy if exists chart_account_delete on public.chart_account;
create policy chart_account_select on public.chart_account for select to authenticated
  using (org_id = public.current_org_id());
create policy chart_account_insert on public.chart_account for insert to authenticated
  with check (org_id = public.current_org_id() and public.current_app_user_id() is not null);
create policy chart_account_update on public.chart_account for update to authenticated
  using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());
create policy chart_account_delete on public.chart_account for delete to authenticated
  using (org_id = public.current_org_id() and public.current_app_role() = 'admin');

drop policy if exists journal_entry_select on public.journal_entry;
drop policy if exists journal_entry_insert on public.journal_entry;
drop policy if exists journal_entry_update on public.journal_entry;
drop policy if exists journal_entry_delete on public.journal_entry;
create policy journal_entry_select on public.journal_entry for select to authenticated
  using (org_id = public.current_org_id());
create policy journal_entry_insert on public.journal_entry for insert to authenticated
  with check (org_id = public.current_org_id() and public.current_app_user_id() is not null);
create policy journal_entry_update on public.journal_entry for update to authenticated
  using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());
create policy journal_entry_delete on public.journal_entry for delete to authenticated
  using (org_id = public.current_org_id() and public.current_app_role() = 'admin');

drop policy if exists ledger_line_select on public.ledger_line;
drop policy if exists ledger_line_insert on public.ledger_line;
drop policy if exists ledger_line_update on public.ledger_line;
drop policy if exists ledger_line_delete on public.ledger_line;
create policy ledger_line_select on public.ledger_line for select to authenticated
  using (org_id = public.current_org_id());
create policy ledger_line_insert on public.ledger_line for insert to authenticated
  with check (org_id = public.current_org_id() and public.current_app_user_id() is not null);
create policy ledger_line_update on public.ledger_line for update to authenticated
  using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());
create policy ledger_line_delete on public.ledger_line for delete to authenticated
  using (org_id = public.current_org_id() and public.current_app_role() = 'admin');

create or replace function public._next_journal_entry_number(p_org uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  yr text := to_char(now(), 'YYYY');
  n int;
begin
  select coalesce(max(substring(entry_number from '[0-9]+$')::int), 0) + 1
    into n
    from public.journal_entry
   where org_id = p_org
     and entry_number like 'JE-' || yr || '-%';

  return 'JE-' || yr || '-' || lpad(n::text, 6, '0');
end $$;

create or replace function public.post_journal_entry(
  p_date date,
  p_memo text,
  p_source text,
  p_source_type text,
  p_source_id text,
  p_lines jsonb
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me uuid := public.current_app_user_id();
  org uuid := public.current_org_id();
  entry_id uuid;
  entry_no text;
  line jsonb;
  account uuid;
  debit_amt numeric(14,2);
  credit_amt numeric(14,2);
  total_debit numeric(14,2) := 0;
  total_credit numeric(14,2) := 0;
  line_count int := 0;
begin
  if me is null or org is null then
    raise exception 'User not logged in';
  end if;

  if public.current_app_role() not in ('admin', 'manager') then
    raise exception 'You do not have permission to post accounting entries';
  end if;

  if p_lines is null or jsonb_typeof(p_lines) <> 'array' then
    raise exception 'Journal lines must be an array';
  end if;

  for line in select value from jsonb_array_elements(p_lines) as t(value) loop
    account := coalesce(nullif(line->>'account_id', ''), nullif(line->>'accountId', ''))::uuid;
    debit_amt := round(coalesce(nullif(line->>'debit', '')::numeric, 0), 2);
    credit_amt := round(coalesce(nullif(line->>'credit', '')::numeric, 0), 2);

    if account is null then
      raise exception 'Every journal line needs an account';
    end if;
    if not exists (
      select 1 from public.chart_account
       where id = account and org_id = org and is_active = true
    ) then
      raise exception 'Account not found in this workshop';
    end if;
    if debit_amt < 0 or credit_amt < 0 then
      raise exception 'Debit and credit amounts must be positive';
    end if;
    if debit_amt > 0 and credit_amt > 0 then
      raise exception 'A line cannot have both a debit and a credit';
    end if;
    if debit_amt = 0 and credit_amt = 0 then
      continue;
    end if;

    total_debit := total_debit + debit_amt;
    total_credit := total_credit + credit_amt;
    line_count := line_count + 1;
  end loop;

  total_debit := round(total_debit, 2);
  total_credit := round(total_credit, 2);

  if line_count < 2 then
    raise exception 'A journal entry needs at least two non-zero lines';
  end if;
  if total_debit <> total_credit then
    raise exception 'Journal entry does not balance: debits % credits %', total_debit, total_credit;
  end if;
  if total_debit = 0 then
    raise exception 'Journal entry total cannot be zero';
  end if;

  entry_no := public._next_journal_entry_number(org);

  insert into public.journal_entry (
    org_id, entry_number, date, memo, source, source_type, source_id,
    total_debit, total_credit, status, posted_at, posted_by, created_by
  )
  values (
    org, entry_no, p_date::timestamptz, nullif(p_memo, ''),
    coalesce(nullif(p_source, ''), 'MANUAL'), nullif(p_source_type, ''), nullif(p_source_id, ''),
    total_debit, total_credit, 'POSTED', now(), me, me
  )
  returning id into entry_id;

  for line in select value from jsonb_array_elements(p_lines) as t(value) loop
    account := coalesce(nullif(line->>'account_id', ''), nullif(line->>'accountId', ''))::uuid;
    debit_amt := round(coalesce(nullif(line->>'debit', '')::numeric, 0), 2);
    credit_amt := round(coalesce(nullif(line->>'credit', '')::numeric, 0), 2);
    if debit_amt = 0 and credit_amt = 0 then
      continue;
    end if;

    insert into public.ledger_line (
      org_id, journal_entry_id, account_id, debit, credit, description
    )
    values (
      org, entry_id, account, debit_amt, credit_amt,
      nullif(coalesce(line->>'description', ''), '')
    );
  end loop;

  return jsonb_build_object(
    'id', entry_id,
    'entry_number', entry_no,
    'entryNumber', entry_no,
    'total_debit', total_debit,
    'total_credit', total_credit
  );
end $$;

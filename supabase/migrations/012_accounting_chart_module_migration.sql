-- =============================================================================
-- WORKFLOWIQ | 012_accounting_chart_module_migration.sql
-- Complete accounting chart module schema for /accounting/chart.
-- =============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Shared updated_at trigger.
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Chart of accounts. Supports the current frontend names and compatibility
-- aliases from earlier accounting drafts.
-- ---------------------------------------------------------------------------

create table if not exists public.chart_account (
  id uuid primary key default gen_random_uuid(),
  org_id uuid default public.current_org_id() references public.organizations(id) on delete cascade,
  code text,
  name text,
  type text,
  account_code text,
  account_name text,
  account_type text,
  category text,
  sub_category text,
  classification text,
  statement_group text,
  normal_balance text,
  currency text not null default 'KES',
  parent_id uuid,
  note text,
  vat_applicable boolean not null default false,
  tax_code_id uuid,
  is_postable boolean not null default true,
  is_bank boolean not null default false,
  is_system boolean not null default false,
  is_active boolean not null default true,
  description text,
  branch text,
  created_by uuid references public.app_users(id) on delete set null default public.current_app_user_id(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.chart_account add column if not exists org_id uuid references public.organizations(id) on delete cascade;
alter table public.chart_account add column if not exists code text;
alter table public.chart_account add column if not exists name text;
alter table public.chart_account add column if not exists type text;
alter table public.chart_account add column if not exists account_code text;
alter table public.chart_account add column if not exists account_name text;
alter table public.chart_account add column if not exists account_type text;
alter table public.chart_account add column if not exists category text;
alter table public.chart_account add column if not exists sub_category text;
alter table public.chart_account add column if not exists classification text;
alter table public.chart_account add column if not exists statement_group text;
alter table public.chart_account add column if not exists normal_balance text;
alter table public.chart_account add column if not exists currency text;
alter table public.chart_account add column if not exists parent_id uuid;
alter table public.chart_account add column if not exists note text;
alter table public.chart_account add column if not exists vat_applicable boolean;
alter table public.chart_account add column if not exists tax_code_id uuid;
alter table public.chart_account add column if not exists is_postable boolean;
alter table public.chart_account add column if not exists is_bank boolean;
alter table public.chart_account add column if not exists is_system boolean;
alter table public.chart_account add column if not exists is_active boolean;
alter table public.chart_account add column if not exists description text;
alter table public.chart_account add column if not exists branch text;
alter table public.chart_account add column if not exists created_by uuid references public.app_users(id) on delete set null default public.current_app_user_id();
alter table public.chart_account add column if not exists created_at timestamptz;
alter table public.chart_account add column if not exists updated_at timestamptz;

alter table public.chart_account drop constraint if exists chart_account_type_check;
alter table public.chart_account drop constraint if exists chart_account_normal_balance_check;

update public.chart_account
   set org_id = coalesce(org_id, (select id from public.organizations order by created_at limit 1)),
       code = coalesce(nullif(code, ''), nullif(account_code, ''), 'UNASSIGNED-' || left(id::text, 8)),
       account_code = coalesce(nullif(account_code, ''), nullif(code, ''), 'UNASSIGNED-' || left(id::text, 8)),
       name = coalesce(nullif(name, ''), nullif(account_name, ''), 'Unnamed Account'),
       account_name = coalesce(nullif(account_name, ''), nullif(name, ''), 'Unnamed Account'),
       type = upper(coalesce(nullif(type, ''), nullif(account_type, ''), 'ASSET')),
       account_type = lower(upper(coalesce(nullif(type, ''), nullif(account_type, ''), 'ASSET'))),
       normal_balance = upper(coalesce(nullif(normal_balance, ''), case when upper(coalesce(type, account_type, 'ASSET')) in ('ASSET', 'EXPENSE') then 'DEBIT' else 'CREDIT' end)),
       currency = coalesce(nullif(currency, ''), 'KES'),
       vat_applicable = coalesce(vat_applicable, false),
       is_postable = coalesce(is_postable, true),
       is_bank = coalesce(is_bank, false),
       is_system = coalesce(is_system, false),
       is_active = coalesce(is_active, true),
       created_at = coalesce(created_at, now()),
       updated_at = coalesce(updated_at, created_at, now());

alter table public.chart_account alter column id set default gen_random_uuid();
alter table public.chart_account alter column org_id set default public.current_org_id();
alter table public.chart_account alter column org_id set not null;
alter table public.chart_account alter column code set not null;
alter table public.chart_account alter column name set not null;
alter table public.chart_account alter column type set not null;
alter table public.chart_account alter column normal_balance set not null;
alter table public.chart_account alter column currency set default 'KES';
alter table public.chart_account alter column currency set not null;
alter table public.chart_account alter column vat_applicable set default false;
alter table public.chart_account alter column vat_applicable set not null;
alter table public.chart_account alter column is_postable set default true;
alter table public.chart_account alter column is_postable set not null;
alter table public.chart_account alter column is_bank set default false;
alter table public.chart_account alter column is_bank set not null;
alter table public.chart_account alter column is_system set default false;
alter table public.chart_account alter column is_system set not null;
alter table public.chart_account alter column is_active set default true;
alter table public.chart_account alter column is_active set not null;
alter table public.chart_account alter column created_at set default now();
alter table public.chart_account alter column created_at set not null;
alter table public.chart_account alter column updated_at set default now();
alter table public.chart_account alter column updated_at set not null;

alter table public.chart_account add constraint chart_account_type_check
  check (type in ('ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE')) not valid;
alter table public.chart_account add constraint chart_account_normal_balance_check
  check (normal_balance in ('DEBIT', 'CREDIT')) not valid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'chart_account_parent_id_fkey'
       and conrelid = 'public.chart_account'::regclass
  ) then
    alter table public.chart_account
      add constraint chart_account_parent_id_fkey
      foreign key (parent_id) references public.chart_account(id) on delete set null not valid;
  end if;
end $$;

drop index if exists chart_account_code_key;
alter table public.chart_account drop constraint if exists chart_account_account_code_key;
drop index if exists chart_account_account_code_key;
drop index if exists chart_account_org_code_uniq;
create unique index if not exists chart_account_org_code_uniq
  on public.chart_account (org_id, code);
create index if not exists chart_account_org_type_idx
  on public.chart_account (org_id, type);
create index if not exists chart_account_org_statement_group_idx
  on public.chart_account (org_id, statement_group)
  where is_active = true;
create index if not exists chart_account_org_parent_idx
  on public.chart_account (org_id, parent_id)
  where parent_id is not null;
create index if not exists chart_account_org_postable_idx
  on public.chart_account (org_id, is_postable)
  where is_active = true;

create or replace function public.sync_chart_account_aliases()
returns trigger language plpgsql set search_path = public as $$
begin
  new.code = coalesce(nullif(new.code, ''), nullif(new.account_code, ''));
  new.account_code = coalesce(nullif(new.account_code, ''), new.code);
  new.name = coalesce(nullif(new.name, ''), nullif(new.account_name, ''));
  new.account_name = coalesce(nullif(new.account_name, ''), new.name);
  new.type = upper(coalesce(nullif(new.type, ''), nullif(new.account_type, '')));
  new.account_type = lower(new.type);
  new.normal_balance = upper(coalesce(nullif(new.normal_balance, ''), case when new.type in ('ASSET', 'EXPENSE') then 'DEBIT' else 'CREDIT' end));
  new.currency = coalesce(nullif(new.currency, ''), 'KES');
  new.vat_applicable = coalesce(new.vat_applicable, false);
  new.is_postable = coalesce(new.is_postable, true);
  new.is_bank = coalesce(new.is_bank, false);
  new.is_system = coalesce(new.is_system, false);
  new.is_active = coalesce(new.is_active, true);
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists chart_account_sync_aliases on public.chart_account;
create trigger chart_account_sync_aliases
  before insert or update on public.chart_account
  for each row execute function public.sync_chart_account_aliases();

drop trigger if exists chart_account_set_updated_at on public.chart_account;
create trigger chart_account_set_updated_at
  before update on public.chart_account
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Canonical journal tables used by /accounting/chart and reports.
-- ---------------------------------------------------------------------------

create table if not exists public.accounting_journal_entries (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org_id() references public.organizations(id) on delete cascade,
  journal_number text not null,
  entry_number text not null,
  date timestamptz not null default now(),
  description text,
  memo text,
  reference_number text,
  branch text,
  status text not null default 'POSTED',
  source text not null default 'MANUAL',
  source_type text,
  source_id text,
  total_debit numeric(14,2) not null default 0,
  total_credit numeric(14,2) not null default 0,
  posted_at timestamptz,
  posted_by uuid references public.app_users(id) on delete set null,
  created_by uuid references public.app_users(id) on delete set null default public.current_app_user_id(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.accounting_journal_entries add column if not exists org_id uuid references public.organizations(id) on delete cascade;
alter table public.accounting_journal_entries add column if not exists journal_number text;
alter table public.accounting_journal_entries add column if not exists entry_number text;
alter table public.accounting_journal_entries add column if not exists date timestamptz;
alter table public.accounting_journal_entries add column if not exists description text;
alter table public.accounting_journal_entries add column if not exists memo text;
alter table public.accounting_journal_entries add column if not exists reference_number text;
alter table public.accounting_journal_entries add column if not exists branch text;
alter table public.accounting_journal_entries add column if not exists status text;
alter table public.accounting_journal_entries add column if not exists source text;
alter table public.accounting_journal_entries add column if not exists source_type text;
alter table public.accounting_journal_entries add column if not exists source_id text;
alter table public.accounting_journal_entries add column if not exists total_debit numeric(14,2);
alter table public.accounting_journal_entries add column if not exists total_credit numeric(14,2);
alter table public.accounting_journal_entries add column if not exists posted_at timestamptz;
alter table public.accounting_journal_entries add column if not exists posted_by uuid references public.app_users(id) on delete set null;
alter table public.accounting_journal_entries add column if not exists created_by uuid references public.app_users(id) on delete set null default public.current_app_user_id();
alter table public.accounting_journal_entries add column if not exists created_at timestamptz;
alter table public.accounting_journal_entries add column if not exists updated_at timestamptz;

update public.accounting_journal_entries
   set org_id = coalesce(org_id, (select id from public.organizations order by created_at limit 1)),
       journal_number = coalesce(nullif(journal_number, ''), nullif(entry_number, ''), 'JE-' || left(id::text, 8)),
       entry_number = coalesce(nullif(entry_number, ''), nullif(journal_number, ''), 'JE-' || left(id::text, 8)),
       date = coalesce(date, now()),
       memo = coalesce(memo, description),
       description = coalesce(description, memo),
       status = coalesce(nullif(status, ''), 'POSTED'),
       source = coalesce(nullif(source, ''), 'MANUAL'),
       total_debit = coalesce(total_debit, 0),
       total_credit = coalesce(total_credit, 0),
       created_at = coalesce(created_at, now()),
       updated_at = coalesce(updated_at, created_at, now());

alter table public.accounting_journal_entries alter column org_id set default public.current_org_id();
alter table public.accounting_journal_entries alter column org_id set not null;
alter table public.accounting_journal_entries alter column journal_number set not null;
alter table public.accounting_journal_entries alter column entry_number set not null;
alter table public.accounting_journal_entries alter column date set default now();
alter table public.accounting_journal_entries alter column date set not null;
alter table public.accounting_journal_entries alter column status set default 'POSTED';
alter table public.accounting_journal_entries alter column status set not null;
alter table public.accounting_journal_entries alter column source set default 'MANUAL';
alter table public.accounting_journal_entries alter column source set not null;
alter table public.accounting_journal_entries alter column total_debit set default 0;
alter table public.accounting_journal_entries alter column total_debit set not null;
alter table public.accounting_journal_entries alter column total_credit set default 0;
alter table public.accounting_journal_entries alter column total_credit set not null;
alter table public.accounting_journal_entries alter column created_at set default now();
alter table public.accounting_journal_entries alter column created_at set not null;
alter table public.accounting_journal_entries alter column updated_at set default now();
alter table public.accounting_journal_entries alter column updated_at set not null;

create table if not exists public.accounting_journal_lines (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org_id() references public.organizations(id) on delete cascade,
  journal_entry_id uuid not null references public.accounting_journal_entries(id) on delete cascade,
  chart_account_id uuid not null references public.chart_account(id) on delete restrict,
  account_id uuid,
  debit numeric(14,2) not null default 0,
  credit numeric(14,2) not null default 0,
  description text,
  created_at timestamptz not null default now()
);

alter table public.accounting_journal_lines add column if not exists org_id uuid references public.organizations(id) on delete cascade;
alter table public.accounting_journal_lines add column if not exists journal_entry_id uuid;
alter table public.accounting_journal_lines add column if not exists chart_account_id uuid;
alter table public.accounting_journal_lines add column if not exists account_id uuid;
alter table public.accounting_journal_lines add column if not exists debit numeric(14,2);
alter table public.accounting_journal_lines add column if not exists credit numeric(14,2);
alter table public.accounting_journal_lines add column if not exists description text;
alter table public.accounting_journal_lines add column if not exists created_at timestamptz;
update public.accounting_journal_lines
   set org_id = coalesce(
         org_id,
         (select je.org_id from public.accounting_journal_entries je where je.id = journal_entry_id),
         (select id from public.organizations order by created_at limit 1)
       ),
       chart_account_id = coalesce(chart_account_id, account_id),
       account_id = coalesce(account_id, chart_account_id);
update public.accounting_journal_lines
   set debit = coalesce(debit, 0),
       credit = coalesce(credit, 0),
       created_at = coalesce(created_at, now());
alter table public.accounting_journal_lines alter column org_id set default public.current_org_id();
alter table public.accounting_journal_lines alter column org_id set not null;
alter table public.accounting_journal_lines alter column chart_account_id set not null;
alter table public.accounting_journal_lines alter column account_id set default null;
alter table public.accounting_journal_lines alter column debit set default 0;
alter table public.accounting_journal_lines alter column debit set not null;
alter table public.accounting_journal_lines alter column credit set default 0;
alter table public.accounting_journal_lines alter column credit set not null;
alter table public.accounting_journal_lines alter column created_at set default now();
alter table public.accounting_journal_lines alter column created_at set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'accounting_journal_lines_chart_account_id_fkey'
       and conrelid = 'public.accounting_journal_lines'::regclass
  ) then
    alter table public.accounting_journal_lines
      add constraint accounting_journal_lines_chart_account_id_fkey
      foreign key (chart_account_id) references public.chart_account(id) on delete restrict not valid;
  end if;
end $$;

create or replace function public.sync_accounting_journal_line_aliases()
returns trigger language plpgsql set search_path = public as $$
begin
  new.chart_account_id = coalesce(new.chart_account_id, new.account_id);
  new.account_id = coalesce(new.account_id, new.chart_account_id);
  return new;
end $$;

drop trigger if exists accounting_journal_lines_sync_aliases on public.accounting_journal_lines;
create trigger accounting_journal_lines_sync_aliases
  before insert or update on public.accounting_journal_lines
  for each row execute function public.sync_accounting_journal_line_aliases();

drop trigger if exists accounting_journal_entries_set_updated_at on public.accounting_journal_entries;
create trigger accounting_journal_entries_set_updated_at
  before update on public.accounting_journal_entries
  for each row execute function public.set_updated_at();

create unique index if not exists accounting_journal_entries_org_number_uniq
  on public.accounting_journal_entries (org_id, entry_number);
create index if not exists accounting_journal_entries_org_date_idx
  on public.accounting_journal_entries (org_id, date);
create index if not exists accounting_journal_entries_org_source_idx
  on public.accounting_journal_entries (org_id, source, source_type, source_id);
create index if not exists accounting_journal_lines_org_entry_idx
  on public.accounting_journal_lines (org_id, journal_entry_id);
create index if not exists accounting_journal_lines_org_account_idx
  on public.accounting_journal_lines (org_id, chart_account_id);
create index if not exists accounting_journal_lines_account_id_idx
  on public.accounting_journal_lines (account_id);

-- Migrate legacy journal tables if they exist.
do $$
begin
  if to_regclass('public.journal_entry') is not null then
    insert into public.accounting_journal_entries (
      id, org_id, journal_number, entry_number, date, description, memo, status,
      source, source_type, source_id, total_debit, total_credit, posted_at,
      posted_by, created_by, created_at, updated_at
    )
    select
      id, org_id, entry_number, entry_number, date, memo, memo, status,
      source, source_type, source_id, total_debit, total_credit, posted_at,
      posted_by, created_by, created_at, created_at
    from public.journal_entry
    on conflict (id) do nothing;
  end if;

  if to_regclass('public.ledger_line') is not null then
    insert into public.accounting_journal_lines (
      id, org_id, journal_entry_id, chart_account_id, account_id, debit, credit, description, created_at
    )
    select id, org_id, journal_entry_id, account_id, account_id, debit, credit, description, created_at
    from public.ledger_line
    on conflict (id) do nothing;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Operational accounting tables required by /accounting/chart.
-- ---------------------------------------------------------------------------

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org_id() references public.organizations(id) on delete cascade,
  name text not null,
  phone text not null default '',
  email text,
  location text,
  notes text,
  created_by uuid references public.app_users(id) on delete set null default public.current_app_user_id(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.suppliers add column if not exists org_id uuid references public.organizations(id) on delete cascade;
alter table public.suppliers add column if not exists phone text;
alter table public.suppliers add column if not exists email text;
alter table public.suppliers add column if not exists location text;
alter table public.suppliers add column if not exists notes text;
alter table public.suppliers add column if not exists created_by uuid references public.app_users(id) on delete set null default public.current_app_user_id();
alter table public.suppliers add column if not exists created_at timestamptz;
alter table public.suppliers add column if not exists updated_at timestamptz;
update public.suppliers
   set org_id = coalesce(org_id, (select id from public.organizations order by created_at limit 1)),
       phone = coalesce(phone, ''),
       created_at = coalesce(created_at, now()),
       updated_at = coalesce(updated_at, created_at, now());
alter table public.suppliers alter column org_id set default public.current_org_id();
alter table public.suppliers alter column org_id set not null;
alter table public.suppliers alter column phone set default '';
alter table public.suppliers alter column phone set not null;
alter table public.suppliers alter column created_at set default now();
alter table public.suppliers alter column created_at set not null;
alter table public.suppliers alter column updated_at set default now();
alter table public.suppliers alter column updated_at set not null;

create table if not exists public.accounting_cash_accounts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org_id() references public.organizations(id) on delete cascade,
  chart_account_id uuid not null references public.chart_account(id) on delete restrict,
  account_name text not null,
  account_type text not null default 'cash_in_hand',
  sub_category text,
  bank_name text,
  account_number text,
  branch text,
  opening_balance numeric(14,2) not null default 0,
  current_balance numeric(14,2) not null default 0,
  status text not null default 'active',
  created_by uuid references public.app_users(id) on delete set null default public.current_app_user_id(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.accounting_cash_accounts add column if not exists org_id uuid references public.organizations(id) on delete cascade;
alter table public.accounting_cash_accounts add column if not exists chart_account_id uuid;
alter table public.accounting_cash_accounts add column if not exists account_name text;
alter table public.accounting_cash_accounts add column if not exists account_type text;
alter table public.accounting_cash_accounts add column if not exists sub_category text;
alter table public.accounting_cash_accounts add column if not exists bank_name text;
alter table public.accounting_cash_accounts add column if not exists account_number text;
alter table public.accounting_cash_accounts add column if not exists branch text;
alter table public.accounting_cash_accounts add column if not exists opening_balance numeric(14,2);
alter table public.accounting_cash_accounts add column if not exists current_balance numeric(14,2);
alter table public.accounting_cash_accounts add column if not exists status text;
alter table public.accounting_cash_accounts add column if not exists created_by uuid references public.app_users(id) on delete set null default public.current_app_user_id();
alter table public.accounting_cash_accounts add column if not exists created_at timestamptz;
alter table public.accounting_cash_accounts add column if not exists updated_at timestamptz;
-- Reconcile existing data onto the account_type scheme using long-form values
-- ('cash_at_bank' / 'cash_in_hand'). Handles databases that previously stored a
-- legacy account_kind column and/or short-form values. Safe no-op on fresh DBs.
do $$
begin
  -- ensure the target column exists
  alter table public.accounting_cash_accounts add column if not exists account_type text;

  -- if a legacy account_kind column exists, fold it into account_type
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'accounting_cash_accounts'
       and column_name = 'account_kind'
  ) then
    update public.accounting_cash_accounts
       set account_type = coalesce(nullif(account_type, ''), account_kind)
     where account_type is null or account_type = '';
    -- make the abandoned column non-blocking
    begin
      alter table public.accounting_cash_accounts alter column account_kind drop not null;
    exception when others then null;
    end;
    alter table public.accounting_cash_accounts alter column account_kind set default 'cash';
  end if;

  -- normalize any short-form or legacy values to the long form
  update public.accounting_cash_accounts
     set account_type = case lower(coalesce(account_type, ''))
       when 'bank' then 'cash_at_bank'
       when 'cash' then 'cash_in_hand'
       when 'cash_at_bank' then 'cash_at_bank'
       when 'cash_in_hand' then 'cash_in_hand'
       else 'cash_in_hand'
     end;

  -- keep legacy account_kind in sync (short form) if it still exists, so nothing breaks
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'accounting_cash_accounts'
       and column_name = 'account_kind'
  ) then
    update public.accounting_cash_accounts
       set account_kind = case account_type
         when 'cash_at_bank' then 'bank'
         when 'cash_in_hand' then 'cash'
         else 'cash'
       end;
  end if;
end $$;
alter table public.accounting_cash_accounts drop constraint if exists accounting_cash_accounts_account_kind_check;
alter table public.accounting_cash_accounts drop constraint if exists accounting_cash_accounts_account_type_check;
update public.accounting_cash_accounts
   set org_id = coalesce(org_id, (select ca.org_id from public.chart_account ca where ca.id = chart_account_id), (select id from public.organizations order by created_at limit 1)),
       account_name = coalesce(nullif(account_name, ''), 'Cash Account'),
       account_type = case account_type
         when 'bank' then 'cash_at_bank'
         when 'cash' then 'cash_in_hand'
         when 'cash_at_bank' then 'cash_at_bank'
         when 'cash_in_hand' then 'cash_in_hand'
         else coalesce(nullif(account_type, ''), 'cash_in_hand')
       end,
       sub_category = coalesce(sub_category, account_type),
       opening_balance = coalesce(opening_balance, 0),
       current_balance = coalesce(current_balance, opening_balance, 0),
       status = coalesce(nullif(status, ''), 'active'),
       created_at = coalesce(created_at, now()),
       updated_at = coalesce(updated_at, created_at, now());
alter table public.accounting_cash_accounts alter column org_id set default public.current_org_id();
alter table public.accounting_cash_accounts alter column org_id set not null;
alter table public.accounting_cash_accounts alter column account_name set not null;
alter table public.accounting_cash_accounts alter column account_type set default 'cash_in_hand';
alter table public.accounting_cash_accounts alter column account_type set not null;
alter table public.accounting_cash_accounts alter column opening_balance set default 0;
alter table public.accounting_cash_accounts alter column opening_balance set not null;
alter table public.accounting_cash_accounts alter column current_balance set default 0;
alter table public.accounting_cash_accounts alter column current_balance set not null;
alter table public.accounting_cash_accounts alter column status set default 'active';
alter table public.accounting_cash_accounts alter column status set not null;
alter table public.accounting_cash_accounts alter column created_at set default now();
alter table public.accounting_cash_accounts alter column created_at set not null;
alter table public.accounting_cash_accounts alter column updated_at set default now();
alter table public.accounting_cash_accounts alter column updated_at set not null;
alter table public.accounting_cash_accounts add constraint accounting_cash_accounts_account_type_check
  check (account_type in ('cash_at_bank', 'cash_in_hand')) not valid;
alter table public.accounting_cash_accounts drop constraint if exists accounting_cash_accounts_status_check;
alter table public.accounting_cash_accounts add constraint accounting_cash_accounts_status_check
  check (status in ('active', 'inactive')) not valid;

create table if not exists public.accounting_cash_transactions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org_id() references public.organizations(id) on delete cascade,
  cash_account_id uuid not null references public.accounting_cash_accounts(id) on delete restrict,
  chart_account_id uuid references public.chart_account(id) on delete restrict,
  offset_account_id uuid references public.chart_account(id) on delete restrict,
  journal_entry_id uuid references public.accounting_journal_entries(id) on delete set null,
  transaction_number text not null,
  transaction_type text not null,
  date timestamptz not null default now(),
  transaction_date date,
  reference_number text,
  description text,
  debit numeric(14,2) not null default 0,
  credit numeric(14,2) not null default 0,
  running_balance numeric(14,2) not null default 0,
  branch text,
  created_by uuid references public.app_users(id) on delete set null default public.current_app_user_id(),
  created_at timestamptz not null default now()
);

alter table public.accounting_cash_transactions add column if not exists org_id uuid references public.organizations(id) on delete cascade;
alter table public.accounting_cash_transactions add column if not exists cash_account_id uuid;
alter table public.accounting_cash_transactions add column if not exists chart_account_id uuid references public.chart_account(id) on delete restrict;
alter table public.accounting_cash_transactions add column if not exists offset_account_id uuid references public.chart_account(id) on delete restrict;
alter table public.accounting_cash_transactions add column if not exists journal_entry_id uuid;
alter table public.accounting_cash_transactions add column if not exists transaction_number text;
alter table public.accounting_cash_transactions add column if not exists transaction_type text;
alter table public.accounting_cash_transactions add column if not exists date timestamptz;
alter table public.accounting_cash_transactions add column if not exists transaction_date date;
alter table public.accounting_cash_transactions add column if not exists reference_number text;
alter table public.accounting_cash_transactions add column if not exists description text;
alter table public.accounting_cash_transactions add column if not exists debit numeric(14,2);
alter table public.accounting_cash_transactions add column if not exists credit numeric(14,2);
alter table public.accounting_cash_transactions add column if not exists running_balance numeric(14,2);
alter table public.accounting_cash_transactions add column if not exists branch text;
alter table public.accounting_cash_transactions add column if not exists created_by uuid references public.app_users(id) on delete set null default public.current_app_user_id();
alter table public.accounting_cash_transactions add column if not exists created_at timestamptz;
alter table public.accounting_cash_transactions drop constraint if exists accounting_cash_transactions_transaction_type_check;
update public.accounting_cash_transactions
   set org_id = coalesce(org_id, (select ca.org_id from public.accounting_cash_accounts ca where ca.id = cash_account_id), (select id from public.organizations order by created_at limit 1)),
       transaction_number = coalesce(nullif(transaction_number, ''), nullif(reference_number, ''), 'CBK-' || left(id::text, 8)),
       transaction_type = coalesce(nullif(transaction_type, ''), 'Journal Entry'),
       date = coalesce(date, transaction_date::timestamptz, now()),
       debit = coalesce(debit, 0),
       credit = coalesce(credit, 0),
       running_balance = coalesce(running_balance, 0),
       created_at = coalesce(created_at, now()),
       offset_account_id = coalesce(offset_account_id, chart_account_id),
       chart_account_id = coalesce(chart_account_id, offset_account_id),
       transaction_date = coalesce(transaction_date, date::date);
alter table public.accounting_cash_transactions alter column org_id set default public.current_org_id();
alter table public.accounting_cash_transactions alter column org_id set not null;
alter table public.accounting_cash_transactions alter column transaction_number set not null;
alter table public.accounting_cash_transactions alter column transaction_type set not null;
alter table public.accounting_cash_transactions alter column date set default now();
alter table public.accounting_cash_transactions alter column date set not null;
alter table public.accounting_cash_transactions alter column debit set default 0;
alter table public.accounting_cash_transactions alter column debit set not null;
alter table public.accounting_cash_transactions alter column credit set default 0;
alter table public.accounting_cash_transactions alter column credit set not null;
alter table public.accounting_cash_transactions alter column running_balance set default 0;
alter table public.accounting_cash_transactions alter column running_balance set not null;
alter table public.accounting_cash_transactions alter column created_at set default now();
alter table public.accounting_cash_transactions alter column created_at set not null;

create table if not exists public.accounting_bank_reconciliations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org_id() references public.organizations(id) on delete cascade,
  cash_account_id uuid not null references public.accounting_cash_accounts(id) on delete restrict,
  reconciliation_number text not null,
  statement_date date not null default current_date,
  reconciliation_date date,
  statement_balance numeric(14,2) not null default 0,
  system_balance numeric(14,2) not null default 0,
  book_balance numeric(14,2) not null default 0,
  difference numeric(14,2) not null default 0,
  status text not null default 'open',
  notes text,
  reconciled_by uuid references public.app_users(id) on delete set null,
  created_by uuid references public.app_users(id) on delete set null default public.current_app_user_id(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.accounting_bank_reconciliations add column if not exists reconciliation_date date;
alter table public.accounting_bank_reconciliations add column if not exists org_id uuid references public.organizations(id) on delete cascade;
alter table public.accounting_bank_reconciliations add column if not exists cash_account_id uuid;
alter table public.accounting_bank_reconciliations add column if not exists reconciliation_number text;
alter table public.accounting_bank_reconciliations add column if not exists statement_date date;
alter table public.accounting_bank_reconciliations add column if not exists statement_balance numeric(14,2);
alter table public.accounting_bank_reconciliations add column if not exists system_balance numeric(14,2);
alter table public.accounting_bank_reconciliations add column if not exists book_balance numeric(14,2);
alter table public.accounting_bank_reconciliations add column if not exists difference numeric(14,2);
alter table public.accounting_bank_reconciliations add column if not exists status text;
alter table public.accounting_bank_reconciliations add column if not exists notes text;
alter table public.accounting_bank_reconciliations add column if not exists reconciled_by uuid references public.app_users(id) on delete set null;
alter table public.accounting_bank_reconciliations add column if not exists created_by uuid references public.app_users(id) on delete set null default public.current_app_user_id();
alter table public.accounting_bank_reconciliations add column if not exists created_at timestamptz;
alter table public.accounting_bank_reconciliations add column if not exists updated_at timestamptz;
update public.accounting_bank_reconciliations
   set org_id = coalesce(org_id, (select ca.org_id from public.accounting_cash_accounts ca where ca.id = cash_account_id), (select id from public.organizations order by created_at limit 1)),
       reconciliation_number = coalesce(nullif(reconciliation_number, ''), 'REC-' || left(id::text, 8)),
       statement_date = coalesce(statement_date, reconciliation_date, current_date),
       reconciliation_date = coalesce(reconciliation_date, statement_date, current_date),
       statement_balance = coalesce(statement_balance, 0),
       system_balance = coalesce(system_balance, book_balance, 0),
       book_balance = coalesce(book_balance, system_balance, 0),
       difference = coalesce(difference, statement_balance - coalesce(system_balance, book_balance, 0), 0),
       status = case when status = 'pending' then 'open' else coalesce(status, 'open') end,
       created_at = coalesce(created_at, now()),
       updated_at = coalesce(updated_at, created_at, now());
alter table public.accounting_bank_reconciliations alter column org_id set default public.current_org_id();
alter table public.accounting_bank_reconciliations alter column org_id set not null;
alter table public.accounting_bank_reconciliations alter column reconciliation_number set not null;
alter table public.accounting_bank_reconciliations alter column statement_date set default current_date;
alter table public.accounting_bank_reconciliations alter column statement_date set not null;
alter table public.accounting_bank_reconciliations alter column statement_balance set default 0;
alter table public.accounting_bank_reconciliations alter column statement_balance set not null;
alter table public.accounting_bank_reconciliations alter column system_balance set default 0;
alter table public.accounting_bank_reconciliations alter column system_balance set not null;
alter table public.accounting_bank_reconciliations alter column book_balance set default 0;
alter table public.accounting_bank_reconciliations alter column book_balance set not null;
alter table public.accounting_bank_reconciliations alter column difference set default 0;
alter table public.accounting_bank_reconciliations alter column difference set not null;
alter table public.accounting_bank_reconciliations alter column status set default 'open';
alter table public.accounting_bank_reconciliations alter column status set not null;
alter table public.accounting_bank_reconciliations alter column created_at set default now();
alter table public.accounting_bank_reconciliations alter column created_at set not null;
alter table public.accounting_bank_reconciliations alter column updated_at set default now();
alter table public.accounting_bank_reconciliations alter column updated_at set not null;
alter table public.accounting_bank_reconciliations drop constraint if exists accounting_bank_reconciliations_status_check;
alter table public.accounting_bank_reconciliations add constraint accounting_bank_reconciliations_status_check
  check (status in ('open', 'reconciled', 'pending')) not valid;

create table if not exists public.accounting_invoices (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org_id() references public.organizations(id) on delete cascade,
  invoice_number text not null,
  customer_id uuid not null references public.customers(id) on delete restrict,
  customer text,
  job_id uuid references public.jobs(id) on delete set null,
  date timestamptz not null default now(),
  invoice_date date,
  due_date timestamptz,
  branch text,
  sales_person text,
  status text not null default 'posted',
  payment_terms text,
  subtotal numeric(14,2) not null default 0,
  discount_total numeric(14,2) not null default 0,
  tax_total numeric(14,2) not null default 0,
  has_vat boolean not null default true,
  net_amount numeric(14,2) not null default 0,
  vat_amount numeric(14,2) not null default 0,
  total_amount numeric(14,2) not null default 0,
  outstanding_balance numeric(14,2) not null default 0,
  memo text,
  notes text,
  journal_entry_id uuid references public.accounting_journal_entries(id) on delete set null,
  created_by uuid references public.app_users(id) on delete set null default public.current_app_user_id(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.accounting_invoices add column if not exists org_id uuid references public.organizations(id) on delete cascade;
alter table public.accounting_invoices add column if not exists invoice_number text;
alter table public.accounting_invoices add column if not exists customer_id uuid;
alter table public.accounting_invoices add column if not exists customer text;
alter table public.accounting_invoices add column if not exists job_id uuid references public.jobs(id) on delete set null;
alter table public.accounting_invoices add column if not exists date timestamptz;
alter table public.accounting_invoices add column if not exists invoice_date date;
alter table public.accounting_invoices add column if not exists due_date timestamptz;
alter table public.accounting_invoices add column if not exists branch text;
alter table public.accounting_invoices add column if not exists sales_person text;
alter table public.accounting_invoices add column if not exists status text;
alter table public.accounting_invoices add column if not exists payment_terms text;
alter table public.accounting_invoices add column if not exists subtotal numeric(14,2);
alter table public.accounting_invoices add column if not exists discount_total numeric(14,2);
alter table public.accounting_invoices add column if not exists tax_total numeric(14,2);
alter table public.accounting_invoices add column if not exists has_vat boolean;
alter table public.accounting_invoices add column if not exists net_amount numeric(14,2);
alter table public.accounting_invoices add column if not exists vat_amount numeric(14,2);
alter table public.accounting_invoices add column if not exists total_amount numeric(14,2);
alter table public.accounting_invoices add column if not exists outstanding_balance numeric(14,2);
alter table public.accounting_invoices add column if not exists memo text;
alter table public.accounting_invoices add column if not exists notes text;
alter table public.accounting_invoices add column if not exists journal_entry_id uuid;
alter table public.accounting_invoices add column if not exists created_by uuid references public.app_users(id) on delete set null default public.current_app_user_id();
alter table public.accounting_invoices add column if not exists created_at timestamptz;
alter table public.accounting_invoices add column if not exists updated_at timestamptz;
update public.accounting_invoices inv
   set org_id = coalesce(inv.org_id, (select c.org_id from public.customers c where c.id = inv.customer_id), (select id from public.organizations order by created_at limit 1)),
       invoice_number = coalesce(nullif(inv.invoice_number, ''), 'INV-' || left(inv.id::text, 8)),
       date = coalesce(inv.date, inv.invoice_date::timestamptz, inv.created_at, now()),
       invoice_date = coalesce(inv.invoice_date, inv.date::date, current_date),
       customer_id = coalesce(
         inv.customer_id,
         (
           select c.id
             from public.customers c
            where c.org_id = coalesce(inv.org_id, (select id from public.organizations order by created_at limit 1))
              and inv.customer is not null
              and lower(c.name) = lower(inv.customer)
            order by c.created_at
            limit 1
         )
       ),
       customer = coalesce(inv.customer, (select c.name from public.customers c where c.id = inv.customer_id)),
       status = coalesce(nullif(inv.status, ''), 'posted'),
       subtotal = coalesce(inv.subtotal, inv.net_amount, inv.total_amount, 0),
       discount_total = coalesce(inv.discount_total, 0),
       tax_total = coalesce(inv.tax_total, inv.vat_amount, 0),
       has_vat = coalesce(inv.has_vat, coalesce(inv.tax_total, inv.vat_amount, 0) > 0),
       net_amount = coalesce(inv.net_amount, greatest(coalesce(inv.subtotal, inv.total_amount, 0) - coalesce(inv.discount_total, 0), 0)),
       vat_amount = coalesce(inv.vat_amount, inv.tax_total, 0),
       total_amount = coalesce(inv.total_amount, greatest(coalesce(inv.subtotal, inv.net_amount, 0) - coalesce(inv.discount_total, 0), 0) + coalesce(inv.tax_total, inv.vat_amount, 0)),
       outstanding_balance = coalesce(inv.outstanding_balance, inv.total_amount, 0),
       memo = coalesce(inv.memo, inv.notes),
       created_at = coalesce(inv.created_at, now()),
       updated_at = coalesce(inv.updated_at, inv.created_at, now());
alter table public.accounting_invoices alter column org_id set default public.current_org_id();
alter table public.accounting_invoices alter column org_id set not null;
alter table public.accounting_invoices alter column invoice_number set not null;
alter table public.accounting_invoices alter column date set default now();
alter table public.accounting_invoices alter column date set not null;
alter table public.accounting_invoices alter column status set default 'posted';
alter table public.accounting_invoices alter column status set not null;
alter table public.accounting_invoices alter column subtotal set default 0;
alter table public.accounting_invoices alter column subtotal set not null;
alter table public.accounting_invoices alter column discount_total set default 0;
alter table public.accounting_invoices alter column discount_total set not null;
alter table public.accounting_invoices alter column tax_total set default 0;
alter table public.accounting_invoices alter column tax_total set not null;
alter table public.accounting_invoices alter column has_vat set default true;
alter table public.accounting_invoices alter column has_vat set not null;
alter table public.accounting_invoices alter column net_amount set default 0;
alter table public.accounting_invoices alter column net_amount set not null;
alter table public.accounting_invoices alter column vat_amount set default 0;
alter table public.accounting_invoices alter column vat_amount set not null;
alter table public.accounting_invoices alter column total_amount set default 0;
alter table public.accounting_invoices alter column total_amount set not null;
alter table public.accounting_invoices alter column outstanding_balance set default 0;
alter table public.accounting_invoices alter column outstanding_balance set not null;
alter table public.accounting_invoices alter column created_at set default now();
alter table public.accounting_invoices alter column created_at set not null;
alter table public.accounting_invoices alter column updated_at set default now();
alter table public.accounting_invoices alter column updated_at set not null;

create table if not exists public.accounting_invoice_lines (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org_id() references public.organizations(id) on delete cascade,
  invoice_id uuid not null references public.accounting_invoices(id) on delete cascade,
  item text,
  product_service text,
  description text,
  quantity numeric(14,2) not null default 1,
  unit_price numeric(14,2) not null default 0,
  discount numeric(14,2) not null default 0,
  tax numeric(14,2) not null default 0,
  tax_rate numeric(7,4) not null default 0,
  tax_amount numeric(14,2) not null default 0,
  line_total numeric(14,2) not null default 0,
  created_at timestamptz not null default now()
);

alter table public.accounting_invoice_lines add column if not exists org_id uuid references public.organizations(id) on delete cascade;
alter table public.accounting_invoice_lines add column if not exists invoice_id uuid;
alter table public.accounting_invoice_lines add column if not exists item text;
alter table public.accounting_invoice_lines add column if not exists product_service text;
alter table public.accounting_invoice_lines add column if not exists description text;
alter table public.accounting_invoice_lines add column if not exists quantity numeric(14,2);
alter table public.accounting_invoice_lines add column if not exists unit_price numeric(14,2);
alter table public.accounting_invoice_lines add column if not exists discount numeric(14,2);
alter table public.accounting_invoice_lines add column if not exists tax numeric(14,2);
alter table public.accounting_invoice_lines add column if not exists tax_rate numeric(7,4);
alter table public.accounting_invoice_lines add column if not exists tax_amount numeric(14,2);
alter table public.accounting_invoice_lines add column if not exists line_total numeric(14,2);
alter table public.accounting_invoice_lines add column if not exists created_at timestamptz;
update public.accounting_invoice_lines il
   set org_id = coalesce(il.org_id, (select inv.org_id from public.accounting_invoices inv where inv.id = il.invoice_id), (select id from public.organizations order by created_at limit 1)),
       item = coalesce(nullif(il.item, ''), il.product_service, il.description, 'Line item'),
       product_service = coalesce(nullif(il.product_service, ''), il.item, il.description, 'Line item'),
       quantity = coalesce(il.quantity, 1),
       unit_price = coalesce(il.unit_price, 0),
       discount = coalesce(il.discount, 0),
       tax = coalesce(il.tax, il.tax_rate, 0),
       tax_rate = coalesce(il.tax_rate, il.tax, 0),
       tax_amount = coalesce(il.tax_amount, 0),
       line_total = coalesce(il.line_total, greatest(coalesce(il.quantity, 1) * coalesce(il.unit_price, 0) - coalesce(il.discount, 0), 0) + coalesce(il.tax_amount, 0)),
       created_at = coalesce(il.created_at, now());
alter table public.accounting_invoice_lines alter column org_id set default public.current_org_id();
alter table public.accounting_invoice_lines alter column org_id set not null;
alter table public.accounting_invoice_lines alter column item set not null;
alter table public.accounting_invoice_lines alter column quantity set default 1;
alter table public.accounting_invoice_lines alter column quantity set not null;
alter table public.accounting_invoice_lines alter column unit_price set default 0;
alter table public.accounting_invoice_lines alter column unit_price set not null;
alter table public.accounting_invoice_lines alter column discount set default 0;
alter table public.accounting_invoice_lines alter column discount set not null;
alter table public.accounting_invoice_lines alter column tax set default 0;
alter table public.accounting_invoice_lines alter column tax set not null;
alter table public.accounting_invoice_lines alter column tax_rate set default 0;
alter table public.accounting_invoice_lines alter column tax_rate set not null;
alter table public.accounting_invoice_lines alter column tax_amount set default 0;
alter table public.accounting_invoice_lines alter column tax_amount set not null;
alter table public.accounting_invoice_lines alter column line_total set default 0;
alter table public.accounting_invoice_lines alter column line_total set not null;
alter table public.accounting_invoice_lines alter column created_at set default now();
alter table public.accounting_invoice_lines alter column created_at set not null;

create table if not exists public.accounting_credit_notes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org_id() references public.organizations(id) on delete cascade,
  credit_note_number text not null,
  invoice_id uuid references public.accounting_invoices(id) on delete set null,
  customer_id uuid not null references public.customers(id) on delete restrict,
  customer text,
  branch text,
  reason text not null,
  date timestamptz not null default now(),
  amount numeric(14,2) not null default 0,
  status text not null default 'approved',
  notes text,
  journal_entry_id uuid references public.accounting_journal_entries(id) on delete set null,
  created_by uuid references public.app_users(id) on delete set null default public.current_app_user_id(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.accounting_credit_notes add column if not exists org_id uuid references public.organizations(id) on delete cascade;
alter table public.accounting_credit_notes add column if not exists credit_note_number text;
alter table public.accounting_credit_notes add column if not exists invoice_id uuid;
alter table public.accounting_credit_notes add column if not exists customer_id uuid;
alter table public.accounting_credit_notes add column if not exists customer text;
alter table public.accounting_credit_notes add column if not exists branch text;
alter table public.accounting_credit_notes add column if not exists reason text;
alter table public.accounting_credit_notes add column if not exists date timestamptz;
alter table public.accounting_credit_notes add column if not exists amount numeric(14,2);
alter table public.accounting_credit_notes add column if not exists status text;
alter table public.accounting_credit_notes add column if not exists notes text;
alter table public.accounting_credit_notes add column if not exists journal_entry_id uuid;
alter table public.accounting_credit_notes add column if not exists created_by uuid references public.app_users(id) on delete set null default public.current_app_user_id();
alter table public.accounting_credit_notes add column if not exists created_at timestamptz;
alter table public.accounting_credit_notes add column if not exists updated_at timestamptz;
update public.accounting_credit_notes cn
   set org_id = coalesce(cn.org_id, (select inv.org_id from public.accounting_invoices inv where inv.id = cn.invoice_id), (select c.org_id from public.customers c where c.id = cn.customer_id), (select id from public.organizations order by created_at limit 1)),
       credit_note_number = coalesce(nullif(cn.credit_note_number, ''), 'CN-' || left(cn.id::text, 8)),
       customer_id = coalesce(cn.customer_id, (select inv.customer_id from public.accounting_invoices inv where inv.id = cn.invoice_id)),
       customer = coalesce(cn.customer, (select c.name from public.customers c where c.id = cn.customer_id)),
       reason = coalesce(nullif(cn.reason, ''), 'Credit note'),
       date = coalesce(cn.date, cn.created_at, now()),
       amount = coalesce(cn.amount, 0),
       status = coalesce(nullif(cn.status, ''), 'approved'),
       created_at = coalesce(cn.created_at, now()),
       updated_at = coalesce(cn.updated_at, cn.created_at, now());
alter table public.accounting_credit_notes alter column org_id set default public.current_org_id();
alter table public.accounting_credit_notes alter column org_id set not null;
alter table public.accounting_credit_notes alter column credit_note_number set not null;
alter table public.accounting_credit_notes alter column reason set not null;
alter table public.accounting_credit_notes alter column date set default now();
alter table public.accounting_credit_notes alter column date set not null;
alter table public.accounting_credit_notes alter column amount set default 0;
alter table public.accounting_credit_notes alter column amount set not null;
alter table public.accounting_credit_notes alter column status set default 'approved';
alter table public.accounting_credit_notes alter column status set not null;
alter table public.accounting_credit_notes alter column created_at set default now();
alter table public.accounting_credit_notes alter column created_at set not null;
alter table public.accounting_credit_notes alter column updated_at set default now();
alter table public.accounting_credit_notes alter column updated_at set not null;
alter table public.accounting_credit_notes drop constraint if exists accounting_credit_notes_status_check;
alter table public.accounting_credit_notes add constraint accounting_credit_notes_status_check
  check (status in ('draft', 'approved', 'void', 'posted')) not valid;

create table if not exists public.accounting_cogs_entries (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org_id() references public.organizations(id) on delete cascade,
  cogs_number text not null,
  date timestamptz not null default now(),
  branch text,
  invoice_id uuid references public.accounting_invoices(id) on delete set null,
  product_id uuid,
  product_service text,
  project text,
  description text,
  category text,
  quantity numeric(14,2) not null default 0,
  unit_cost numeric(14,2) not null default 0,
  total_cost numeric(14,2) not null default 0,
  direct_material_cost numeric(14,2) not null default 0,
  direct_labour_cost numeric(14,2) not null default 0,
  production_service_cost numeric(14,2) not null default 0,
  purchase_cost numeric(14,2) not null default 0,
  total_amount numeric(14,2) not null default 0,
  payment_account_id uuid references public.chart_account(id) on delete restrict,
  status text not null default 'approved',
  notes text,
  journal_entry_id uuid references public.accounting_journal_entries(id) on delete set null,
  created_by uuid references public.app_users(id) on delete set null default public.current_app_user_id(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.accounting_cogs_entries add column if not exists org_id uuid references public.organizations(id) on delete cascade;
alter table public.accounting_cogs_entries add column if not exists cogs_number text;
alter table public.accounting_cogs_entries add column if not exists date timestamptz;
alter table public.accounting_cogs_entries add column if not exists branch text;
alter table public.accounting_cogs_entries add column if not exists invoice_id uuid;
alter table public.accounting_cogs_entries add column if not exists product_id uuid;
alter table public.accounting_cogs_entries add column if not exists product_service text;
alter table public.accounting_cogs_entries add column if not exists project text;
alter table public.accounting_cogs_entries add column if not exists description text;
alter table public.accounting_cogs_entries add column if not exists category text;
alter table public.accounting_cogs_entries add column if not exists quantity numeric(14,2);
alter table public.accounting_cogs_entries add column if not exists unit_cost numeric(14,2);
alter table public.accounting_cogs_entries add column if not exists total_cost numeric(14,2);
alter table public.accounting_cogs_entries add column if not exists direct_material_cost numeric(14,2);
alter table public.accounting_cogs_entries add column if not exists direct_labour_cost numeric(14,2);
alter table public.accounting_cogs_entries add column if not exists production_service_cost numeric(14,2);
alter table public.accounting_cogs_entries add column if not exists purchase_cost numeric(14,2);
alter table public.accounting_cogs_entries add column if not exists total_amount numeric(14,2);
alter table public.accounting_cogs_entries add column if not exists payment_account_id uuid;
alter table public.accounting_cogs_entries add column if not exists status text;
alter table public.accounting_cogs_entries add column if not exists notes text;
alter table public.accounting_cogs_entries add column if not exists journal_entry_id uuid;
alter table public.accounting_cogs_entries add column if not exists created_by uuid references public.app_users(id) on delete set null default public.current_app_user_id();
alter table public.accounting_cogs_entries add column if not exists created_at timestamptz;
alter table public.accounting_cogs_entries add column if not exists updated_at timestamptz;
update public.accounting_cogs_entries ce
   set org_id = coalesce(ce.org_id, (select inv.org_id from public.accounting_invoices inv where inv.id = ce.invoice_id), (select id from public.organizations order by created_at limit 1)),
       cogs_number = coalesce(nullif(ce.cogs_number, ''), 'COGS-' || left(ce.id::text, 8)),
       date = coalesce(ce.date, ce.created_at, now()),
       product_service = coalesce(nullif(ce.product_service, ''), ce.description),
       category = coalesce(nullif(ce.category, ''), 'cost_of_goods_sold'),
       quantity = coalesce(ce.quantity, 0),
       unit_cost = coalesce(ce.unit_cost, 0),
       direct_material_cost = coalesce(ce.direct_material_cost, ce.total_cost, 0),
       direct_labour_cost = coalesce(ce.direct_labour_cost, 0),
       production_service_cost = coalesce(ce.production_service_cost, 0),
       purchase_cost = coalesce(ce.purchase_cost, 0),
       total_cost = coalesce(ce.total_cost, ce.total_amount, 0),
       total_amount = coalesce(ce.total_amount, ce.total_cost, 0),
       status = coalesce(nullif(ce.status, ''), 'approved'),
       created_at = coalesce(ce.created_at, now()),
       updated_at = coalesce(ce.updated_at, ce.created_at, now());
alter table public.accounting_cogs_entries alter column org_id set default public.current_org_id();
alter table public.accounting_cogs_entries alter column org_id set not null;
alter table public.accounting_cogs_entries alter column cogs_number set not null;
alter table public.accounting_cogs_entries alter column date set default now();
alter table public.accounting_cogs_entries alter column date set not null;
alter table public.accounting_cogs_entries alter column quantity set default 0;
alter table public.accounting_cogs_entries alter column quantity set not null;
alter table public.accounting_cogs_entries alter column unit_cost set default 0;
alter table public.accounting_cogs_entries alter column unit_cost set not null;
alter table public.accounting_cogs_entries alter column total_cost set default 0;
alter table public.accounting_cogs_entries alter column total_cost set not null;
alter table public.accounting_cogs_entries alter column direct_material_cost set default 0;
alter table public.accounting_cogs_entries alter column direct_material_cost set not null;
alter table public.accounting_cogs_entries alter column direct_labour_cost set default 0;
alter table public.accounting_cogs_entries alter column direct_labour_cost set not null;
alter table public.accounting_cogs_entries alter column production_service_cost set default 0;
alter table public.accounting_cogs_entries alter column production_service_cost set not null;
alter table public.accounting_cogs_entries alter column purchase_cost set default 0;
alter table public.accounting_cogs_entries alter column purchase_cost set not null;
alter table public.accounting_cogs_entries alter column total_amount set default 0;
alter table public.accounting_cogs_entries alter column total_amount set not null;
alter table public.accounting_cogs_entries alter column status set default 'approved';
alter table public.accounting_cogs_entries alter column status set not null;
alter table public.accounting_cogs_entries alter column created_at set default now();
alter table public.accounting_cogs_entries alter column created_at set not null;
alter table public.accounting_cogs_entries alter column updated_at set default now();
alter table public.accounting_cogs_entries alter column updated_at set not null;
alter table public.accounting_cogs_entries drop constraint if exists accounting_cogs_entries_status_check;
alter table public.accounting_cogs_entries add constraint accounting_cogs_entries_status_check
  check (status in ('draft', 'approved', 'void', 'posted')) not valid;

create table if not exists public.accounting_expense_entries (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org_id() references public.organizations(id) on delete cascade,
  expense_number text not null,
  expense_group text not null,
  date timestamptz not null default now(),
  payee text not null,
  branch text,
  description text,
  category text not null,
  amount numeric(14,2) not null default 0,
  payment_method text not null default 'cash',
  reference_number text,
  payment_account_id uuid references public.chart_account(id) on delete restrict,
  status text not null default 'approved',
  journal_entry_id uuid references public.accounting_journal_entries(id) on delete set null,
  created_by uuid references public.app_users(id) on delete set null default public.current_app_user_id(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.accounting_expense_entries add column if not exists org_id uuid references public.organizations(id) on delete cascade;
alter table public.accounting_expense_entries add column if not exists expense_number text;
alter table public.accounting_expense_entries add column if not exists expense_group text;
alter table public.accounting_expense_entries add column if not exists date timestamptz;
alter table public.accounting_expense_entries add column if not exists payee text;
alter table public.accounting_expense_entries add column if not exists branch text;
alter table public.accounting_expense_entries add column if not exists description text;
alter table public.accounting_expense_entries add column if not exists category text;
alter table public.accounting_expense_entries add column if not exists amount numeric(14,2);
alter table public.accounting_expense_entries add column if not exists payment_method text;
alter table public.accounting_expense_entries add column if not exists reference_number text;
alter table public.accounting_expense_entries add column if not exists payment_account_id uuid;
alter table public.accounting_expense_entries add column if not exists status text;
alter table public.accounting_expense_entries add column if not exists journal_entry_id uuid;
alter table public.accounting_expense_entries add column if not exists created_by uuid references public.app_users(id) on delete set null default public.current_app_user_id();
alter table public.accounting_expense_entries add column if not exists created_at timestamptz;
alter table public.accounting_expense_entries add column if not exists updated_at timestamptz;
alter table public.accounting_expense_entries drop constraint if exists accounting_expense_entries_expense_group_check;
alter table public.accounting_expense_entries drop constraint if exists accounting_expense_entries_status_check;
update public.accounting_expense_entries ee
   set org_id = coalesce(ee.org_id, (select ca.org_id from public.chart_account ca where ca.id = ee.payment_account_id), (select id from public.organizations order by created_at limit 1)),
       expense_number = coalesce(nullif(ee.expense_number, ''), 'OPEX-' || left(ee.id::text, 8)),
       expense_group = case
         when ee.expense_group = 'administrative_expenses' then 'administrative'
         when ee.expense_group = 'finance_charges' then 'finance'
         when ee.expense_group = 'other_operating_expenses' then 'other_operating'
         when ee.expense_group in ('administrative', 'finance', 'other_operating') then ee.expense_group
         else 'other_operating'
       end,
       date = coalesce(ee.date, ee.created_at, now()),
       payee = coalesce(nullif(ee.payee, ''), 'Unknown Payee'),
       category = coalesce(nullif(ee.category, ''), 'General Expense'),
       amount = coalesce(ee.amount, 0),
       payment_method = coalesce(nullif(ee.payment_method, ''), 'cash'),
       status = coalesce(nullif(ee.status, ''), 'approved'),
       created_at = coalesce(ee.created_at, now()),
       updated_at = coalesce(ee.updated_at, ee.created_at, now());
alter table public.accounting_expense_entries alter column org_id set default public.current_org_id();
alter table public.accounting_expense_entries alter column org_id set not null;
alter table public.accounting_expense_entries alter column expense_number set not null;
alter table public.accounting_expense_entries alter column expense_group set not null;
alter table public.accounting_expense_entries alter column date set default now();
alter table public.accounting_expense_entries alter column date set not null;
alter table public.accounting_expense_entries alter column payee set not null;
alter table public.accounting_expense_entries alter column category set not null;
alter table public.accounting_expense_entries alter column amount set default 0;
alter table public.accounting_expense_entries alter column amount set not null;
alter table public.accounting_expense_entries alter column payment_method set default 'cash';
alter table public.accounting_expense_entries alter column payment_method set not null;
alter table public.accounting_expense_entries alter column status set default 'approved';
alter table public.accounting_expense_entries alter column status set not null;
alter table public.accounting_expense_entries alter column created_at set default now();
alter table public.accounting_expense_entries alter column created_at set not null;
alter table public.accounting_expense_entries alter column updated_at set default now();
alter table public.accounting_expense_entries alter column updated_at set not null;
alter table public.accounting_expense_entries add constraint accounting_expense_entries_expense_group_check
  check (expense_group in ('administrative', 'finance', 'other_operating')) not valid;
alter table public.accounting_expense_entries add constraint accounting_expense_entries_status_check
  check (status in ('draft', 'approved', 'void', 'posted')) not valid;

-- Migrate old operating expense table if present.
do $$
begin
  if to_regclass('public.accounting_operating_expenses') is not null then
    insert into public.accounting_expense_entries (
      id, org_id, expense_number, expense_group, date, payee, branch, description,
      category, amount, payment_method, reference_number, payment_account_id,
      status, journal_entry_id, created_by, created_at, updated_at
    )
    select
      id, org_id, expense_number,
      case
        when expense_group = 'administrative_expenses' then 'administrative'
        when expense_group = 'finance_charges' then 'finance'
        when expense_group = 'other_operating_expenses' then 'other_operating'
        else expense_group
      end,
      date, payee, branch, description,
      category, amount, payment_method, reference_number, payment_account_id,
      status, journal_entry_id, created_by, created_at, created_at
    from public.accounting_operating_expenses
    on conflict (id) do nothing;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- FK constraints for existing tables. NOT VALID avoids failing on old rows while
-- still enforcing all new writes and exposing relationships to PostgREST.
-- ---------------------------------------------------------------------------

alter table public.accounting_cash_transactions drop constraint if exists accounting_cash_transactions_journal_entry_id_fkey;
alter table public.accounting_invoices drop constraint if exists accounting_invoices_journal_entry_id_fkey;
alter table public.accounting_credit_notes drop constraint if exists accounting_credit_notes_journal_entry_id_fkey;
alter table public.accounting_cogs_entries drop constraint if exists accounting_cogs_entries_journal_entry_id_fkey;
alter table public.accounting_expense_entries drop constraint if exists accounting_expense_entries_journal_entry_id_fkey;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'accounting_cash_accounts_chart_account_id_fkey' and conrelid = 'public.accounting_cash_accounts'::regclass) then
    alter table public.accounting_cash_accounts add constraint accounting_cash_accounts_chart_account_id_fkey foreign key (chart_account_id) references public.chart_account(id) on delete restrict not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'accounting_cash_transactions_cash_account_id_fkey' and conrelid = 'public.accounting_cash_transactions'::regclass) then
    alter table public.accounting_cash_transactions add constraint accounting_cash_transactions_cash_account_id_fkey foreign key (cash_account_id) references public.accounting_cash_accounts(id) on delete restrict not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'accounting_bank_reconciliations_cash_account_id_fkey' and conrelid = 'public.accounting_bank_reconciliations'::regclass) then
    alter table public.accounting_bank_reconciliations add constraint accounting_bank_reconciliations_cash_account_id_fkey foreign key (cash_account_id) references public.accounting_cash_accounts(id) on delete restrict not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'accounting_invoices_customer_id_fkey' and conrelid = 'public.accounting_invoices'::regclass) then
    alter table public.accounting_invoices add constraint accounting_invoices_customer_id_fkey foreign key (customer_id) references public.customers(id) on delete restrict not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'accounting_invoice_lines_invoice_id_fkey' and conrelid = 'public.accounting_invoice_lines'::regclass) then
    alter table public.accounting_invoice_lines add constraint accounting_invoice_lines_invoice_id_fkey foreign key (invoice_id) references public.accounting_invoices(id) on delete cascade not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'accounting_credit_notes_invoice_id_fkey' and conrelid = 'public.accounting_credit_notes'::regclass) then
    alter table public.accounting_credit_notes add constraint accounting_credit_notes_invoice_id_fkey foreign key (invoice_id) references public.accounting_invoices(id) on delete set null not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'accounting_credit_notes_customer_id_fkey' and conrelid = 'public.accounting_credit_notes'::regclass) then
    alter table public.accounting_credit_notes add constraint accounting_credit_notes_customer_id_fkey foreign key (customer_id) references public.customers(id) on delete restrict not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'accounting_cogs_entries_invoice_id_fkey' and conrelid = 'public.accounting_cogs_entries'::regclass) then
    alter table public.accounting_cogs_entries add constraint accounting_cogs_entries_invoice_id_fkey foreign key (invoice_id) references public.accounting_invoices(id) on delete set null not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'accounting_expense_entries_payment_account_id_fkey' and conrelid = 'public.accounting_expense_entries'::regclass) then
    alter table public.accounting_expense_entries add constraint accounting_expense_entries_payment_account_id_fkey foreign key (payment_account_id) references public.chart_account(id) on delete restrict not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'accounting_cogs_entries_payment_account_id_fkey' and conrelid = 'public.accounting_cogs_entries'::regclass) then
    alter table public.accounting_cogs_entries add constraint accounting_cogs_entries_payment_account_id_fkey foreign key (payment_account_id) references public.chart_account(id) on delete restrict not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'accounting_cash_transactions_journal_entry_id_fkey' and conrelid = 'public.accounting_cash_transactions'::regclass) then
    alter table public.accounting_cash_transactions add constraint accounting_cash_transactions_journal_entry_id_fkey foreign key (journal_entry_id) references public.accounting_journal_entries(id) on delete set null not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'accounting_invoices_journal_entry_id_fkey' and conrelid = 'public.accounting_invoices'::regclass) then
    alter table public.accounting_invoices add constraint accounting_invoices_journal_entry_id_fkey foreign key (journal_entry_id) references public.accounting_journal_entries(id) on delete set null not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'accounting_credit_notes_journal_entry_id_fkey' and conrelid = 'public.accounting_credit_notes'::regclass) then
    alter table public.accounting_credit_notes add constraint accounting_credit_notes_journal_entry_id_fkey foreign key (journal_entry_id) references public.accounting_journal_entries(id) on delete set null not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'accounting_cogs_entries_journal_entry_id_fkey' and conrelid = 'public.accounting_cogs_entries'::regclass) then
    alter table public.accounting_cogs_entries add constraint accounting_cogs_entries_journal_entry_id_fkey foreign key (journal_entry_id) references public.accounting_journal_entries(id) on delete set null not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'accounting_expense_entries_journal_entry_id_fkey' and conrelid = 'public.accounting_expense_entries'::regclass) then
    alter table public.accounting_expense_entries add constraint accounting_expense_entries_journal_entry_id_fkey foreign key (journal_entry_id) references public.accounting_journal_entries(id) on delete set null not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'accounting_journal_lines_journal_entry_id_fkey' and conrelid = 'public.accounting_journal_lines'::regclass) then
    alter table public.accounting_journal_lines add constraint accounting_journal_lines_journal_entry_id_fkey foreign key (journal_entry_id) references public.accounting_journal_entries(id) on delete cascade not valid;
  end if;
end $$;

-- Older accounting operation tables are not used directly by /accounting/chart,
-- but their RPCs call post_journal_entry. Keep those journal references aligned
-- with the canonical journal table this migration installs.
do $$
begin
  if to_regclass('public.accounting_bills') is not null then
    execute 'alter table public.accounting_bills drop constraint if exists accounting_bills_journal_entry_id_fkey';
    if not exists (
      select 1 from pg_constraint
       where conname = 'accounting_bills_journal_entry_id_fkey'
         and conrelid = 'public.accounting_bills'::regclass
    ) then
      execute 'alter table public.accounting_bills add constraint accounting_bills_journal_entry_id_fkey foreign key (journal_entry_id) references public.accounting_journal_entries(id) on delete set null not valid';
    end if;
  end if;

  if to_regclass('public.accounting_expenses') is not null then
    execute 'alter table public.accounting_expenses drop constraint if exists accounting_expenses_journal_entry_id_fkey';
    if not exists (
      select 1 from pg_constraint
       where conname = 'accounting_expenses_journal_entry_id_fkey'
         and conrelid = 'public.accounting_expenses'::regclass
    ) then
      execute 'alter table public.accounting_expenses add constraint accounting_expenses_journal_entry_id_fkey foreign key (journal_entry_id) references public.accounting_journal_entries(id) on delete set null not valid';
    end if;
  end if;

  if to_regclass('public.accounting_payments') is not null then
    execute 'alter table public.accounting_payments drop constraint if exists accounting_payments_journal_entry_id_fkey';
    if not exists (
      select 1 from pg_constraint
       where conname = 'accounting_payments_journal_entry_id_fkey'
         and conrelid = 'public.accounting_payments'::regclass
    ) then
      execute 'alter table public.accounting_payments add constraint accounting_payments_journal_entry_id_fkey foreign key (journal_entry_id) references public.accounting_journal_entries(id) on delete set null not valid';
    end if;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Indexes for chart page filters, joins, and FKs.
-- ---------------------------------------------------------------------------

create unique index if not exists accounting_cash_accounts_org_chart_uniq on public.accounting_cash_accounts (org_id, chart_account_id);
create index if not exists accounting_cash_accounts_org_kind_idx on public.accounting_cash_accounts (org_id, account_type, status);
create index if not exists accounting_cash_accounts_chart_account_id_idx on public.accounting_cash_accounts (chart_account_id);
create unique index if not exists accounting_cash_transactions_org_number_uniq on public.accounting_cash_transactions (org_id, transaction_number);
create index if not exists accounting_cash_transactions_org_account_idx on public.accounting_cash_transactions (org_id, cash_account_id, date);
create index if not exists accounting_cash_transactions_cash_account_id_idx on public.accounting_cash_transactions (cash_account_id);
drop index if exists accounting_bank_reconciliations_org_number_uniq;
create unique index if not exists accounting_bank_reconciliations_org_number_uniq on public.accounting_bank_reconciliations (org_id, reconciliation_number);
create index if not exists accounting_bank_reconciliations_cash_account_id_idx on public.accounting_bank_reconciliations (cash_account_id);
create unique index if not exists accounting_invoices_org_number_uniq on public.accounting_invoices (org_id, invoice_number);
create index if not exists accounting_invoices_customer_id_idx on public.accounting_invoices (customer_id);
create index if not exists accounting_invoices_org_date_idx on public.accounting_invoices (org_id, date);
create index if not exists accounting_invoice_lines_invoice_id_idx on public.accounting_invoice_lines (invoice_id);
create unique index if not exists accounting_credit_notes_org_number_uniq on public.accounting_credit_notes (org_id, credit_note_number);
create index if not exists accounting_credit_notes_invoice_id_idx on public.accounting_credit_notes (invoice_id);
create index if not exists accounting_credit_notes_customer_id_idx on public.accounting_credit_notes (customer_id);
create unique index if not exists accounting_cogs_entries_org_number_uniq on public.accounting_cogs_entries (org_id, cogs_number);
create index if not exists accounting_cogs_entries_invoice_id_idx on public.accounting_cogs_entries (invoice_id);
create index if not exists accounting_cogs_entries_org_date_idx on public.accounting_cogs_entries (org_id, date);
create unique index if not exists accounting_expense_entries_org_number_uniq on public.accounting_expense_entries (org_id, expense_number);
create index if not exists accounting_expense_entries_org_group_idx on public.accounting_expense_entries (org_id, expense_group, date);
create index if not exists accounting_expense_entries_payment_account_id_idx on public.accounting_expense_entries (payment_account_id);
create index if not exists suppliers_org_name_idx on public.suppliers (org_id, name);

-- ---------------------------------------------------------------------------
-- RLS policies.
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'chart_account',
    'accounting_journal_entries',
    'accounting_journal_lines',
    'suppliers',
    'accounting_cash_accounts',
    'accounting_cash_transactions',
    'accounting_bank_reconciliations',
    'accounting_invoices',
    'accounting_invoice_lines',
    'accounting_credit_notes',
    'accounting_cogs_entries',
    'accounting_expense_entries'
  ]
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists %1$s_select on public.%1$I;', t);
    execute format('drop policy if exists %1$s_insert on public.%1$I;', t);
    execute format('drop policy if exists %1$s_update on public.%1$I;', t);
    execute format('drop policy if exists %1$s_delete on public.%1$I;', t);
    execute format($f$
      create policy %1$s_select on public.%1$I for select to authenticated
        using (org_id = public.current_org_id());
      create policy %1$s_insert on public.%1$I for insert to authenticated
        with check (org_id = public.current_org_id() and public.current_app_user_id() is not null);
      create policy %1$s_update on public.%1$I for update to authenticated
        using (org_id = public.current_org_id())
        with check (org_id = public.current_org_id());
      create policy %1$s_delete on public.%1$I for delete to authenticated
        using (org_id = public.current_org_id() and public.current_app_role() = 'admin');
    $f$, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Posting helpers and RPCs used by /accounting/chart.
-- ---------------------------------------------------------------------------

create or replace function public._accounting_system_account(p_org uuid, p_key text)
returns uuid language plpgsql stable security definer set search_path = public as $$
declare
  account uuid;
begin
  select id into account
    from public.chart_account
   where org_id = p_org
     and is_active = true
     and description = 'key:' || p_key
   order by code
   limit 1;
  return account;
end $$;

create or replace function public._next_journal_entry_number(p_org uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  yr text := to_char(now(), 'YYYY');
  n int;
begin
  select coalesce(max(substring(entry_number from '[0-9]+$')::int), 0) + 1
    into n
    from public.accounting_journal_entries
   where org_id = p_org
     and entry_number like 'JE-' || yr || '-%';

  return 'JE-' || yr || '-' || lpad(n::text, 6, '0');
end $$;

create or replace function public._charts_next_number(p_org uuid, p_table text, p_column text, p_prefix text)
returns text language plpgsql security definer set search_path = public as $$
declare
  yr text := to_char(now(), 'YYYY');
  n int;
begin
  execute format(
    'select coalesce(max(substring(%1$I from ''[0-9]+$'')::int), 0) + 1 from public.%2$I where org_id = $1 and %1$I like $2',
    p_column,
    p_table
  )
  into n
  using p_org, p_prefix || '-' || yr || '-%';

  return p_prefix || '-' || yr || '-' || lpad(n::text, 6, '0');
end $$;

create or replace function public._next_accounting_doc_number(p_org uuid, p_kind text, p_prefix text)
returns text language plpgsql security definer set search_path = public as $$
declare
  target_table text := case p_kind
    when 'invoice' then 'accounting_invoices'
    when 'expense' then 'accounting_expense_entries'
    else p_kind
  end;
  target_column text := case p_kind
    when 'invoice' then 'invoice_number'
    when 'expense' then 'expense_number'
    else p_kind || '_number'
  end;
begin
  return public._charts_next_number(p_org, target_table, target_column, p_prefix);
end $$;

create or replace function public._charts_next_cash_account_code(p_org uuid, p_kind text)
returns text language plpgsql security definer set search_path = public as $$
declare
  start_code int := case when p_kind = 'cash' then 1000 else 1020 end;
  end_code int := case when p_kind = 'cash' then 1020 else 1100 end;
  max_code int;
  candidate text;
begin
  select coalesce(max(code::int), start_code)
    into max_code
    from public.chart_account
   where org_id = p_org
     and code ~ '^[0-9]+$'
     and code::int >= start_code
     and code::int < end_code;

  candidate := (max_code + 1)::text;
  while exists (select 1 from public.chart_account where org_id = p_org and code = candidate) loop
    candidate := (candidate::int + 1)::text;
  end loop;
  return candidate;
end $$;

create or replace function public._charts_default_payment_account(p_org uuid)
returns uuid language plpgsql stable security definer set search_path = public as $$
declare
  account uuid;
begin
  select ca.chart_account_id into account
    from public.accounting_cash_accounts ca
   where ca.org_id = p_org and ca.status = 'active'
   order by case ca.account_type when 'cash_in_hand' then 0 else 1 end, ca.created_at
   limit 1;

  if account is not null then return account; end if;

  return public._accounting_system_account(p_org, 'cash_on_hand');
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
  if me is null or org is null then raise exception 'User not logged in'; end if;
  if public.current_app_role() not in ('admin', 'manager') then raise exception 'Permission denied'; end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' then raise exception 'Journal lines must be an array'; end if;

  for line in select value from jsonb_array_elements(p_lines) as t(value) loop
    account := coalesce(nullif(line->>'chart_account_id', ''), nullif(line->>'account_id', ''), nullif(line->>'accountId', ''))::uuid;
    debit_amt := round(coalesce(nullif(line->>'debit', '')::numeric, 0), 2);
    credit_amt := round(coalesce(nullif(line->>'credit', '')::numeric, 0), 2);
    if account is null then raise exception 'Every journal line needs an account'; end if;
    if not exists (
      select 1 from public.chart_account
       where id = account and org_id = org and is_active = true and is_postable = true
    ) then
      raise exception 'Account not found or not postable';
    end if;
    if debit_amt < 0 or credit_amt < 0 then raise exception 'Debit and credit amounts must be positive'; end if;
    if debit_amt > 0 and credit_amt > 0 then raise exception 'A line cannot have both debit and credit'; end if;
    if debit_amt = 0 and credit_amt = 0 then continue; end if;
    total_debit := total_debit + debit_amt;
    total_credit := total_credit + credit_amt;
    line_count := line_count + 1;
  end loop;

  total_debit := round(total_debit, 2);
  total_credit := round(total_credit, 2);
  if line_count < 2 then raise exception 'A journal entry needs at least two non-zero lines'; end if;
  if total_debit <> total_credit then raise exception 'Journal entry does not balance: debits % credits %', total_debit, total_credit; end if;
  if total_debit = 0 then raise exception 'Journal entry total cannot be zero'; end if;

  entry_no := public._next_journal_entry_number(org);
  insert into public.accounting_journal_entries (
    org_id, journal_number, entry_number, date, description, memo, source,
    source_type, source_id, total_debit, total_credit, status, posted_at, posted_by, created_by
  )
  values (
    org, entry_no, entry_no, p_date::timestamptz, nullif(p_memo, ''), nullif(p_memo, ''),
    coalesce(nullif(p_source, ''), 'MANUAL'), nullif(p_source_type, ''),
    nullif(p_source_id, ''), total_debit, total_credit, 'POSTED', now(), me, me
  )
  returning id into entry_id;

  for line in select value from jsonb_array_elements(p_lines) as t(value) loop
    account := coalesce(nullif(line->>'chart_account_id', ''), nullif(line->>'account_id', ''), nullif(line->>'accountId', ''))::uuid;
    debit_amt := round(coalesce(nullif(line->>'debit', '')::numeric, 0), 2);
    credit_amt := round(coalesce(nullif(line->>'credit', '')::numeric, 0), 2);
    if debit_amt = 0 and credit_amt = 0 then continue; end if;

    insert into public.accounting_journal_lines (
      org_id, journal_entry_id, chart_account_id, account_id, debit, credit, description
    )
    values (
      org, entry_id, account, account, debit_amt, credit_amt,
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

create or replace function public.create_cash_book_account(
  p_account_kind text,
  p_account_name text,
  p_bank_name text,
  p_account_number text,
  p_branch text,
  p_opening_balance numeric,
  p_status text default 'active'
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me uuid := public.current_app_user_id();
  org uuid := public.current_org_id();
  kind text := lower(btrim(coalesce(p_account_kind, '')));
  clean_name text := btrim(coalesce(p_account_name, ''));
  account_code text;
  chart_id uuid;
  cash_id uuid;
  parent uuid;
  equity_account uuid;
  opening numeric(14,2) := round(coalesce(p_opening_balance, 0), 2);
  journal jsonb;
begin
  if me is null or org is null then raise exception 'User not logged in'; end if;
  if public.current_app_role() not in ('admin', 'manager') then raise exception 'Permission denied'; end if;
  if kind in ('cash_at_bank') then kind := 'bank'; end if;
  if kind in ('cash_in_hand') then kind := 'cash'; end if;
  if kind not in ('bank', 'cash') then raise exception 'Account kind must be bank or cash'; end if;
  if clean_name = '' then raise exception 'Account name is required'; end if;

  select id into parent
    from public.chart_account
   where org_id = org
     and code = case when kind = 'bank' then '1010' else '1020' end
   limit 1;

  account_code := public._charts_next_cash_account_code(org, kind);
  insert into public.chart_account (
    org_id, code, name, type, normal_balance, category, sub_category,
    classification, statement_group, currency, parent_id, description,
    vat_applicable, is_bank, is_system, is_active, is_postable, created_by
  )
  values (
    org, account_code, clean_name, 'ASSET', 'DEBIT', 'cash_book', kind,
    'BANK', 'CURRENT_ASSETS', 'KES', parent, 'cashbook:' || kind,
    false, kind = 'bank', false, coalesce(p_status, 'active') = 'active', true, me
  )
  returning id into chart_id;

  insert into public.accounting_cash_accounts (
    org_id, chart_account_id, account_type, account_name, sub_category,
    bank_name, account_number, branch, opening_balance, current_balance,
    status, created_by
  )
  values (
    org, chart_id, case when kind = 'bank' then 'cash_at_bank' else 'cash_in_hand' end,
    clean_name, kind, nullif(btrim(coalesce(p_bank_name, '')), ''),
    nullif(btrim(coalesce(p_account_number, '')), ''), nullif(btrim(coalesce(p_branch, '')), ''),
    opening, opening, case when coalesce(p_status, 'active') = 'inactive' then 'inactive' else 'active' end, me
  )
  returning id into cash_id;

  if opening <> 0 then
    select id into equity_account
      from public.chart_account
     where org_id = org
       and is_active = true
       and is_postable = true
       and (name ilike 'Opening Balance Equity%' or description = 'key:retained_earnings' or type = 'EQUITY')
     order by case when name ilike 'Opening Balance Equity%' then 0 when description = 'key:retained_earnings' then 1 else 2 end, code
     limit 1;
    if equity_account is null then raise exception 'Opening balance equity account missing. Seed the chart of accounts.'; end if;

    journal := public.post_journal_entry(
      current_date,
      'Opening balance - ' || clean_name,
      'OPENING_BALANCE',
      'CashBookAccount',
      cash_id::text,
      case when opening > 0 then
        jsonb_build_array(
          jsonb_build_object('account_id', chart_id, 'debit', abs(opening), 'description', 'Opening balance'),
          jsonb_build_object('account_id', equity_account, 'credit', abs(opening), 'description', 'Opening balance equity')
        )
      else
        jsonb_build_array(
          jsonb_build_object('account_id', equity_account, 'debit', abs(opening), 'description', 'Opening balance equity'),
          jsonb_build_object('account_id', chart_id, 'credit', abs(opening), 'description', 'Opening balance')
        )
      end
    );
  end if;

  return jsonb_build_object('success', true, 'cash_account_id', cash_id, 'chart_account_id', chart_id, 'code', account_code);
end $$;

create or replace function public.post_cash_book_transaction(
  p_cash_account_id uuid,
  p_date date,
  p_transaction_type text,
  p_direction text,
  p_amount numeric,
  p_offset_account_id uuid,
  p_description text,
  p_reference_number text
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me uuid := public.current_app_user_id();
  org uuid := public.current_org_id();
  cash_chart uuid;
  txn_id uuid;
  txn_no text;
  dir text := lower(btrim(coalesce(p_direction, '')));
  amount numeric(14,2) := round(coalesce(p_amount, 0), 2);
  debit_amt numeric(14,2) := 0;
  credit_amt numeric(14,2) := 0;
  next_balance numeric(14,2);
  journal jsonb;
begin
  if me is null or org is null then raise exception 'User not logged in'; end if;
  if public.current_app_role() not in ('admin', 'manager') then raise exception 'Permission denied'; end if;
  if amount <= 0 then raise exception 'Amount must be positive'; end if;
  if dir not in ('debit_cash', 'credit_cash') then raise exception 'Direction must be debit_cash or credit_cash'; end if;

  select chart_account_id into cash_chart
    from public.accounting_cash_accounts
   where id = p_cash_account_id
     and org_id = org
     and status = 'active';
  if cash_chart is null then raise exception 'Cash or bank account not found'; end if;

  if not exists (
    select 1 from public.chart_account
     where id = p_offset_account_id
       and org_id = org
       and is_active = true
       and is_postable = true
  ) then
    raise exception 'Offset account not found';
  end if;

  if dir = 'debit_cash' then debit_amt := amount; else credit_amt := amount; end if;
  txn_no := public._charts_next_number(org, 'accounting_cash_transactions', 'transaction_number', 'CBK');
  next_balance := (
    select current_balance + debit_amt - credit_amt
      from public.accounting_cash_accounts
     where id = p_cash_account_id
  );

  insert into public.accounting_cash_transactions (
    org_id, cash_account_id, transaction_number, transaction_type, date,
    transaction_date, reference_number, description, offset_account_id,
    chart_account_id, debit, credit, running_balance, created_by
  )
  values (
    org, p_cash_account_id, txn_no, coalesce(nullif(p_transaction_type, ''), 'Journal Entry'),
    p_date::timestamptz, p_date, coalesce(nullif(p_reference_number, ''), txn_no),
    nullif(p_description, ''), p_offset_account_id, p_offset_account_id,
    debit_amt, credit_amt, next_balance, me
  )
  returning id into txn_id;

  journal := public.post_journal_entry(
    p_date,
    coalesce(nullif(p_description, ''), coalesce(nullif(p_transaction_type, ''), 'Cash book transaction') || ' ' || txn_no),
    'CASH_BOOK',
    'CashTransaction',
    txn_id::text,
    case when dir = 'debit_cash' then
      jsonb_build_array(
        jsonb_build_object('account_id', cash_chart, 'debit', amount, 'description', coalesce(nullif(p_transaction_type, ''), 'Cash book debit')),
        jsonb_build_object('account_id', p_offset_account_id, 'credit', amount, 'description', 'Offset')
      )
    else
      jsonb_build_array(
        jsonb_build_object('account_id', p_offset_account_id, 'debit', amount, 'description', 'Offset'),
        jsonb_build_object('account_id', cash_chart, 'credit', amount, 'description', coalesce(nullif(p_transaction_type, ''), 'Cash book credit'))
      )
    end
  );

  update public.accounting_cash_transactions
     set journal_entry_id = (journal->>'id')::uuid
   where id = txn_id;
  update public.accounting_cash_accounts
     set current_balance = next_balance
   where id = p_cash_account_id;

  return jsonb_build_object(
    'success', true,
    'transaction_id', txn_id,
    'transaction_number', txn_no,
    'transactionNumber', txn_no,
    'entry_number', journal->>'entry_number',
    'entryNumber', journal->>'entry_number'
  );
end $$;

create or replace function public.create_bank_reconciliation(
  p_cash_account_id uuid,
  p_statement_date date,
  p_statement_balance numeric,
  p_notes text
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me uuid := public.current_app_user_id();
  org uuid := public.current_org_id();
  cash_chart uuid;
  rec_id uuid;
  rec_no text;
  statement_amt numeric(14,2) := round(coalesce(p_statement_balance, 0), 2);
  system_amt numeric(14,2);
begin
  if me is null or org is null then raise exception 'User not logged in'; end if;
  if public.current_app_role() not in ('admin', 'manager') then raise exception 'Permission denied'; end if;

  select chart_account_id into cash_chart
    from public.accounting_cash_accounts
   where id = p_cash_account_id
     and org_id = org
     and account_type = 'cash_at_bank';
  if cash_chart is null then raise exception 'Bank account not found'; end if;

  select round(coalesce(sum(ll.debit - ll.credit), 0), 2)
    into system_amt
    from public.accounting_journal_lines ll
    join public.accounting_journal_entries je on je.id = ll.journal_entry_id
   where ll.org_id = org
     and je.org_id = org
     and je.status = 'POSTED'
     and ll.chart_account_id = cash_chart
     and je.date::date <= p_statement_date;

  rec_no := public._charts_next_number(org, 'accounting_bank_reconciliations', 'reconciliation_number', 'REC');
  insert into public.accounting_bank_reconciliations (
    org_id, cash_account_id, reconciliation_number, statement_date, reconciliation_date,
    statement_balance, system_balance, book_balance, difference, status, notes, created_by
  )
  values (
    org, p_cash_account_id, rec_no, p_statement_date, p_statement_date,
    statement_amt, system_amt, system_amt, statement_amt - system_amt,
    case when abs(statement_amt - system_amt) < 0.01 then 'reconciled' else 'open' end,
    nullif(p_notes, ''), me
  )
  returning id into rec_id;

  return jsonb_build_object('success', true, 'reconciliation_id', rec_id, 'reconciliation_number', rec_no);
end $$;

create or replace function public.post_customer_invoice(
  p_customer_id uuid,
  p_invoice_date date,
  p_due_date date,
  p_branch text,
  p_sales_person text,
  p_payment_terms text,
  p_notes text,
  p_lines jsonb
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me uuid := public.current_app_user_id();
  org uuid := public.current_org_id();
  invoice_id uuid;
  invoice_no text;
  customer_name text;
  ar_account uuid;
  sales_account uuid;
  vat_account uuid;
  line jsonb;
  item_name text;
  qty numeric(14,2);
  unit_amt numeric(14,2);
  discount_amt numeric(14,2);
  tax_rate numeric(7,4);
  line_net numeric(14,2);
  line_tax numeric(14,2);
  line_total numeric(14,2);
  net_amt numeric(14,2) := 0;
  discount_total numeric(14,2) := 0;
  vat_amt numeric(14,2) := 0;
  gross_amt numeric(14,2) := 0;
  journal jsonb;
  journal_lines jsonb;
begin
  if me is null or org is null then raise exception 'User not logged in'; end if;
  if public.current_app_role() not in ('admin', 'manager') then raise exception 'Permission denied'; end if;
  select name into customer_name from public.customers where id = p_customer_id and org_id = org;
  if customer_name is null then raise exception 'Customer not found'; end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' then raise exception 'Invoice lines are required'; end if;

  ar_account := public._accounting_system_account(org, 'accounts_receivable');
  sales_account := public._accounting_system_account(org, 'sales_revenue');
  vat_account := public._accounting_system_account(org, 'vat_output');
  if ar_account is null or sales_account is null then raise exception 'Accounts Receivable or Sales Revenue account missing. Seed the chart of accounts.'; end if;

  for line in select value from jsonb_array_elements(p_lines) as t(value) loop
    item_name := btrim(coalesce(line->>'item', line->>'product_service', ''));
    qty := round(coalesce(nullif(line->>'quantity', '')::numeric, 0), 2);
    unit_amt := round(coalesce(coalesce(nullif(line->>'unit_price', ''), nullif(line->>'unitPrice', ''))::numeric, 0), 2);
    discount_amt := round(coalesce(nullif(line->>'discount', '')::numeric, 0), 2);
    tax_rate := round(coalesce(coalesce(nullif(line->>'tax', ''), nullif(line->>'tax_rate', ''))::numeric, 0), 4);
    if item_name = '' then raise exception 'Every invoice line needs a product or service'; end if;
    if qty <= 0 or unit_amt < 0 or discount_amt < 0 then raise exception 'Invoice line values are invalid'; end if;
    line_net := greatest(round((qty * unit_amt) - discount_amt, 2), 0);
    line_tax := round(line_net * (tax_rate / 100), 2);
    line_total := line_net + line_tax;
    net_amt := net_amt + line_net;
    discount_total := discount_total + discount_amt;
    vat_amt := vat_amt + line_tax;
    gross_amt := gross_amt + line_total;
  end loop;
  if gross_amt <= 0 then raise exception 'Invoice total must be positive'; end if;
  if vat_amt > 0 and vat_account is null then raise exception 'VAT Output account missing. Seed the chart of accounts.'; end if;

  invoice_no := public._next_accounting_doc_number(org, 'invoice', 'INV');
  insert into public.accounting_invoices (
    org_id, invoice_number, customer_id, customer, date, invoice_date, due_date,
    status, has_vat, subtotal, discount_total, tax_total, net_amount, vat_amount,
    total_amount, outstanding_balance, memo, branch, sales_person, payment_terms, notes, created_by
  )
  values (
    org, invoice_no, p_customer_id, customer_name, p_invoice_date::timestamptz,
    p_invoice_date, p_due_date::timestamptz, 'posted', vat_amt > 0,
    net_amt + discount_total, discount_total, vat_amt, net_amt, vat_amt,
    gross_amt, gross_amt, nullif(p_notes, ''), nullif(p_branch, ''),
    nullif(p_sales_person, ''), nullif(p_payment_terms, ''), nullif(p_notes, ''), me
  )
  returning id into invoice_id;

  for line in select value from jsonb_array_elements(p_lines) as t(value) loop
    item_name := btrim(coalesce(line->>'item', line->>'product_service', ''));
    qty := round(coalesce(nullif(line->>'quantity', '')::numeric, 0), 2);
    unit_amt := round(coalesce(coalesce(nullif(line->>'unit_price', ''), nullif(line->>'unitPrice', ''))::numeric, 0), 2);
    discount_amt := round(coalesce(nullif(line->>'discount', '')::numeric, 0), 2);
    tax_rate := round(coalesce(coalesce(nullif(line->>'tax', ''), nullif(line->>'tax_rate', ''))::numeric, 0), 4);
    line_net := greatest(round((qty * unit_amt) - discount_amt, 2), 0);
    line_tax := round(line_net * (tax_rate / 100), 2);
    line_total := line_net + line_tax;
    insert into public.accounting_invoice_lines (
      org_id, invoice_id, item, product_service, quantity, unit_price,
      discount, tax, tax_rate, tax_amount, line_total
    )
    values (org, invoice_id, item_name, item_name, qty, unit_amt, discount_amt, tax_rate, tax_rate, line_tax, line_total);
  end loop;

  journal_lines := jsonb_build_array(
    jsonb_build_object('account_id', ar_account, 'debit', gross_amt, 'description', 'Customer invoice')
  );
  if vat_amt > 0 then
    journal_lines := journal_lines || jsonb_build_array(
      jsonb_build_object('account_id', vat_account, 'credit', vat_amt, 'description', 'VAT output')
    );
  end if;
  journal_lines := journal_lines || jsonb_build_array(
    jsonb_build_object('account_id', sales_account, 'credit', net_amt, 'description', 'Revenue')
  );

  journal := public.post_journal_entry(p_invoice_date, 'Invoice ' || invoice_no, 'SALE', 'Invoice', invoice_id::text, journal_lines);
  update public.accounting_invoices
     set journal_entry_id = (journal->>'id')::uuid
   where id = invoice_id;

  return jsonb_build_object('success', true, 'invoice_id', invoice_id, 'invoice_number', invoice_no, 'invoiceNumber', invoice_no, 'entryNumber', journal->>'entry_number');
end $$;

create or replace function public.post_credit_note(
  p_invoice_id uuid,
  p_customer_id uuid,
  p_branch text,
  p_reason text,
  p_date date,
  p_amount numeric,
  p_notes text
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me uuid := public.current_app_user_id();
  org uuid := public.current_org_id();
  note_id uuid;
  note_no text;
  customer uuid := p_customer_id;
  customer_name text;
  amount numeric(14,2) := round(coalesce(p_amount, 0), 2);
  ar_account uuid;
  sales_account uuid;
  journal jsonb;
begin
  if me is null or org is null then raise exception 'User not logged in'; end if;
  if public.current_app_role() not in ('admin', 'manager') then raise exception 'Permission denied'; end if;
  if amount <= 0 then raise exception 'Amount must be positive'; end if;
  if p_invoice_id is not null then
    select customer_id into customer from public.accounting_invoices where id = p_invoice_id and org_id = org;
    if customer is null then raise exception 'Linked invoice not found'; end if;
  end if;
  select name into customer_name from public.customers where id = customer and org_id = org;
  if customer_name is null then raise exception 'Customer not found'; end if;

  ar_account := public._accounting_system_account(org, 'accounts_receivable');
  sales_account := public._accounting_system_account(org, 'sales_revenue');
  if ar_account is null or sales_account is null then raise exception 'Accounts Receivable or Sales Revenue account missing. Seed the chart of accounts.'; end if;

  note_no := public._charts_next_number(org, 'accounting_credit_notes', 'credit_note_number', 'CN');
  insert into public.accounting_credit_notes (
    org_id, credit_note_number, invoice_id, customer_id, customer, branch,
    reason, date, amount, notes, status, created_by
  )
  values (
    org, note_no, p_invoice_id, customer, customer_name, nullif(p_branch, ''),
    coalesce(nullif(p_reason, ''), 'Credit note'), p_date::timestamptz,
    amount, nullif(p_notes, ''), 'approved', me
  )
  returning id into note_id;

  journal := public.post_journal_entry(
    p_date,
    'Credit note ' || note_no,
    'CREDIT_NOTE',
    'CreditNote',
    note_id::text,
    jsonb_build_array(
      jsonb_build_object('account_id', sales_account, 'debit', amount, 'description', 'Credit note'),
      jsonb_build_object('account_id', ar_account, 'credit', amount, 'description', 'Reduce accounts receivable')
    )
  );

  update public.accounting_credit_notes
     set journal_entry_id = (journal->>'id')::uuid
   where id = note_id;

  return jsonb_build_object('success', true, 'credit_note_id', note_id, 'credit_note_number', note_no, 'creditNoteNumber', note_no, 'entryNumber', journal->>'entry_number');
end $$;

create or replace function public.post_cogs_entry(
  p_date date,
  p_branch text,
  p_invoice_id uuid,
  p_product_service text,
  p_project text,
  p_direct_material_cost numeric,
  p_direct_labour_cost numeric,
  p_production_service_cost numeric,
  p_purchase_cost numeric,
  p_payment_account_id uuid,
  p_notes text
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me uuid := public.current_app_user_id();
  org uuid := public.current_org_id();
  entry_id uuid;
  cogs_no text;
  cogs_account uuid;
  payment_account uuid;
  total numeric(14,2);
  journal jsonb;
begin
  if me is null or org is null then raise exception 'User not logged in'; end if;
  if public.current_app_role() not in ('admin', 'manager') then raise exception 'Permission denied'; end if;
  if p_invoice_id is not null and not exists (select 1 from public.accounting_invoices where id = p_invoice_id and org_id = org) then raise exception 'Invoice not found'; end if;

  total := round(coalesce(p_direct_material_cost, 0) + coalesce(p_direct_labour_cost, 0) + coalesce(p_production_service_cost, 0) + coalesce(p_purchase_cost, 0), 2);
  if total <= 0 then raise exception 'COGS total must be positive'; end if;

  cogs_account := public._accounting_system_account(org, 'cost_of_sales');
  if cogs_account is null then
    select id into cogs_account
      from public.chart_account
     where org_id = org and is_active = true and is_postable = true
       and type = 'EXPENSE' and statement_group = 'COST_OF_GOODS_SOLD'
     order by code
     limit 1;
  end if;
  if cogs_account is null then raise exception 'COGS account missing. Seed the chart of accounts.'; end if;

  payment_account := coalesce(p_payment_account_id, public._charts_default_payment_account(org));
  if payment_account is null then raise exception 'Payment account missing. Add a cash or bank account.'; end if;
  if not exists (select 1 from public.chart_account where id = payment_account and org_id = org and is_active = true and type = 'ASSET') then
    raise exception 'Payment account not found';
  end if;

  cogs_no := public._charts_next_number(org, 'accounting_cogs_entries', 'cogs_number', 'COGS');
  insert into public.accounting_cogs_entries (
    org_id, cogs_number, date, branch, invoice_id, product_service, project,
    description, category, direct_material_cost, direct_labour_cost,
    production_service_cost, purchase_cost, total_cost, total_amount,
    payment_account_id, status, notes, created_by
  )
  values (
    org, cogs_no, p_date::timestamptz, nullif(p_branch, ''), p_invoice_id,
    nullif(p_product_service, ''), nullif(p_project, ''), nullif(p_notes, ''),
    'cost_of_goods_sold', round(coalesce(p_direct_material_cost, 0), 2),
    round(coalesce(p_direct_labour_cost, 0), 2), round(coalesce(p_production_service_cost, 0), 2),
    round(coalesce(p_purchase_cost, 0), 2), total, total, payment_account,
    'approved', nullif(p_notes, ''), me
  )
  returning id into entry_id;

  journal := public.post_journal_entry(
    p_date,
    'COGS ' || cogs_no,
    'COGS',
    'CogsEntry',
    entry_id::text,
    jsonb_build_array(
      jsonb_build_object('account_id', cogs_account, 'debit', total, 'description', 'Cost of goods sold'),
      jsonb_build_object('account_id', payment_account, 'credit', total, 'description', 'Direct cost payment')
    )
  );

  update public.accounting_cogs_entries
     set journal_entry_id = (journal->>'id')::uuid
   where id = entry_id;

  return jsonb_build_object('success', true, 'cogs_id', entry_id, 'cogs_number', cogs_no, 'cogsNumber', cogs_no, 'entryNumber', journal->>'entry_number');
end $$;

create or replace function public.post_operating_expense(
  p_expense_group text,
  p_date date,
  p_payee text,
  p_branch text,
  p_description text,
  p_category text,
  p_amount numeric,
  p_payment_method text,
  p_reference_number text,
  p_payment_account_id uuid
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me uuid := public.current_app_user_id();
  org uuid := public.current_org_id();
  grp text := lower(btrim(coalesce(p_expense_group, '')));
  stmt_group text;
  expense_id uuid;
  expense_no text;
  expense_account uuid;
  payment_account uuid;
  amount numeric(14,2) := round(coalesce(p_amount, 0), 2);
  journal jsonb;
begin
  if me is null or org is null then raise exception 'User not logged in'; end if;
  if public.current_app_role() not in ('admin', 'manager') then raise exception 'Permission denied'; end if;
  if grp = 'administrative_expenses' then grp := 'administrative'; end if;
  if grp = 'finance_charges' then grp := 'finance'; end if;
  if grp = 'other_operating_expenses' then grp := 'other_operating'; end if;
  if grp not in ('administrative', 'finance', 'other_operating') then raise exception 'Invalid expense group'; end if;
  if amount <= 0 then raise exception 'Amount must be positive'; end if;
  if btrim(coalesce(p_payee, '')) = '' then raise exception 'Payee is required'; end if;
  if btrim(coalesce(p_category, '')) = '' then raise exception 'Category is required'; end if;

  stmt_group := case grp
    when 'administrative' then 'ADMINISTRATIVE_EXPENSES'
    when 'finance' then 'FINANCE_CHARGES'
    else 'OTHER_OPERATING_EXPENSES'
  end;

  select id into expense_account
    from public.chart_account
   where org_id = org
     and is_active = true
     and is_postable = true
     and type = 'EXPENSE'
     and statement_group = stmt_group
   order by
     case
       when lower(name) = lower(p_category) then 0
       when lower(name) like '%' || lower(p_category) || '%' then 1
       else 2
     end,
     code
   limit 1;
  if expense_account is null then raise exception 'Expense account missing for this section. Seed the chart of accounts.'; end if;

  payment_account := coalesce(p_payment_account_id, public._charts_default_payment_account(org));
  if payment_account is null then raise exception 'Payment account missing. Add a cash or bank account.'; end if;
  if not exists (select 1 from public.chart_account where id = payment_account and org_id = org and is_active = true and type = 'ASSET') then
    raise exception 'Payment account not found';
  end if;

  expense_no := public._charts_next_number(org, 'accounting_expense_entries', 'expense_number', 'OPEX');
  insert into public.accounting_expense_entries (
    org_id, expense_number, expense_group, date, payee, branch, description,
    category, amount, payment_method, reference_number, payment_account_id, status, created_by
  )
  values (
    org, expense_no, grp, p_date::timestamptz, btrim(p_payee), nullif(p_branch, ''),
    nullif(p_description, ''), btrim(p_category), amount,
    coalesce(nullif(p_payment_method, ''), 'cash'), nullif(p_reference_number, ''),
    payment_account, 'approved', me
  )
  returning id into expense_id;

  journal := public.post_journal_entry(
    p_date,
    coalesce(nullif(p_description, ''), p_category || ' ' || expense_no),
    'OPERATING_EXPENSE',
    'OperatingExpense',
    expense_id::text,
    jsonb_build_array(
      jsonb_build_object('account_id', expense_account, 'debit', amount, 'description', p_category),
      jsonb_build_object('account_id', payment_account, 'credit', amount, 'description', 'Paid by ' || coalesce(nullif(p_payment_method, ''), 'cash'))
    )
  );

  update public.accounting_expense_entries
     set journal_entry_id = (journal->>'id')::uuid
   where id = expense_id;

  return jsonb_build_object('success', true, 'expense_id', expense_id, 'expense_number', expense_no, 'expenseNumber', expense_no, 'entryNumber', journal->>'entry_number');
end $$;

-- ---------------------------------------------------------------------------
-- Seeds: six accounting categories and cash-in-hand accounts.
-- ---------------------------------------------------------------------------

create or replace function public.seed_chart_of_accounts()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me uuid := public.current_app_user_id();
  org uuid := public.current_org_id();
  before_count int;
  after_count int;
  parent_cash uuid;
  petty_chart uuid;
  mpesa_chart uuid;
begin
  if me is null or org is null then raise exception 'User not logged in'; end if;
  if public.current_app_role() <> 'admin' then raise exception 'Only admins can set up the chart of accounts'; end if;

  select count(*) into before_count from public.chart_account where org_id = org;

  insert into public.chart_account (
    org_id, code, name, type, normal_balance, category, sub_category,
    classification, statement_group, currency, is_postable, is_bank,
    is_system, is_active, description, note, created_by
  )
  values
    (org, '1000', 'Cash Book', 'ASSET', 'DEBIT', 'cash_book', 'cash_book', 'BANK', 'CURRENT_ASSETS', 'KES', false, false, true, true, null, 'Header account', me),
    (org, '1010', 'Cash at Bank', 'ASSET', 'DEBIT', 'cash_book', 'cash_at_bank', 'BANK', 'CURRENT_ASSETS', 'KES', false, true, true, true, null, 'Header account', me),
    (org, '1020', 'Cash in Hand', 'ASSET', 'DEBIT', 'cash_book', 'cash_in_hand', 'BANK', 'CURRENT_ASSETS', 'KES', false, false, true, true, 'key:cash_on_hand', 'Header account', me),
    (org, '1100', 'Accounts Receivable', 'ASSET', 'DEBIT', 'revenue', 'accounts_receivable', 'ACCOUNTS_RECEIVABLE', 'CURRENT_ASSETS', 'KES', true, false, true, true, 'key:accounts_receivable', null, me),
    (org, '2200', 'VAT Output', 'LIABILITY', 'CREDIT', 'revenue', 'vat_output', 'OTHER_CURRENT_LIABILITY', 'CURRENT_LIABILITIES', 'KES', true, false, true, true, 'key:vat_output', null, me),
    (org, '3030', 'Opening Balance Equity', 'EQUITY', 'CREDIT', 'equity', 'opening_balance', 'EQUITY', 'EQUITY', 'KES', true, false, true, true, 'key:retained_earnings', null, me),
    (org, '4000', 'Revenue', 'INCOME', 'CREDIT', 'revenue', 'sales_revenue', 'INCOME', 'REVENUE', 'KES', true, false, true, true, 'key:sales_revenue', null, me),
    (org, '5000', 'Cost of Goods Sold', 'EXPENSE', 'DEBIT', 'cogs', 'cost_of_goods_sold', 'COST_OF_GOODS_SOLD', 'COST_OF_GOODS_SOLD', 'KES', true, false, true, true, 'key:cost_of_sales', null, me),
    (org, '6000', 'Administrative Expenses', 'EXPENSE', 'DEBIT', 'administrative_expenses', 'admin', 'EXPENSE', 'ADMINISTRATIVE_EXPENSES', 'KES', false, false, true, true, null, 'Header account', me),
    (org, '6010', 'General Administrative Expenses', 'EXPENSE', 'DEBIT', 'administrative_expenses', 'admin', 'EXPENSE', 'ADMINISTRATIVE_EXPENSES', 'KES', true, false, false, true, null, null, me),
    (org, '7000', 'Finance Charges', 'EXPENSE', 'DEBIT', 'finance_charges', 'finance', 'OTHER_EXPENSE', 'FINANCE_CHARGES', 'KES', false, false, true, true, null, 'Header account', me),
    (org, '7010', 'Bank Charges', 'EXPENSE', 'DEBIT', 'finance_charges', 'finance', 'OTHER_EXPENSE', 'FINANCE_CHARGES', 'KES', true, false, false, true, null, null, me),
    (org, '8000', 'Other Operating Expenses', 'EXPENSE', 'DEBIT', 'other_operating_expenses', 'operating', 'OTHER_EXPENSE', 'OTHER_OPERATING_EXPENSES', 'KES', false, false, true, true, null, 'Header account', me),
    (org, '8010', 'General Other Operating Expenses', 'EXPENSE', 'DEBIT', 'other_operating_expenses', 'operating', 'OTHER_EXPENSE', 'OTHER_OPERATING_EXPENSES', 'KES', true, false, false, true, null, null, me)
  on conflict (org_id, code) do nothing;

  select id into parent_cash from public.chart_account where org_id = org and code = '1020' limit 1;

  insert into public.chart_account (
    org_id, code, name, type, normal_balance, category, sub_category,
    classification, statement_group, currency, parent_id, description,
    vat_applicable, is_bank, is_system, is_active, is_postable, created_by
  )
  values
    (org, '1005', 'Petty Cash', 'ASSET', 'DEBIT', 'cash_book', 'petty_cash', 'BANK', 'CURRENT_ASSETS', 'KES', parent_cash, 'cashbook:petty_cash', false, false, false, true, true, me),
    (org, '1015', 'M-Pesa', 'ASSET', 'DEBIT', 'cash_book', 'mpesa', 'BANK', 'CURRENT_ASSETS', 'KES', parent_cash, 'cashbook:mpesa', false, false, false, true, true, me)
  on conflict (org_id, code) do nothing;

  select id into petty_chart from public.chart_account where org_id = org and code = '1005';
  select id into mpesa_chart from public.chart_account where org_id = org and code = '1015';

  if petty_chart is not null then
    update public.accounting_cash_accounts ca
       set chart_account_id = petty_chart,
           account_type = 'cash_in_hand',
           sub_category = coalesce(ca.sub_category, 'petty_cash'),
           status = coalesce(ca.status, 'active')
     where ca.ctid in (
       select ca2.ctid
         from public.accounting_cash_accounts ca2
        where ca2.org_id = org
          and ca2.chart_account_id is null
          and lower(ca2.account_name) = 'petty cash'
        limit 1
     )
       and not exists (
         select 1 from public.accounting_cash_accounts existing
          where existing.org_id = org and existing.chart_account_id = petty_chart
       );

    insert into public.accounting_cash_accounts (
      org_id, chart_account_id, account_type, account_name, sub_category,
      branch, opening_balance, current_balance, status, created_by
    )
    values (org, petty_chart, 'cash_in_hand', 'Petty Cash', 'petty_cash', 'Main', 0, 0, 'active', me)
    on conflict (org_id, chart_account_id) do nothing;
  end if;

  if mpesa_chart is not null then
    update public.accounting_cash_accounts ca
       set chart_account_id = mpesa_chart,
           account_type = 'cash_in_hand',
           sub_category = coalesce(ca.sub_category, 'mpesa'),
           status = coalesce(ca.status, 'active')
     where ca.ctid in (
       select ca2.ctid
         from public.accounting_cash_accounts ca2
        where ca2.org_id = org
          and ca2.chart_account_id is null
          and lower(ca2.account_name) in ('m-pesa', 'mpesa')
        limit 1
     )
       and not exists (
         select 1 from public.accounting_cash_accounts existing
          where existing.org_id = org and existing.chart_account_id = mpesa_chart
       );

    insert into public.accounting_cash_accounts (
      org_id, chart_account_id, account_type, account_name, sub_category,
      branch, opening_balance, current_balance, status, created_by
    )
    values (org, mpesa_chart, 'cash_in_hand', 'M-Pesa', 'mpesa', 'Main', 0, 0, 'active', me)
    on conflict (org_id, chart_account_id) do nothing;
  end if;

  select count(*) into after_count from public.chart_account where org_id = org;

  return jsonb_build_object('success', true, 'created', after_count - before_count, 'total', after_count);
end $$;

-- Seed every existing organization once so the page loads immediately after the
-- migration, even before an admin presses "Set up chart of accounts".
do $$
declare
  org_row record;
  before_count int;
  after_count int;
  parent_cash uuid;
  petty_chart uuid;
  mpesa_chart uuid;
begin
  for org_row in select id from public.organizations loop
    select count(*) into before_count from public.chart_account where org_id = org_row.id;

    insert into public.chart_account (
      org_id, code, name, type, normal_balance, category, sub_category,
      classification, statement_group, currency, is_postable, is_bank,
      is_system, is_active, description, note
    )
    values
      (org_row.id, '1000', 'Cash Book', 'ASSET', 'DEBIT', 'cash_book', 'cash_book', 'BANK', 'CURRENT_ASSETS', 'KES', false, false, true, true, null, 'Header account'),
      (org_row.id, '1010', 'Cash at Bank', 'ASSET', 'DEBIT', 'cash_book', 'cash_at_bank', 'BANK', 'CURRENT_ASSETS', 'KES', false, true, true, true, null, 'Header account'),
      (org_row.id, '1020', 'Cash in Hand', 'ASSET', 'DEBIT', 'cash_book', 'cash_in_hand', 'BANK', 'CURRENT_ASSETS', 'KES', false, false, true, true, 'key:cash_on_hand', 'Header account'),
      (org_row.id, '1100', 'Accounts Receivable', 'ASSET', 'DEBIT', 'revenue', 'accounts_receivable', 'ACCOUNTS_RECEIVABLE', 'CURRENT_ASSETS', 'KES', true, false, true, true, 'key:accounts_receivable', null),
      (org_row.id, '2200', 'VAT Output', 'LIABILITY', 'CREDIT', 'revenue', 'vat_output', 'OTHER_CURRENT_LIABILITY', 'CURRENT_LIABILITIES', 'KES', true, false, true, true, 'key:vat_output', null),
      (org_row.id, '3030', 'Opening Balance Equity', 'EQUITY', 'CREDIT', 'equity', 'opening_balance', 'EQUITY', 'EQUITY', 'KES', true, false, true, true, 'key:retained_earnings', null),
      (org_row.id, '4000', 'Revenue', 'INCOME', 'CREDIT', 'revenue', 'sales_revenue', 'INCOME', 'REVENUE', 'KES', true, false, true, true, 'key:sales_revenue', null),
      (org_row.id, '5000', 'Cost of Goods Sold', 'EXPENSE', 'DEBIT', 'cogs', 'cost_of_goods_sold', 'COST_OF_GOODS_SOLD', 'COST_OF_GOODS_SOLD', 'KES', true, false, true, true, 'key:cost_of_sales', null),
      (org_row.id, '6000', 'Administrative Expenses', 'EXPENSE', 'DEBIT', 'administrative_expenses', 'admin', 'EXPENSE', 'ADMINISTRATIVE_EXPENSES', 'KES', false, false, true, true, null, 'Header account'),
      (org_row.id, '6010', 'General Administrative Expenses', 'EXPENSE', 'DEBIT', 'administrative_expenses', 'admin', 'EXPENSE', 'ADMINISTRATIVE_EXPENSES', 'KES', true, false, false, true, null, null),
      (org_row.id, '7000', 'Finance Charges', 'EXPENSE', 'DEBIT', 'finance_charges', 'finance', 'OTHER_EXPENSE', 'FINANCE_CHARGES', 'KES', false, false, true, true, null, 'Header account'),
      (org_row.id, '7010', 'Bank Charges', 'EXPENSE', 'DEBIT', 'finance_charges', 'finance', 'OTHER_EXPENSE', 'FINANCE_CHARGES', 'KES', true, false, false, true, null, null),
      (org_row.id, '8000', 'Other Operating Expenses', 'EXPENSE', 'DEBIT', 'other_operating_expenses', 'operating', 'OTHER_EXPENSE', 'OTHER_OPERATING_EXPENSES', 'KES', false, false, true, true, null, 'Header account'),
      (org_row.id, '8010', 'General Other Operating Expenses', 'EXPENSE', 'DEBIT', 'other_operating_expenses', 'operating', 'OTHER_EXPENSE', 'OTHER_OPERATING_EXPENSES', 'KES', true, false, false, true, null, null)
    on conflict (org_id, code) do nothing;

    select id into parent_cash from public.chart_account where org_id = org_row.id and code = '1020' limit 1;
    insert into public.chart_account (
      org_id, code, name, type, normal_balance, category, sub_category,
      classification, statement_group, currency, parent_id, description,
      vat_applicable, is_bank, is_system, is_active, is_postable
    )
    values
      (org_row.id, '1005', 'Petty Cash', 'ASSET', 'DEBIT', 'cash_book', 'petty_cash', 'BANK', 'CURRENT_ASSETS', 'KES', parent_cash, 'cashbook:petty_cash', false, false, false, true, true),
      (org_row.id, '1015', 'M-Pesa', 'ASSET', 'DEBIT', 'cash_book', 'mpesa', 'BANK', 'CURRENT_ASSETS', 'KES', parent_cash, 'cashbook:mpesa', false, false, false, true, true)
    on conflict (org_id, code) do nothing;

    select id into petty_chart from public.chart_account where org_id = org_row.id and code = '1005';
    select id into mpesa_chart from public.chart_account where org_id = org_row.id and code = '1015';

    if petty_chart is not null then
      update public.accounting_cash_accounts ca
         set chart_account_id = petty_chart,
             account_type = 'cash_in_hand',
             sub_category = coalesce(ca.sub_category, 'petty_cash'),
             status = coalesce(ca.status, 'active')
       where ca.ctid in (
         select ca2.ctid
           from public.accounting_cash_accounts ca2
          where ca2.org_id = org_row.id
            and ca2.chart_account_id is null
            and lower(ca2.account_name) = 'petty cash'
          limit 1
       )
         and not exists (
           select 1 from public.accounting_cash_accounts existing
            where existing.org_id = org_row.id and existing.chart_account_id = petty_chart
         );

      insert into public.accounting_cash_accounts (
        org_id, chart_account_id, account_type, account_name, sub_category,
        branch, opening_balance, current_balance, status
      )
      values (org_row.id, petty_chart, 'cash_in_hand', 'Petty Cash', 'petty_cash', 'Main', 0, 0, 'active')
      on conflict (org_id, chart_account_id) do nothing;
    end if;

    if mpesa_chart is not null then
      update public.accounting_cash_accounts ca
         set chart_account_id = mpesa_chart,
             account_type = 'cash_in_hand',
             sub_category = coalesce(ca.sub_category, 'mpesa'),
             status = coalesce(ca.status, 'active')
       where ca.ctid in (
         select ca2.ctid
           from public.accounting_cash_accounts ca2
          where ca2.org_id = org_row.id
            and ca2.chart_account_id is null
            and lower(ca2.account_name) in ('m-pesa', 'mpesa')
          limit 1
       )
         and not exists (
           select 1 from public.accounting_cash_accounts existing
            where existing.org_id = org_row.id and existing.chart_account_id = mpesa_chart
         );

      insert into public.accounting_cash_accounts (
        org_id, chart_account_id, account_type, account_name, sub_category,
        branch, opening_balance, current_balance, status
      )
      values (org_row.id, mpesa_chart, 'cash_in_hand', 'M-Pesa', 'mpesa', 'Main', 0, 0, 'active')
      on conflict (org_id, chart_account_id) do nothing;
    end if;

    select count(*) into after_count from public.chart_account where org_id = org_row.id;
  end loop;
end $$;

notify pgrst, 'reload schema';

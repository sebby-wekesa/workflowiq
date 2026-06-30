-- =============================================================================
-- WORKFLOWIQ | 011_charts_accounting_module.sql
-- Cash book, revenue, COGS, expense sections, and posting RPCs for the chart page.
-- =============================================================================

create table if not exists public.accounting_cash_accounts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org_id() references public.organizations(id) on delete cascade,
  chart_account_id uuid not null references public.chart_account(id) on delete restrict,
  account_kind text not null check (account_kind in ('bank', 'cash')),
  account_name text not null,
  bank_name text,
  account_number text,
  branch text,
  opening_balance numeric(14,2) not null default 0,
  current_balance numeric(14,2) not null default 0,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_by uuid references public.app_users(id) on delete set null default public.current_app_user_id(),
  created_at timestamptz not null default now()
);
create unique index if not exists accounting_cash_accounts_org_chart_uniq
  on public.accounting_cash_accounts (org_id, chart_account_id);
create index if not exists accounting_cash_accounts_org_kind_idx
  on public.accounting_cash_accounts (org_id, account_kind, status);

create table if not exists public.accounting_cash_transactions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org_id() references public.organizations(id) on delete cascade,
  cash_account_id uuid not null references public.accounting_cash_accounts(id) on delete restrict,
  transaction_number text not null,
  transaction_type text not null,
  date timestamptz not null,
  reference_number text,
  description text,
  offset_account_id uuid references public.chart_account(id) on delete restrict,
  debit numeric(14,2) not null default 0,
  credit numeric(14,2) not null default 0,
  running_balance numeric(14,2) not null default 0,
  journal_entry_id uuid references public.journal_entry(id) on delete set null,
  created_by uuid references public.app_users(id) on delete set null default public.current_app_user_id(),
  created_at timestamptz not null default now()
);
create unique index if not exists accounting_cash_transactions_org_number_uniq
  on public.accounting_cash_transactions (org_id, transaction_number);
create index if not exists accounting_cash_transactions_org_account_idx
  on public.accounting_cash_transactions (org_id, cash_account_id, date);

create table if not exists public.accounting_bank_reconciliations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org_id() references public.organizations(id) on delete cascade,
  cash_account_id uuid not null references public.accounting_cash_accounts(id) on delete restrict,
  reconciliation_number text not null,
  statement_date date not null,
  statement_balance numeric(14,2) not null default 0,
  system_balance numeric(14,2) not null default 0,
  difference numeric(14,2) not null default 0,
  status text not null default 'open' check (status in ('open', 'reconciled')),
  notes text,
  created_by uuid references public.app_users(id) on delete set null default public.current_app_user_id(),
  created_at timestamptz not null default now()
);
create unique index if not exists accounting_bank_reconciliations_org_number_uniq
  on public.accounting_bank_reconciliations (org_id, reconciliation_number);

alter table public.accounting_invoices add column if not exists branch text;
alter table public.accounting_invoices add column if not exists sales_person text;
alter table public.accounting_invoices add column if not exists payment_terms text;
alter table public.accounting_invoices add column if not exists notes text;

create table if not exists public.accounting_invoice_lines (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org_id() references public.organizations(id) on delete cascade,
  invoice_id uuid not null references public.accounting_invoices(id) on delete cascade,
  item text not null,
  quantity numeric(14,2) not null default 1,
  unit_price numeric(14,2) not null default 0,
  discount numeric(14,2) not null default 0,
  tax_rate numeric(7,4) not null default 0,
  tax_amount numeric(14,2) not null default 0,
  line_total numeric(14,2) not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists accounting_invoice_lines_org_invoice_idx
  on public.accounting_invoice_lines (org_id, invoice_id);

create table if not exists public.accounting_credit_notes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org_id() references public.organizations(id) on delete cascade,
  credit_note_number text not null,
  invoice_id uuid references public.accounting_invoices(id) on delete set null,
  customer_id uuid not null references public.customers(id) on delete restrict,
  branch text,
  reason text not null,
  date timestamptz not null,
  amount numeric(14,2) not null default 0,
  notes text,
  status text not null default 'approved' check (status in ('draft', 'approved', 'void')),
  journal_entry_id uuid references public.journal_entry(id) on delete set null,
  created_by uuid references public.app_users(id) on delete set null default public.current_app_user_id(),
  created_at timestamptz not null default now()
);
create unique index if not exists accounting_credit_notes_org_number_uniq
  on public.accounting_credit_notes (org_id, credit_note_number);
create index if not exists accounting_credit_notes_org_customer_idx
  on public.accounting_credit_notes (org_id, customer_id, date);

create table if not exists public.accounting_cogs_entries (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org_id() references public.organizations(id) on delete cascade,
  cogs_number text not null,
  date timestamptz not null,
  branch text,
  invoice_id uuid references public.accounting_invoices(id) on delete set null,
  product_service text,
  project text,
  direct_material_cost numeric(14,2) not null default 0,
  direct_labour_cost numeric(14,2) not null default 0,
  production_service_cost numeric(14,2) not null default 0,
  purchase_cost numeric(14,2) not null default 0,
  total_amount numeric(14,2) not null default 0,
  payment_account_id uuid references public.chart_account(id) on delete restrict,
  status text not null default 'approved' check (status in ('draft', 'approved', 'void')),
  notes text,
  journal_entry_id uuid references public.journal_entry(id) on delete set null,
  created_by uuid references public.app_users(id) on delete set null default public.current_app_user_id(),
  created_at timestamptz not null default now()
);
create unique index if not exists accounting_cogs_entries_org_number_uniq
  on public.accounting_cogs_entries (org_id, cogs_number);
create index if not exists accounting_cogs_entries_org_date_idx
  on public.accounting_cogs_entries (org_id, date);

create table if not exists public.accounting_operating_expenses (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org_id() references public.organizations(id) on delete cascade,
  expense_number text not null,
  expense_group text not null check (expense_group in ('administrative', 'finance', 'other_operating')),
  date timestamptz not null,
  payee text not null,
  branch text,
  description text,
  category text not null,
  amount numeric(14,2) not null default 0,
  payment_method text not null default 'cash',
  reference_number text,
  payment_account_id uuid references public.chart_account(id) on delete restrict,
  status text not null default 'approved' check (status in ('draft', 'approved', 'void')),
  journal_entry_id uuid references public.journal_entry(id) on delete set null,
  created_by uuid references public.app_users(id) on delete set null default public.current_app_user_id(),
  created_at timestamptz not null default now()
);
create unique index if not exists accounting_operating_expenses_org_number_uniq
  on public.accounting_operating_expenses (org_id, expense_number);
create index if not exists accounting_operating_expenses_org_group_idx
  on public.accounting_operating_expenses (org_id, expense_group, date);

do $$
declare t text;
begin
  foreach t in array array[
    'accounting_cash_accounts',
    'accounting_cash_transactions',
    'accounting_bank_reconciliations',
    'accounting_invoice_lines',
    'accounting_credit_notes',
    'accounting_cogs_entries',
    'accounting_operating_expenses'
  ]
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists %1$s_select on public.%1$s;', t);
    execute format('drop policy if exists %1$s_insert on public.%1$s;', t);
    execute format('drop policy if exists %1$s_update on public.%1$s;', t);
    execute format('drop policy if exists %1$s_delete on public.%1$s;', t);
    execute format($f$
      create policy %1$s_select on public.%1$s for select to authenticated
        using (org_id = public.current_org_id());
      create policy %1$s_insert on public.%1$s for insert to authenticated
        with check (org_id = public.current_org_id() and public.current_app_user_id() is not null);
      create policy %1$s_update on public.%1$s for update to authenticated
        using (org_id = public.current_org_id())
        with check (org_id = public.current_org_id());
      create policy %1$s_delete on public.%1$s for delete to authenticated
        using (org_id = public.current_org_id() and public.current_app_role() = 'admin');
    $f$, t);
  end loop;
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
   order by case ca.account_kind when 'cash' then 0 else 1 end, ca.created_at
   limit 1;

  if account is not null then return account; end if;

  return public._accounting_bank_account(p_org, null);
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
  if kind not in ('bank', 'cash') then raise exception 'Account kind must be bank or cash'; end if;
  if clean_name = '' then raise exception 'Account name is required'; end if;

  select id into parent
    from public.chart_account
   where org_id = org
     and code = case when kind = 'bank' then '1020' else '1000' end
   limit 1;

  account_code := public._charts_next_cash_account_code(org, kind);
  insert into public.chart_account (
    org_id, code, name, type, normal_balance, classification, statement_group,
    currency, parent_id, description, vat_applicable, is_bank, is_system,
    is_active, is_postable, created_by
  )
  values (
    org, account_code, clean_name, 'ASSET', 'DEBIT', 'BANK', 'CURRENT_ASSETS',
    'KES', parent, 'cashbook:' || kind, false, kind = 'bank', false,
    coalesce(p_status, 'active') = 'active', true, me
  )
  returning id into chart_id;

  insert into public.accounting_cash_accounts (
    org_id, chart_account_id, account_kind, account_name, bank_name, account_number,
    branch, opening_balance, current_balance, status, created_by
  )
  values (
    org, chart_id, kind, clean_name, nullif(btrim(coalesce(p_bank_name, '')), ''),
    nullif(btrim(coalesce(p_account_number, '')), ''), nullif(btrim(coalesce(p_branch, '')), ''),
    opening, opening, case when coalesce(p_status, 'active') = 'inactive' then 'inactive' else 'active' end, me
  )
  returning id into cash_id;

  if opening <> 0 then
    select id into equity_account
      from public.chart_account
     where org_id = org
       and is_active = true
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

  if dir = 'debit_cash' then
    debit_amt := amount;
  else
    credit_amt := amount;
  end if;

  txn_no := public._charts_next_number(org, 'accounting_cash_transactions', 'transaction_number', 'CBK');
  next_balance := (
    select current_balance + debit_amt - credit_amt
      from public.accounting_cash_accounts
     where id = p_cash_account_id
  );

  insert into public.accounting_cash_transactions (
    org_id, cash_account_id, transaction_number, transaction_type, date,
    reference_number, description, offset_account_id, debit, credit, running_balance, created_by
  )
  values (
    org, p_cash_account_id, txn_no, coalesce(nullif(p_transaction_type, ''), 'Journal Entry'), p_date::timestamptz,
    coalesce(nullif(p_reference_number, ''), txn_no), nullif(p_description, ''), p_offset_account_id,
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
     and account_kind = 'bank';
  if cash_chart is null then raise exception 'Bank account not found'; end if;

  select round(coalesce(sum(ll.debit - ll.credit), 0), 2)
    into system_amt
    from public.ledger_line ll
    join public.journal_entry je on je.id = ll.journal_entry_id
   where ll.org_id = org
     and je.org_id = org
     and je.status = 'POSTED'
     and ll.account_id = cash_chart
     and je.date::date <= p_statement_date;

  rec_no := public._charts_next_number(org, 'accounting_bank_reconciliations', 'reconciliation_number', 'REC');
  insert into public.accounting_bank_reconciliations (
    org_id, cash_account_id, reconciliation_number, statement_date, statement_balance,
    system_balance, difference, status, notes, created_by
  )
  values (
    org, p_cash_account_id, rec_no, p_statement_date, statement_amt, system_amt,
    statement_amt - system_amt,
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
  vat_amt numeric(14,2) := 0;
  gross_amt numeric(14,2) := 0;
  journal jsonb;
  journal_lines jsonb;
begin
  if me is null or org is null then raise exception 'User not logged in'; end if;
  if public.current_app_role() not in ('admin', 'manager') then raise exception 'Permission denied'; end if;
  if not exists (select 1 from public.customers where id = p_customer_id and org_id = org) then raise exception 'Customer not found'; end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' then raise exception 'Invoice lines are required'; end if;

  ar_account := public._accounting_system_account(org, 'accounts_receivable');
  sales_account := public._accounting_system_account(org, 'sales_revenue');
  vat_account := public._accounting_system_account(org, 'vat_output');
  if ar_account is null or sales_account is null then raise exception 'Accounts Receivable or Sales Revenue account missing. Seed the chart of accounts.'; end if;

  for line in select value from jsonb_array_elements(p_lines) as t(value) loop
    item_name := btrim(coalesce(line->>'item', ''));
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
    vat_amt := vat_amt + line_tax;
    gross_amt := gross_amt + line_total;
  end loop;
  if gross_amt <= 0 then raise exception 'Invoice total must be positive'; end if;
  if vat_amt > 0 and vat_account is null then raise exception 'VAT Output account missing. Seed the chart of accounts.'; end if;

  invoice_no := public._next_accounting_doc_number(org, 'invoice', 'INV');
  insert into public.accounting_invoices (
    org_id, invoice_number, customer_id, date, due_date, status, has_vat,
    net_amount, vat_amount, total_amount, memo, branch, sales_person, payment_terms, notes, created_by
  )
  values (
    org, invoice_no, p_customer_id, p_invoice_date::timestamptz, p_due_date::timestamptz, 'posted',
    vat_amt > 0, net_amt, vat_amt, gross_amt, nullif(p_notes, ''), nullif(p_branch, ''),
    nullif(p_sales_person, ''), nullif(p_payment_terms, ''), nullif(p_notes, ''), me
  )
  returning id into invoice_id;

  for line in select value from jsonb_array_elements(p_lines) as t(value) loop
    item_name := btrim(coalesce(line->>'item', ''));
    qty := round(coalesce(nullif(line->>'quantity', '')::numeric, 0), 2);
    unit_amt := round(coalesce(coalesce(nullif(line->>'unit_price', ''), nullif(line->>'unitPrice', ''))::numeric, 0), 2);
    discount_amt := round(coalesce(nullif(line->>'discount', '')::numeric, 0), 2);
    tax_rate := round(coalesce(coalesce(nullif(line->>'tax', ''), nullif(line->>'tax_rate', ''))::numeric, 0), 4);
    line_net := greatest(round((qty * unit_amt) - discount_amt, 2), 0);
    line_tax := round(line_net * (tax_rate / 100), 2);
    line_total := line_net + line_tax;
    insert into public.accounting_invoice_lines (
      org_id, invoice_id, item, quantity, unit_price, discount, tax_rate, tax_amount, line_total
    )
    values (org, invoice_id, item_name, qty, unit_amt, discount_amt, tax_rate, line_tax, line_total);
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
  if customer is null or not exists (select 1 from public.customers where id = customer and org_id = org) then raise exception 'Customer not found'; end if;

  ar_account := public._accounting_system_account(org, 'accounts_receivable');
  sales_account := public._accounting_system_account(org, 'sales_revenue');
  if ar_account is null or sales_account is null then raise exception 'Accounts Receivable or Sales Revenue account missing. Seed the chart of accounts.'; end if;

  note_no := public._charts_next_number(org, 'accounting_credit_notes', 'credit_note_number', 'CN');
  insert into public.accounting_credit_notes (
    org_id, credit_note_number, invoice_id, customer_id, branch, reason, date,
    amount, notes, status, created_by
  )
  values (
    org, note_no, p_invoice_id, customer, nullif(p_branch, ''), coalesce(nullif(p_reason, ''), 'Credit note'),
    p_date::timestamptz, amount, nullif(p_notes, ''), 'approved', me
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

  total := round(
    coalesce(p_direct_material_cost, 0) +
    coalesce(p_direct_labour_cost, 0) +
    coalesce(p_production_service_cost, 0) +
    coalesce(p_purchase_cost, 0),
    2
  );
  if total <= 0 then raise exception 'COGS total must be positive'; end if;

  cogs_account := public._accounting_system_account(org, 'cost_of_sales');
  if cogs_account is null then
    select id into cogs_account
      from public.chart_account
     where org_id = org
       and is_active = true
       and is_postable = true
       and type = 'EXPENSE'
       and statement_group = 'COST_OF_GOODS_SOLD'
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
    direct_material_cost, direct_labour_cost, production_service_cost, purchase_cost,
    total_amount, payment_account_id, status, notes, created_by
  )
  values (
    org, cogs_no, p_date::timestamptz, nullif(p_branch, ''), p_invoice_id,
    nullif(p_product_service, ''), nullif(p_project, ''),
    round(coalesce(p_direct_material_cost, 0), 2),
    round(coalesce(p_direct_labour_cost, 0), 2),
    round(coalesce(p_production_service_cost, 0), 2),
    round(coalesce(p_purchase_cost, 0), 2),
    total, payment_account, 'approved', nullif(p_notes, ''), me
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

  expense_no := public._charts_next_number(org, 'accounting_operating_expenses', 'expense_number', 'OPEX');
  insert into public.accounting_operating_expenses (
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

  update public.accounting_operating_expenses
     set journal_entry_id = (journal->>'id')::uuid
   where id = expense_id;

  return jsonb_build_object('success', true, 'expense_id', expense_id, 'expense_number', expense_no, 'expenseNumber', expense_no, 'entryNumber', journal->>'entry_number');
end $$;

do $$
declare
  org_row record;
  parent_cash uuid;
  petty_chart uuid;
  mpesa_chart uuid;
begin
  for org_row in select id from public.organizations loop
    select id into parent_cash
      from public.chart_account
     where org_id = org_row.id and code = '1000'
     limit 1;

    insert into public.chart_account (
      org_id, code, name, type, normal_balance, classification, statement_group,
      currency, parent_id, description, vat_applicable, is_bank, is_system,
      is_active, is_postable
    )
    values (
      org_row.id, '1005', 'Petty Cash', 'ASSET', 'DEBIT', 'BANK', 'CURRENT_ASSETS',
      'KES', parent_cash, 'cashbook:petty_cash', false, false, false, true, true
    )
    on conflict (org_id, code) do nothing;

    insert into public.chart_account (
      org_id, code, name, type, normal_balance, classification, statement_group,
      currency, parent_id, description, vat_applicable, is_bank, is_system,
      is_active, is_postable
    )
    values (
      org_row.id, '1015', 'M-Pesa', 'ASSET', 'DEBIT', 'BANK', 'CURRENT_ASSETS',
      'KES', parent_cash, 'cashbook:mpesa', false, false, false, true, true
    )
    on conflict (org_id, code) do nothing;

    select id into petty_chart from public.chart_account where org_id = org_row.id and code = '1005';
    select id into mpesa_chart from public.chart_account where org_id = org_row.id and code = '1015';

    if petty_chart is not null then
      insert into public.accounting_cash_accounts (
        org_id, chart_account_id, account_kind, account_name, branch, opening_balance, current_balance, status
      )
      values (org_row.id, petty_chart, 'cash', 'Petty Cash', 'Main', 0, 0, 'active')
      on conflict (org_id, chart_account_id) do nothing;
    end if;

    if mpesa_chart is not null then
      insert into public.accounting_cash_accounts (
        org_id, chart_account_id, account_kind, account_name, branch, opening_balance, current_balance, status
      )
      values (org_row.id, mpesa_chart, 'cash', 'M-Pesa', 'Main', 0, 0, 'active')
      on conflict (org_id, chart_account_id) do nothing;
    end if;
  end loop;
end $$;

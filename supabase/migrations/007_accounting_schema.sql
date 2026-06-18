-- =============================================================================
-- WORKFLOWIQ | 07_accounting_operations.sql
-- Operational accounting documents and posting RPCs built on the core ledger.
-- =============================================================================

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org_id() references public.organizations(id) on delete cascade,
  name text not null,
  phone text not null default '',
  email text,
  location text,
  notes text,
  created_by uuid references public.app_users(id) on delete set null default public.current_app_user_id(),
  created_at timestamptz not null default now()
);
create index if not exists suppliers_org_name_idx on public.suppliers (org_id, name);

create table if not exists public.accounting_invoices (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org_id() references public.organizations(id) on delete cascade,
  invoice_number text not null,
  customer_id uuid not null references public.customers(id) on delete restrict,
  job_id uuid references public.jobs(id) on delete set null,
  date timestamptz not null,
  due_date timestamptz,
  status text not null default 'posted',
  has_vat boolean not null default true,
  net_amount numeric(14,2) not null default 0,
  vat_amount numeric(14,2) not null default 0,
  total_amount numeric(14,2) not null default 0,
  memo text,
  journal_entry_id uuid references public.journal_entry(id) on delete set null,
  created_by uuid references public.app_users(id) on delete set null default public.current_app_user_id(),
  created_at timestamptz not null default now()
);
create unique index if not exists accounting_invoices_org_number_uniq
  on public.accounting_invoices (org_id, invoice_number);
create index if not exists accounting_invoices_org_customer_idx
  on public.accounting_invoices (org_id, customer_id);

create table if not exists public.accounting_bills (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org_id() references public.organizations(id) on delete cascade,
  bill_number text not null,
  supplier_id uuid not null references public.suppliers(id) on delete restrict,
  account_id uuid not null references public.chart_account(id) on delete restrict,
  date timestamptz not null,
  due_date timestamptz,
  status text not null default 'posted',
  has_vat boolean not null default true,
  net_amount numeric(14,2) not null default 0,
  vat_amount numeric(14,2) not null default 0,
  total_amount numeric(14,2) not null default 0,
  memo text,
  journal_entry_id uuid references public.journal_entry(id) on delete set null,
  created_by uuid references public.app_users(id) on delete set null default public.current_app_user_id(),
  created_at timestamptz not null default now()
);
create unique index if not exists accounting_bills_org_number_uniq
  on public.accounting_bills (org_id, bill_number);
create index if not exists accounting_bills_org_supplier_idx
  on public.accounting_bills (org_id, supplier_id);

create table if not exists public.accounting_expenses (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org_id() references public.organizations(id) on delete cascade,
  expense_number text not null,
  supplier_id uuid references public.suppliers(id) on delete set null,
  vendor_name text,
  expense_account_id uuid not null references public.chart_account(id) on delete restrict,
  bank_account_id uuid not null references public.chart_account(id) on delete restrict,
  date timestamptz not null,
  has_vat boolean not null default false,
  net_amount numeric(14,2) not null default 0,
  vat_amount numeric(14,2) not null default 0,
  total_amount numeric(14,2) not null default 0,
  memo text,
  reference text,
  journal_entry_id uuid references public.journal_entry(id) on delete set null,
  created_by uuid references public.app_users(id) on delete set null default public.current_app_user_id(),
  created_at timestamptz not null default now()
);
create unique index if not exists accounting_expenses_org_number_uniq
  on public.accounting_expenses (org_id, expense_number);
create index if not exists accounting_expenses_org_date_idx
  on public.accounting_expenses (org_id, date);

create table if not exists public.accounting_payments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org_id() references public.organizations(id) on delete cascade,
  payment_number text not null,
  direction text not null check (direction in ('received', 'paid')),
  customer_id uuid references public.customers(id) on delete set null,
  supplier_id uuid references public.suppliers(id) on delete set null,
  invoice_id uuid references public.accounting_invoices(id) on delete set null,
  bill_id uuid references public.accounting_bills(id) on delete set null,
  bank_account_id uuid not null references public.chart_account(id) on delete restrict,
  method text not null default 'bank_transfer',
  date timestamptz not null,
  amount numeric(14,2) not null,
  reference text,
  notes text,
  journal_entry_id uuid references public.journal_entry(id) on delete set null,
  created_by uuid references public.app_users(id) on delete set null default public.current_app_user_id(),
  created_at timestamptz not null default now()
);
create unique index if not exists accounting_payments_org_number_uniq
  on public.accounting_payments (org_id, payment_number);
create index if not exists accounting_payments_org_customer_idx
  on public.accounting_payments (org_id, customer_id);
create index if not exists accounting_payments_org_supplier_idx
  on public.accounting_payments (org_id, supplier_id);

do $$
declare t text;
begin
  foreach t in array array[
    'suppliers',
    'accounting_invoices',
    'accounting_bills',
    'accounting_expenses',
    'accounting_payments'
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
   limit 1;
  return account;
end $$;

create or replace function public._accounting_bank_account(p_org uuid, p_bank_account_id uuid)
returns uuid language plpgsql stable security definer set search_path = public as $$
declare
  account uuid;
begin
  if p_bank_account_id is not null then
    select id into account
      from public.chart_account
     where id = p_bank_account_id
       and org_id = p_org
       and is_active = true
       and type = 'ASSET';
    if account is null then
      raise exception 'Cash or bank account not found';
    end if;
    return account;
  end if;

  account := public._accounting_system_account(p_org, 'cash_on_hand');
  if account is null then
    select id into account
      from public.chart_account
     where org_id = p_org
       and is_active = true
       and type = 'ASSET'
       and is_bank = true
     order by code
     limit 1;
  end if;
  return account;
end $$;

create or replace function public._next_accounting_doc_number(
  p_org uuid,
  p_kind text,
  p_prefix text
)
returns text language plpgsql security definer set search_path = public as $$
declare
  yr text := to_char(now(), 'YYYY');
  n int;
begin
  if p_kind = 'invoice' then
    select coalesce(max(substring(invoice_number from '[0-9]+$')::int), 0) + 1
      into n from public.accounting_invoices
     where org_id = p_org and invoice_number like p_prefix || '-' || yr || '-%';
  elsif p_kind = 'bill' then
    select coalesce(max(substring(bill_number from '[0-9]+$')::int), 0) + 1
      into n from public.accounting_bills
     where org_id = p_org and bill_number like p_prefix || '-' || yr || '-%';
  elsif p_kind = 'expense' then
    select coalesce(max(substring(expense_number from '[0-9]+$')::int), 0) + 1
      into n from public.accounting_expenses
     where org_id = p_org and expense_number like p_prefix || '-' || yr || '-%';
  elsif p_kind = 'payment' then
    select coalesce(max(substring(payment_number from '[0-9]+$')::int), 0) + 1
      into n from public.accounting_payments
     where org_id = p_org and payment_number like p_prefix || '-' || yr || '-%';
  else
    raise exception 'Unknown accounting document kind';
  end if;

  return p_prefix || '-' || yr || '-' || lpad(n::text, 6, '0');
end $$;

create or replace function public.post_accounting_invoice(
  p_customer_id uuid,
  p_job_id uuid,
  p_date date,
  p_due_date date,
  p_amount numeric,
  p_has_vat boolean,
  p_memo text
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
  net_amt numeric(14,2);
  vat_amt numeric(14,2);
  gross_amt numeric(14,2);
  lines jsonb;
  journal jsonb;
begin
  if me is null or org is null then raise exception 'User not logged in'; end if;
  if public.current_app_role() not in ('admin', 'manager') then raise exception 'Permission denied'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Amount must be positive'; end if;
  if not exists (select 1 from public.customers where id = p_customer_id and org_id = org) then
    raise exception 'Customer not found';
  end if;
  if p_job_id is not null and not exists (select 1 from public.jobs where id = p_job_id and org_id = org) then
    raise exception 'Job not found';
  end if;

  ar_account := public._accounting_system_account(org, 'accounts_receivable');
  sales_account := public._accounting_system_account(org, 'sales_revenue');
  vat_account := public._accounting_system_account(org, 'vat_output');
  if ar_account is null or sales_account is null then
    raise exception 'Accounts Receivable or Sales Revenue account missing. Seed the chart of accounts.';
  end if;

  gross_amt := round(p_amount, 2);
  if coalesce(p_has_vat, false) then
    net_amt := round(gross_amt / 1.16, 2);
    vat_amt := gross_amt - net_amt;
    if vat_account is null then raise exception 'VAT Output account missing. Seed the chart of accounts.'; end if;
  else
    net_amt := gross_amt;
    vat_amt := 0;
  end if;

  invoice_no := public._next_accounting_doc_number(org, 'invoice', 'INV');
  insert into public.accounting_invoices (
    org_id, invoice_number, customer_id, job_id, date, due_date, status,
    has_vat, net_amount, vat_amount, total_amount, memo, created_by
  )
  values (
    org, invoice_no, p_customer_id, p_job_id, p_date::timestamptz, p_due_date::timestamptz,
    'posted', coalesce(p_has_vat, false), net_amt, vat_amt, gross_amt, nullif(p_memo, ''), me
  )
  returning id into invoice_id;

  lines := jsonb_build_array(
    jsonb_build_object('account_id', ar_account, 'debit', gross_amt, 'description', 'Customer invoice')
  );
  if vat_amt > 0 then
    lines := lines || jsonb_build_array(
      jsonb_build_object('account_id', vat_account, 'credit', vat_amt, 'description', 'VAT output')
    );
  end if;
  lines := lines || jsonb_build_array(
    jsonb_build_object('account_id', sales_account, 'credit', net_amt, 'description', 'Sales revenue')
  );

  journal := public.post_journal_entry(
    p_date, coalesce(nullif(p_memo, ''), 'Invoice ' || invoice_no),
    'SALE', 'Invoice', invoice_id::text, lines
  );

  update public.accounting_invoices
     set journal_entry_id = (journal->>'id')::uuid
   where id = invoice_id;

  return jsonb_build_object(
    'success', true,
    'invoice_id', invoice_id,
    'invoice_number', invoice_no,
    'invoiceNumber', invoice_no,
    'entry_number', journal->>'entry_number',
    'entryNumber', journal->>'entry_number'
  );
end $$;

create or replace function public.post_accounting_bill(
  p_supplier_id uuid,
  p_account_id uuid,
  p_date date,
  p_due_date date,
  p_amount numeric,
  p_has_vat boolean,
  p_memo text
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me uuid := public.current_app_user_id();
  org uuid := public.current_org_id();
  bill_id uuid;
  bill_no text;
  ap_account uuid;
  vat_account uuid;
  net_amt numeric(14,2);
  vat_amt numeric(14,2);
  gross_amt numeric(14,2);
  lines jsonb;
  journal jsonb;
begin
  if me is null or org is null then raise exception 'User not logged in'; end if;
  if public.current_app_role() not in ('admin', 'manager') then raise exception 'Permission denied'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Amount must be positive'; end if;
  if not exists (select 1 from public.suppliers where id = p_supplier_id and org_id = org) then
    raise exception 'Supplier not found';
  end if;
  if not exists (
    select 1 from public.chart_account
     where id = p_account_id and org_id = org and is_active = true and type in ('EXPENSE', 'ASSET')
  ) then
    raise exception 'Pick a valid expense or asset account';
  end if;

  ap_account := public._accounting_system_account(org, 'accounts_payable');
  vat_account := public._accounting_system_account(org, 'vat_input');
  if ap_account is null then raise exception 'Accounts Payable account missing. Seed the chart of accounts.'; end if;

  gross_amt := round(p_amount, 2);
  if coalesce(p_has_vat, false) then
    net_amt := round(gross_amt / 1.16, 2);
    vat_amt := gross_amt - net_amt;
    if vat_account is null then raise exception 'VAT Input account missing. Seed the chart of accounts.'; end if;
  else
    net_amt := gross_amt;
    vat_amt := 0;
  end if;

  bill_no := public._next_accounting_doc_number(org, 'bill', 'BILL');
  insert into public.accounting_bills (
    org_id, bill_number, supplier_id, account_id, date, due_date, status,
    has_vat, net_amount, vat_amount, total_amount, memo, created_by
  )
  values (
    org, bill_no, p_supplier_id, p_account_id, p_date::timestamptz, p_due_date::timestamptz,
    'posted', coalesce(p_has_vat, false), net_amt, vat_amt, gross_amt, nullif(p_memo, ''), me
  )
  returning id into bill_id;

  lines := jsonb_build_array(
    jsonb_build_object('account_id', p_account_id, 'debit', net_amt, 'description', 'Supplier bill')
  );
  if vat_amt > 0 then
    lines := lines || jsonb_build_array(
      jsonb_build_object('account_id', vat_account, 'debit', vat_amt, 'description', 'VAT input')
    );
  end if;
  lines := lines || jsonb_build_array(
    jsonb_build_object('account_id', ap_account, 'credit', gross_amt, 'description', 'Accounts payable')
  );

  journal := public.post_journal_entry(
    p_date, coalesce(nullif(p_memo, ''), 'Bill ' || bill_no),
    'PURCHASE', 'Bill', bill_id::text, lines
  );

  update public.accounting_bills
     set journal_entry_id = (journal->>'id')::uuid
   where id = bill_id;

  return jsonb_build_object(
    'success', true,
    'bill_id', bill_id,
    'bill_number', bill_no,
    'billNumber', bill_no,
    'entry_number', journal->>'entry_number',
    'entryNumber', journal->>'entry_number'
  );
end $$;

create or replace function public.post_accounting_expense(
  p_expense_account_id uuid,
  p_bank_account_id uuid,
  p_supplier_id uuid,
  p_vendor_name text,
  p_date date,
  p_amount numeric,
  p_has_vat boolean,
  p_memo text,
  p_reference text
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me uuid := public.current_app_user_id();
  org uuid := public.current_org_id();
  expense_id uuid;
  expense_no text;
  bank_account uuid;
  vat_account uuid;
  net_amt numeric(14,2);
  vat_amt numeric(14,2);
  gross_amt numeric(14,2);
  lines jsonb;
  journal jsonb;
begin
  if me is null or org is null then raise exception 'User not logged in'; end if;
  if public.current_app_role() not in ('admin', 'manager') then raise exception 'Permission denied'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Amount must be positive'; end if;
  if not exists (
    select 1 from public.chart_account
     where id = p_expense_account_id and org_id = org and is_active = true and type in ('EXPENSE', 'ASSET')
  ) then
    raise exception 'Pick a valid expense or asset account';
  end if;
  if p_supplier_id is not null and not exists (select 1 from public.suppliers where id = p_supplier_id and org_id = org) then
    raise exception 'Supplier not found';
  end if;

  bank_account := public._accounting_bank_account(org, p_bank_account_id);
  if bank_account is null then raise exception 'Cash or bank account missing. Seed the chart of accounts.'; end if;
  vat_account := public._accounting_system_account(org, 'vat_input');

  gross_amt := round(p_amount, 2);
  if coalesce(p_has_vat, false) then
    net_amt := round(gross_amt / 1.16, 2);
    vat_amt := gross_amt - net_amt;
    if vat_account is null then raise exception 'VAT Input account missing. Seed the chart of accounts.'; end if;
  else
    net_amt := gross_amt;
    vat_amt := 0;
  end if;

  expense_no := public._next_accounting_doc_number(org, 'expense', 'EXP');
  insert into public.accounting_expenses (
    org_id, expense_number, supplier_id, vendor_name, expense_account_id, bank_account_id,
    date, has_vat, net_amount, vat_amount, total_amount, memo, reference, created_by
  )
  values (
    org, expense_no, p_supplier_id, nullif(p_vendor_name, ''), p_expense_account_id, bank_account,
    p_date::timestamptz, coalesce(p_has_vat, false), net_amt, vat_amt, gross_amt,
    nullif(p_memo, ''), nullif(p_reference, ''), me
  )
  returning id into expense_id;

  lines := jsonb_build_array(
    jsonb_build_object('account_id', p_expense_account_id, 'debit', net_amt, 'description', 'Expense')
  );
  if vat_amt > 0 then
    lines := lines || jsonb_build_array(
      jsonb_build_object('account_id', vat_account, 'debit', vat_amt, 'description', 'VAT input')
    );
  end if;
  lines := lines || jsonb_build_array(
    jsonb_build_object('account_id', bank_account, 'credit', gross_amt, 'description', 'Paid')
  );

  journal := public.post_journal_entry(
    p_date, coalesce(nullif(p_memo, ''), 'Expense ' || expense_no),
    'EXPENSE', 'Expense', expense_id::text, lines
  );

  update public.accounting_expenses
     set journal_entry_id = (journal->>'id')::uuid
   where id = expense_id;

  return jsonb_build_object(
    'success', true,
    'expense_id', expense_id,
    'expense_number', expense_no,
    'expenseNumber', expense_no,
    'entry_number', journal->>'entry_number',
    'entryNumber', journal->>'entry_number'
  );
end $$;

create or replace function public.record_accounting_payment(
  p_direction text,
  p_customer_id uuid,
  p_supplier_id uuid,
  p_invoice_id uuid,
  p_bill_id uuid,
  p_bank_account_id uuid,
  p_date date,
  p_amount numeric,
  p_method text,
  p_reference text,
  p_notes text
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me uuid := public.current_app_user_id();
  org uuid := public.current_org_id();
  dir text := lower(coalesce(p_direction, ''));
  payment_id uuid;
  payment_no text;
  bank_account uuid;
  ar_account uuid;
  ap_account uuid;
  amount numeric(14,2);
  customer uuid := p_customer_id;
  supplier uuid := p_supplier_id;
  lines jsonb;
  journal jsonb;
  paid_total numeric(14,2);
  doc_total numeric(14,2);
begin
  if me is null or org is null then raise exception 'User not logged in'; end if;
  if public.current_app_role() not in ('admin', 'manager') then raise exception 'Permission denied'; end if;
  if dir not in ('received', 'paid') then raise exception 'Payment direction must be received or paid'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Amount must be positive'; end if;

  amount := round(p_amount, 2);
  bank_account := public._accounting_bank_account(org, p_bank_account_id);
  if bank_account is null then raise exception 'Cash or bank account missing. Seed the chart of accounts.'; end if;

  if dir = 'received' then
    ar_account := public._accounting_system_account(org, 'accounts_receivable');
    if ar_account is null then raise exception 'Accounts Receivable account missing. Seed the chart of accounts.'; end if;
    if p_invoice_id is not null then
      select customer_id into customer
        from public.accounting_invoices
       where id = p_invoice_id and org_id = org;
      if customer is null then raise exception 'Invoice not found'; end if;
    end if;
    if customer is null or not exists (select 1 from public.customers where id = customer and org_id = org) then
      raise exception 'Customer not found';
    end if;
  else
    ap_account := public._accounting_system_account(org, 'accounts_payable');
    if ap_account is null then raise exception 'Accounts Payable account missing. Seed the chart of accounts.'; end if;
    if p_bill_id is not null then
      select supplier_id into supplier
        from public.accounting_bills
       where id = p_bill_id and org_id = org;
      if supplier is null then raise exception 'Bill not found'; end if;
    end if;
    if supplier is null or not exists (select 1 from public.suppliers where id = supplier and org_id = org) then
      raise exception 'Supplier not found';
    end if;
  end if;

  payment_no := public._next_accounting_doc_number(
    org, 'payment', case when dir = 'received' then 'RCT' else 'PMT' end
  );
  insert into public.accounting_payments (
    org_id, payment_number, direction, customer_id, supplier_id, invoice_id, bill_id,
    bank_account_id, method, date, amount, reference, notes, created_by
  )
  values (
    org, payment_no, dir,
    case when dir = 'received' then customer else null end,
    case when dir = 'paid' then supplier else null end,
    case when dir = 'received' then p_invoice_id else null end,
    case when dir = 'paid' then p_bill_id else null end,
    bank_account, coalesce(nullif(p_method, ''), 'bank_transfer'),
    p_date::timestamptz, amount, nullif(p_reference, ''), nullif(p_notes, ''), me
  )
  returning id into payment_id;

  if dir = 'received' then
    lines := jsonb_build_array(
      jsonb_build_object('account_id', bank_account, 'debit', amount, 'description', 'Payment received'),
      jsonb_build_object('account_id', ar_account, 'credit', amount, 'description', 'Settle debtor')
    );
  else
    lines := jsonb_build_array(
      jsonb_build_object('account_id', ap_account, 'debit', amount, 'description', 'Settle creditor'),
      jsonb_build_object('account_id', bank_account, 'credit', amount, 'description', 'Payment made')
    );
  end if;

  journal := public.post_journal_entry(
    p_date,
    case when dir = 'received' then 'Receipt ' || payment_no else 'Payment ' || payment_no end,
    case when dir = 'received' then 'PAYMENT_RECEIVED' else 'PAYMENT_MADE' end,
    'Payment',
    payment_id::text,
    lines
  );

  update public.accounting_payments
     set journal_entry_id = (journal->>'id')::uuid
   where id = payment_id;

  if dir = 'received' and p_invoice_id is not null then
    select coalesce(sum(amount), 0) into paid_total
      from public.accounting_payments
     where org_id = org and direction = 'received' and invoice_id = p_invoice_id;
    select total_amount into doc_total
      from public.accounting_invoices
     where id = p_invoice_id and org_id = org;
    update public.accounting_invoices
       set status = case when paid_total >= doc_total - 0.01 then 'paid' else 'partial' end
     where id = p_invoice_id;
  elsif dir = 'paid' and p_bill_id is not null then
    select coalesce(sum(amount), 0) into paid_total
      from public.accounting_payments
     where org_id = org and direction = 'paid' and bill_id = p_bill_id;
    select total_amount into doc_total
      from public.accounting_bills
     where id = p_bill_id and org_id = org;
    update public.accounting_bills
       set status = case when paid_total >= doc_total - 0.01 then 'paid' else 'partial' end
     where id = p_bill_id;
  end if;

  return jsonb_build_object(
    'success', true,
    'payment_id', payment_id,
    'payment_number', payment_no,
    'paymentNumber', payment_no,
    'entry_number', journal->>'entry_number',
    'entryNumber', journal->>'entry_number'
  );
end $$;

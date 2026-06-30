-- =============================================================================
-- WORKFLOWIQ | 010_transport_coa_seed.sql
-- Transport-industry Chart of Accounts seeder with tax codes and header accounts.
-- =============================================================================

create table if not exists public.accounting_tax_code (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org_id() references public.organizations(id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('vat_standard', 'vat_zero', 'vat_exempt')),
  rate numeric(7,4) not null default 0,
  is_active boolean not null default true,
  created_by uuid references public.app_users(id) on delete set null default public.current_app_user_id(),
  created_at timestamptz not null default now()
);

create unique index if not exists accounting_tax_code_org_name_uniq
  on public.accounting_tax_code (org_id, name);
create index if not exists accounting_tax_code_org_kind_idx
  on public.accounting_tax_code (org_id, kind)
  where is_active = true;

alter table public.accounting_tax_code enable row level security;

drop policy if exists accounting_tax_code_select on public.accounting_tax_code;
drop policy if exists accounting_tax_code_insert on public.accounting_tax_code;
drop policy if exists accounting_tax_code_update on public.accounting_tax_code;
drop policy if exists accounting_tax_code_delete on public.accounting_tax_code;
create policy accounting_tax_code_select on public.accounting_tax_code for select to authenticated
  using (org_id = public.current_org_id());
create policy accounting_tax_code_insert on public.accounting_tax_code for insert to authenticated
  with check (org_id = public.current_org_id() and public.current_app_user_id() is not null);
create policy accounting_tax_code_update on public.accounting_tax_code for update to authenticated
  using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());
create policy accounting_tax_code_delete on public.accounting_tax_code for delete to authenticated
  using (org_id = public.current_org_id() and public.current_app_role() = 'admin');

alter table public.chart_account add column if not exists is_postable boolean;
alter table public.chart_account add column if not exists tax_code_id uuid;

update public.chart_account
   set is_postable = coalesce(is_postable, true);

alter table public.chart_account alter column is_postable set default true;
alter table public.chart_account alter column is_postable set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'chart_account_tax_code_id_fkey'
       and conrelid = 'public.chart_account'::regclass
  ) then
    alter table public.chart_account
      add constraint chart_account_tax_code_id_fkey
      foreign key (tax_code_id) references public.accounting_tax_code(id) on delete set null;
  end if;
end $$;

create index if not exists chart_account_org_postable_idx
  on public.chart_account (org_id, is_postable)
  where is_active = true;
create index if not exists chart_account_org_tax_code_idx
  on public.chart_account (org_id, tax_code_id)
  where tax_code_id is not null;

create or replace function public._transport_coa_template()
returns table (
  code text,
  name text,
  account_type text,
  normal_balance text,
  classification text,
  statement_group text,
  currency text,
  is_postable boolean,
  is_bank boolean,
  system_key text,
  tax_name text
)
language sql stable as $$
  select
    code::text,
    name::text,
    account_type::text,
    normal_balance::text,
    classification::text,
    statement_group::text,
    currency::text,
    is_postable::boolean,
    is_bank::boolean,
    system_key::text,
    tax_name::text
  from (
    values
      ('1000', 'Cash in Hand', 'ASSET', 'DEBIT', 'BANK', 'CURRENT_ASSETS', 'KES', true, false, 'cash_on_hand', null),
      ('1010', 'Undeposited Funds', 'ASSET', 'DEBIT', 'OTHER_CURRENT_ASSETS', 'CURRENT_ASSETS', 'KES', true, false, null, null),
      ('1020', 'Bank Accounts - KES', 'ASSET', 'DEBIT', 'BANK', 'CURRENT_ASSETS', 'KES', false, true, null, null),
      ('1040', 'Bank Accounts - USD', 'ASSET', 'DEBIT', 'BANK', 'CURRENT_ASSETS', 'USD', false, true, null, null),
      ('1060', 'Fixed / Term Deposits', 'ASSET', 'DEBIT', 'OTHER_CURRENT_ASSETS', 'CURRENT_ASSETS', 'KES', false, false, null, null),
      ('1100', 'Accounts Receivable - KES', 'ASSET', 'DEBIT', 'ACCOUNTS_RECEIVABLE', 'CURRENT_ASSETS', 'KES', true, false, 'accounts_receivable', null),
      ('1101', 'Accounts Receivable - USD', 'ASSET', 'DEBIT', 'ACCOUNTS_RECEIVABLE', 'CURRENT_ASSETS', 'USD', true, false, null, null),
      ('1150', 'Driver Advances', 'ASSET', 'DEBIT', 'OTHER_CURRENT_ASSETS', 'CURRENT_ASSETS', 'KES', true, false, null, null),
      ('1160', 'Advance Tax', 'ASSET', 'DEBIT', 'OTHER_CURRENT_ASSETS', 'CURRENT_ASSETS', 'KES', true, false, null, null),
      ('1170', 'VAT Receivable (Input VAT)', 'ASSET', 'DEBIT', 'OTHER_CURRENT_ASSETS', 'CURRENT_ASSETS', 'KES', true, false, 'vat_input', null),
      ('1175', 'WHT Tax Receivable', 'ASSET', 'DEBIT', 'OTHER_CURRENT_ASSETS', 'CURRENT_ASSETS', 'KES', true, false, null, null),
      ('1180', 'Prepaid Expenses', 'ASSET', 'DEBIT', 'OTHER_CURRENT_ASSETS', 'CURRENT_ASSETS', 'KES', true, false, null, null),
      ('1185', 'Security Deposits', 'ASSET', 'DEBIT', 'OTHER_CURRENT_ASSETS', 'CURRENT_ASSETS', 'KES', true, false, null, null),
      ('1190', 'Inventories / Stock', 'ASSET', 'DEBIT', 'OTHER_CURRENT_ASSETS', 'CURRENT_ASSETS', 'KES', true, false, 'inventory', null),
      ('1500', 'Motor Vehicles & Lorries', 'ASSET', 'DEBIT', 'FIXED_ASSETS', 'NON_CURRENT_ASSETS', 'KES', false, false, null, null),
      ('1510', 'Trailers', 'ASSET', 'DEBIT', 'FIXED_ASSETS', 'NON_CURRENT_ASSETS', 'KES', false, false, null, null),
      ('1520', 'Plant & Equipment', 'ASSET', 'DEBIT', 'FIXED_ASSETS', 'NON_CURRENT_ASSETS', 'KES', true, false, null, null),
      ('1525', 'Office Equipment & Computers', 'ASSET', 'DEBIT', 'FIXED_ASSETS', 'NON_CURRENT_ASSETS', 'KES', true, false, null, null),
      ('1530', 'Furniture & Fixtures', 'ASSET', 'DEBIT', 'FIXED_ASSETS', 'NON_CURRENT_ASSETS', 'KES', true, false, null, null),
      ('1535', 'Land & Buildings', 'ASSET', 'DEBIT', 'FIXED_ASSETS', 'NON_CURRENT_ASSETS', 'KES', true, false, null, null),
      ('1540', 'Leasehold Improvements', 'ASSET', 'DEBIT', 'FIXED_ASSETS', 'NON_CURRENT_ASSETS', 'KES', true, false, null, null),
      ('1545', 'Intangibles / Software', 'ASSET', 'DEBIT', 'FIXED_ASSETS', 'NON_CURRENT_ASSETS', 'KES', true, false, null, null),
      ('1590', 'Accumulated Depreciation', 'ASSET', 'CREDIT', 'FIXED_ASSETS', 'NON_CURRENT_ASSETS', 'KES', true, false, null, null),
      ('2100', 'Accounts Payable - KES', 'LIABILITY', 'CREDIT', 'ACCOUNTS_PAYABLE', 'CURRENT_LIABILITIES', 'KES', true, false, 'accounts_payable', null),
      ('2101', 'Accounts Payable - USD', 'LIABILITY', 'CREDIT', 'ACCOUNTS_PAYABLE', 'CURRENT_LIABILITIES', 'USD', true, false, null, null),
      ('2200', 'VAT Payable (Output VAT)', 'LIABILITY', 'CREDIT', 'OTHER_CURRENT_LIABILITY', 'CURRENT_LIABILITIES', 'KES', true, false, 'vat_output', null),
      ('2205', 'VAT Control', 'LIABILITY', 'CREDIT', 'OTHER_CURRENT_LIABILITY', 'CURRENT_LIABILITIES', 'KES', true, false, null, null),
      ('2210', 'Withholding VAT Payable', 'LIABILITY', 'CREDIT', 'OTHER_CURRENT_LIABILITY', 'CURRENT_LIABILITIES', 'KES', true, false, null, null),
      ('2215', 'WHT Income Tax Payable', 'LIABILITY', 'CREDIT', 'OTHER_CURRENT_LIABILITY', 'CURRENT_LIABILITIES', 'KES', true, false, null, null),
      ('2220', 'PAYE Payable', 'LIABILITY', 'CREDIT', 'OTHER_CURRENT_LIABILITY', 'CURRENT_LIABILITIES', 'KES', true, false, null, null),
      ('2225', 'NSSF Payable', 'LIABILITY', 'CREDIT', 'OTHER_CURRENT_LIABILITY', 'CURRENT_LIABILITIES', 'KES', true, false, null, null),
      ('2230', 'SHIF Payable', 'LIABILITY', 'CREDIT', 'OTHER_CURRENT_LIABILITY', 'CURRENT_LIABILITIES', 'KES', true, false, null, null),
      ('2235', 'Housing Levy Payable', 'LIABILITY', 'CREDIT', 'OTHER_CURRENT_LIABILITY', 'CURRENT_LIABILITIES', 'KES', true, false, null, null),
      ('2240', 'Corporation Tax Payable', 'LIABILITY', 'CREDIT', 'OTHER_CURRENT_LIABILITY', 'CURRENT_LIABILITIES', 'KES', true, false, null, null),
      ('2300', 'Accruals', 'LIABILITY', 'CREDIT', 'OTHER_CURRENT_LIABILITY', 'CURRENT_LIABILITIES', 'KES', true, false, null, null),
      ('2310', 'Customer Deposits', 'LIABILITY', 'CREDIT', 'OTHER_CURRENT_LIABILITY', 'CURRENT_LIABILITIES', 'KES', true, false, null, null),
      ('2500', 'Bank Loans', 'LIABILITY', 'CREDIT', 'LOAN', 'NON_CURRENT_LIABILITIES', 'KES', false, false, null, null),
      ('2520', 'Overdraft Facilities', 'LIABILITY', 'CREDIT', 'LOAN', 'NON_CURRENT_LIABILITIES', 'KES', false, false, null, null),
      ('2530', 'Other Financing Facilities', 'LIABILITY', 'CREDIT', 'LOAN', 'NON_CURRENT_LIABILITIES', 'KES', false, false, null, null),
      ('2590', 'Deferred Tax Liability', 'LIABILITY', 'CREDIT', 'LOAN', 'NON_CURRENT_LIABILITIES', 'KES', true, false, null, null),
      ('3000', 'Share Capital', 'EQUITY', 'CREDIT', 'EQUITY', 'EQUITY', 'KES', true, false, null, null),
      ('3010', 'Members'' / Owners'' Equity', 'EQUITY', 'CREDIT', 'EQUITY', 'EQUITY', 'KES', true, false, null, null),
      ('3020', 'Drawings', 'EQUITY', 'DEBIT', 'EQUITY', 'EQUITY', 'KES', false, false, null, null),
      ('3030', 'Opening Balance Equity', 'EQUITY', 'CREDIT', 'EQUITY', 'EQUITY', 'KES', true, false, null, null),
      ('3090', 'Retained Earnings', 'EQUITY', 'CREDIT', 'EQUITY', 'EQUITY', 'KES', true, false, 'retained_earnings', null),
      ('4000', 'Transport Income - Direct', 'INCOME', 'CREDIT', 'INCOME', 'REVENUE', 'KES', true, false, 'sales_revenue', 'VAT Std 16%'),
      ('4005', 'Transport Income - Subcontracted-In', 'INCOME', 'CREDIT', 'INCOME', 'REVENUE', 'KES', true, false, null, 'VAT Std 16%'),
      ('4010', 'Fuel Surcharge', 'INCOME', 'CREDIT', 'INCOME', 'REVENUE', 'KES', true, false, null, 'VAT Std 16%'),
      ('4015', 'Ancillary Fees (Pallet/Stop/Unloading)', 'INCOME', 'CREDIT', 'INCOME', 'REVENUE', 'KES', true, false, null, 'VAT Std 16%'),
      ('4020', 'Export Transport Income', 'INCOME', 'CREDIT', 'INCOME', 'REVENUE', 'USD', true, false, null, 'VAT Zero'),
      ('4100', 'Interest Income', 'INCOME', 'CREDIT', 'OTHER_INCOME', 'OTHER_INCOME', 'KES', true, false, null, 'Exempt'),
      ('4110', 'Insurance Claims Received', 'INCOME', 'CREDIT', 'OTHER_INCOME', 'OTHER_INCOME', 'KES', true, false, null, 'Exempt'),
      ('4120', 'Realised FX Gain', 'INCOME', 'CREDIT', 'OTHER_INCOME', 'OTHER_INCOME', 'KES', true, false, null, 'Exempt'),
      ('4125', 'Unrealised FX Gain', 'INCOME', 'CREDIT', 'OTHER_INCOME', 'OTHER_INCOME', 'KES', true, false, null, 'Exempt'),
      ('5000', 'Fuels & Lubricants', 'EXPENSE', 'DEBIT', 'COST_OF_GOODS_SOLD', 'COST_OF_GOODS_SOLD', 'KES', true, false, 'cost_of_sales', 'VAT Std 16%'),
      ('5005', 'Drivers - Food, Accom & Roadside', 'EXPENSE', 'DEBIT', 'COST_OF_GOODS_SOLD', 'COST_OF_GOODS_SOLD', 'KES', true, false, null, null),
      ('5010', 'Road User & Other Charges', 'EXPENSE', 'DEBIT', 'COST_OF_GOODS_SOLD', 'COST_OF_GOODS_SOLD', 'KES', true, false, null, null),
      ('5015', 'Port Charges', 'EXPENSE', 'DEBIT', 'COST_OF_GOODS_SOLD', 'COST_OF_GOODS_SOLD', 'KES', true, false, null, 'VAT Std 16%'),
      ('5020', 'Weighbridge', 'EXPENSE', 'DEBIT', 'COST_OF_GOODS_SOLD', 'COST_OF_GOODS_SOLD', 'KES', true, false, null, null),
      ('5025', 'Parking', 'EXPENSE', 'DEBIT', 'COST_OF_GOODS_SOLD', 'COST_OF_GOODS_SOLD', 'KES', true, false, null, null),
      ('5030', 'Transit Goods Licenses', 'EXPENSE', 'DEBIT', 'COST_OF_GOODS_SOLD', 'COST_OF_GOODS_SOLD', 'KES', true, false, null, null),
      ('5035', 'Loading / Offloading', 'EXPENSE', 'DEBIT', 'COST_OF_GOODS_SOLD', 'COST_OF_GOODS_SOLD', 'KES', true, false, null, null),
      ('5040', 'Fare / Mileage', 'EXPENSE', 'DEBIT', 'COST_OF_GOODS_SOLD', 'COST_OF_GOODS_SOLD', 'KES', true, false, null, null),
      ('5045', 'Breakdown', 'EXPENSE', 'DEBIT', 'COST_OF_GOODS_SOLD', 'COST_OF_GOODS_SOLD', 'KES', true, false, null, null),
      ('5050', 'Inspection', 'EXPENSE', 'DEBIT', 'COST_OF_GOODS_SOLD', 'COST_OF_GOODS_SOLD', 'KES', true, false, null, null),
      ('5055', 'Standards Levy', 'EXPENSE', 'DEBIT', 'COST_OF_GOODS_SOLD', 'COST_OF_GOODS_SOLD', 'KES', true, false, null, null),
      ('5200', 'Hiring / Subcontractor Costs', 'EXPENSE', 'DEBIT', 'COST_OF_GOODS_SOLD', 'COST_OF_GOODS_SOLD', 'KES', true, false, null, 'VAT Std 16%'),
      ('5210', 'Commissions Paid', 'EXPENSE', 'DEBIT', 'COST_OF_GOODS_SOLD', 'COST_OF_GOODS_SOLD', 'KES', true, false, null, null),
      ('5400', 'Truck Maintenance & Repairs', 'EXPENSE', 'DEBIT', 'COST_OF_GOODS_SOLD', 'COST_OF_GOODS_SOLD', 'KES', true, false, null, 'VAT Std 16%'),
      ('5405', 'Salaries & Wages - Drivers/Crew', 'EXPENSE', 'DEBIT', 'COST_OF_GOODS_SOLD', 'COST_OF_GOODS_SOLD', 'KES', true, false, null, null),
      ('5410', 'Insurance - Fleet', 'EXPENSE', 'DEBIT', 'COST_OF_GOODS_SOLD', 'COST_OF_GOODS_SOLD', 'KES', true, false, null, null),
      ('5415', 'Tracking - Trucks & Seals', 'EXPENSE', 'DEBIT', 'COST_OF_GOODS_SOLD', 'COST_OF_GOODS_SOLD', 'KES', true, false, null, 'VAT Std 16%'),
      ('5420', 'Security - Transport', 'EXPENSE', 'DEBIT', 'COST_OF_GOODS_SOLD', 'COST_OF_GOODS_SOLD', 'KES', true, false, null, null),
      ('5425', 'Licenses & Permits', 'EXPENSE', 'DEBIT', 'COST_OF_GOODS_SOLD', 'COST_OF_GOODS_SOLD', 'KES', true, false, null, null),
      ('5600', 'Yard Expenses', 'EXPENSE', 'DEBIT', 'COST_OF_GOODS_SOLD', 'COST_OF_GOODS_SOLD', 'KES', true, false, null, null),
      ('5605', 'Yard Utilities', 'EXPENSE', 'DEBIT', 'COST_OF_GOODS_SOLD', 'COST_OF_GOODS_SOLD', 'KES', true, false, null, null),
      ('6000', 'Management Salaries', 'EXPENSE', 'DEBIT', 'EXPENSE', 'ADMINISTRATIVE_EXPENSES', 'KES', true, false, null, null),
      ('6005', 'Directors'' Salaries', 'EXPENSE', 'DEBIT', 'EXPENSE', 'ADMINISTRATIVE_EXPENSES', 'KES', true, false, null, null),
      ('6010', 'Audit Fees', 'EXPENSE', 'DEBIT', 'EXPENSE', 'ADMINISTRATIVE_EXPENSES', 'KES', true, false, null, null),
      ('6015', 'Legal Fees', 'EXPENSE', 'DEBIT', 'EXPENSE', 'ADMINISTRATIVE_EXPENSES', 'KES', true, false, null, null),
      ('6020', 'Consultancy & Professional Fees', 'EXPENSE', 'DEBIT', 'EXPENSE', 'ADMINISTRATIVE_EXPENSES', 'KES', true, false, null, 'VAT Std 16%'),
      ('6025', 'Book-keeping', 'EXPENSE', 'DEBIT', 'EXPENSE', 'ADMINISTRATIVE_EXPENSES', 'KES', true, false, null, null),
      ('6030', 'Office Expense', 'EXPENSE', 'DEBIT', 'EXPENSE', 'ADMINISTRATIVE_EXPENSES', 'KES', true, false, null, null),
      ('6035', 'Telephone & Internet', 'EXPENSE', 'DEBIT', 'EXPENSE', 'ADMINISTRATIVE_EXPENSES', 'KES', true, false, null, 'VAT Std 16%'),
      ('6040', 'Printing & Stationery', 'EXPENSE', 'DEBIT', 'EXPENSE', 'ADMINISTRATIVE_EXPENSES', 'KES', true, false, null, null),
      ('6045', 'Postage & Delivery', 'EXPENSE', 'DEBIT', 'EXPENSE', 'ADMINISTRATIVE_EXPENSES', 'KES', true, false, null, null),
      ('6050', 'Advertising & Promotion', 'EXPENSE', 'DEBIT', 'EXPENSE', 'ADMINISTRATIVE_EXPENSES', 'KES', true, false, null, 'VAT Std 16%'),
      ('6055', 'Dues & Subscriptions', 'EXPENSE', 'DEBIT', 'EXPENSE', 'ADMINISTRATIVE_EXPENSES', 'KES', true, false, null, null),
      ('6060', 'Travelling & Entertainment', 'EXPENSE', 'DEBIT', 'EXPENSE', 'ADMINISTRATIVE_EXPENSES', 'KES', true, false, null, null),
      ('6065', 'Staff Welfare / Medical / Uniforms', 'EXPENSE', 'DEBIT', 'EXPENSE', 'ADMINISTRATIVE_EXPENSES', 'KES', true, false, null, null),
      ('6070', 'Rent & Rates', 'EXPENSE', 'DEBIT', 'EXPENSE', 'ADMINISTRATIVE_EXPENSES', 'KES', true, false, null, null),
      ('6075', 'Office Utilities', 'EXPENSE', 'DEBIT', 'EXPENSE', 'ADMINISTRATIVE_EXPENSES', 'KES', true, false, null, null),
      ('6080', 'Equipment Rental', 'EXPENSE', 'DEBIT', 'EXPENSE', 'ADMINISTRATIVE_EXPENSES', 'KES', true, false, null, 'VAT Std 16%'),
      ('6085', 'Bank Service Charges', 'EXPENSE', 'DEBIT', 'EXPENSE', 'ADMINISTRATIVE_EXPENSES', 'KES', true, false, null, null),
      ('6090', 'Miscellaneous Expense', 'EXPENSE', 'DEBIT', 'EXPENSE', 'ADMINISTRATIVE_EXPENSES', 'KES', true, false, null, null),
      ('7000', 'Depreciation Expense', 'EXPENSE', 'DEBIT', 'OTHER_EXPENSE', 'OTHER_OPERATING_EXPENSES', 'KES', true, false, null, null),
      ('7010', 'Interest Expense - Loans', 'EXPENSE', 'DEBIT', 'OTHER_EXPENSE', 'FINANCE_CHARGES', 'KES', true, false, null, null),
      ('7015', 'Overdraft Interest', 'EXPENSE', 'DEBIT', 'OTHER_EXPENSE', 'FINANCE_CHARGES', 'KES', true, false, null, null),
      ('7020', 'Realised FX Loss', 'EXPENSE', 'DEBIT', 'OTHER_EXPENSE', 'OTHER_OPERATING_EXPENSES', 'KES', true, false, null, null),
      ('7025', 'Unrealised FX Loss', 'EXPENSE', 'DEBIT', 'OTHER_EXPENSE', 'OTHER_OPERATING_EXPENSES', 'KES', true, false, null, null),
      ('7030', 'Cost of Goods Sold', 'EXPENSE', 'DEBIT', 'COST_OF_GOODS_SOLD', 'COST_OF_GOODS_SOLD', 'KES', true, false, null, null),
      ('9000', 'Suspense', 'ASSET', 'DEBIT', 'OTHER_CURRENT_ASSETS', 'CURRENT_ASSETS', 'KES', true, false, null, null),
      ('9010', 'Rounding Off', 'EXPENSE', 'DEBIT', 'OTHER_EXPENSE', 'OTHER_OPERATING_EXPENSES', 'KES', true, false, null, null),
      ('9020', 'Reconciliation Discrepancies', 'EXPENSE', 'DEBIT', 'OTHER_EXPENSE', 'OTHER_OPERATING_EXPENSES', 'KES', true, false, null, null),
      ('9030', 'Uncategorized Income', 'INCOME', 'CREDIT', 'OTHER_INCOME', 'OTHER_INCOME', 'KES', true, false, null, null),
      ('9040', 'Uncategorized Expenses', 'EXPENSE', 'DEBIT', 'OTHER_EXPENSE', 'OTHER_OPERATING_EXPENSES', 'KES', true, false, null, null)
  ) as t(
    code,
    name,
    account_type,
    normal_balance,
    classification,
    statement_group,
    currency,
    is_postable,
    is_bank,
    system_key,
    tax_name
  );
$$;

create or replace function public._seed_transport_chart_of_accounts(
  p_org uuid,
  p_actor uuid default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  before_count int;
  after_count int;
  tax_count int;
  template_count int;
begin
  if p_org is null then
    raise exception 'Organization is required';
  end if;

  insert into public.accounting_tax_code (
    org_id, name, kind, rate, is_active, created_by
  )
  values
    (p_org, 'VAT Std 16%', 'vat_standard', 0.1600, true, p_actor),
    (p_org, 'VAT Zero', 'vat_zero', 0.0000, true, p_actor),
    (p_org, 'Exempt', 'vat_exempt', 0.0000, true, p_actor)
  on conflict (org_id, name) do update
    set kind = excluded.kind,
        rate = excluded.rate,
        is_active = true;

  select count(*) into before_count
    from public.chart_account
   where org_id = p_org;

  insert into public.chart_account (
    org_id,
    code,
    name,
    type,
    normal_balance,
    classification,
    statement_group,
    currency,
    parent_id,
    note,
    vat_applicable,
    tax_code_id,
    is_bank,
    is_system,
    is_active,
    is_postable,
    description,
    created_by
  )
  select
    p_org,
    t.code,
    t.name,
    t.account_type,
    t.normal_balance,
    t.classification,
    t.statement_group,
    t.currency,
    null,
    case
      when t.is_postable then null
      else 'Header account. Add organization-specific accounts under this parent.'
    end,
    t.tax_name is not null,
    tc.id,
    t.is_bank,
    t.system_key is not null,
    true,
    t.is_postable,
    case when t.system_key is null then null else 'key:' || t.system_key end,
    p_actor
  from public._transport_coa_template() t
  left join public.accounting_tax_code tc
    on tc.org_id = p_org
   and tc.name = t.tax_name
  on conflict (org_id, code) do nothing;

  update public.chart_account child
     set parent_id = parent.id
    from public.chart_account parent
   where child.org_id = p_org
     and parent.org_id = p_org
     and child.parent_id is null
     and position('.' in child.code) > 0
     and parent.code = split_part(child.code, '.', 1);

  select count(*) into after_count
    from public.chart_account
   where org_id = p_org;

  select count(*) into tax_count
    from public.accounting_tax_code
   where org_id = p_org
     and name in ('VAT Std 16%', 'VAT Zero', 'Exempt');

  select count(*) into template_count
    from public._transport_coa_template();

  return jsonb_build_object(
    'success', true,
    'created', after_count - before_count,
    'total', after_count,
    'templateTotal', template_count,
    'taxCodes', tax_count
  );
end $$;

create or replace function public.seed_chart_of_accounts()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me uuid := public.current_app_user_id();
  org uuid := public.current_org_id();
begin
  if me is null or org is null then
    raise exception 'User not logged in';
  end if;
  if public.current_app_role() <> 'admin' then
    raise exception 'Only admins can set up the chart of accounts';
  end if;

  return public._seed_transport_chart_of_accounts(org, me);
end $$;

create or replace function public.ensure_ledger_account_is_postable()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (
    select 1
      from public.chart_account
     where id = new.account_id
       and is_postable = false
  ) then
    raise exception 'Header accounts cannot receive ledger entries';
  end if;

  return new;
end $$;

drop trigger if exists ledger_line_postable_account on public.ledger_line;
create trigger ledger_line_postable_account
  before insert or update of account_id on public.ledger_line
  for each row execute function public.ensure_ledger_account_is_postable();

do $$
declare
  org_row record;
begin
  for org_row in
    select o.id
      from public.organizations o
     where not exists (
       select 1
         from public.chart_account ca
        where ca.org_id = o.id
     )
  loop
    perform public._seed_transport_chart_of_accounts(org_row.id, null);
  end loop;
end $$;

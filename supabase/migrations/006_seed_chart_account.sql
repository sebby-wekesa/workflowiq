-- =============================================================================
-- WORKFLOWIQ | 06_seed_chart_account.sql
-- Seeds a standard Kenyan SME chart of accounts per organization.
-- =============================================================================

insert into public.chart_account (
  org_id, code, name, type, normal_balance, is_bank, is_system, description
)
select
  o.id,
  c.code,
  c.name,
  c.type,
  c.normal_balance,
  c.is_bank,
  c.system_key is not null,
  case when c.system_key is null then null else 'key:' || c.system_key end
from public.organizations o
cross join (
  values
    ('1000', 'Cash on Hand', 'ASSET', 'DEBIT', false, 'cash_on_hand'),
    ('1010', 'Petty Cash', 'ASSET', 'DEBIT', false, null),
    ('1100', 'Bank - Current Account', 'ASSET', 'DEBIT', true, null),
    ('1110', 'M-Pesa Paybill / Till', 'ASSET', 'DEBIT', true, null),
    ('1200', 'Accounts Receivable (Debtors)', 'ASSET', 'DEBIT', false, 'accounts_receivable'),
    ('1300', 'Inventory - Finished Goods', 'ASSET', 'DEBIT', false, 'inventory'),
    ('1310', 'Inventory - Raw Materials', 'ASSET', 'DEBIT', false, 'raw_materials_inventory'),
    ('1400', 'VAT Input (Receivable)', 'ASSET', 'DEBIT', false, 'vat_input'),
    ('1500', 'Property, Plant & Equipment', 'ASSET', 'DEBIT', false, null),
    ('1510', 'Accumulated Depreciation', 'ASSET', 'CREDIT', false, null),
    ('2000', 'Accounts Payable (Creditors)', 'LIABILITY', 'CREDIT', false, 'accounts_payable'),
    ('2100', 'VAT Output (Payable)', 'LIABILITY', 'CREDIT', false, 'vat_output'),
    ('2110', 'PAYE Payable', 'LIABILITY', 'CREDIT', false, null),
    ('2120', 'NHIF Payable', 'LIABILITY', 'CREDIT', false, null),
    ('2130', 'NSSF Payable', 'LIABILITY', 'CREDIT', false, null),
    ('2200', 'Accrued Expenses', 'LIABILITY', 'CREDIT', false, null),
    ('2300', 'Loans Payable', 'LIABILITY', 'CREDIT', false, null),
    ('3000', 'Owner''s Capital', 'EQUITY', 'CREDIT', false, null),
    ('3100', 'Drawings', 'EQUITY', 'DEBIT', false, null),
    ('3200', 'Retained Earnings', 'EQUITY', 'CREDIT', false, 'retained_earnings'),
    ('4000', 'Sales Revenue', 'INCOME', 'CREDIT', false, 'sales_revenue'),
    ('4100', 'Other Income', 'INCOME', 'CREDIT', false, null),
    ('4200', 'Interest Income', 'INCOME', 'CREDIT', false, null),
    ('5000', 'Cost of Sales', 'EXPENSE', 'DEBIT', false, 'cost_of_sales'),
    ('5100', 'Salaries & Wages', 'EXPENSE', 'DEBIT', false, null),
    ('5200', 'Rent', 'EXPENSE', 'DEBIT', false, null),
    ('5210', 'Electricity & Water', 'EXPENSE', 'DEBIT', false, null),
    ('5220', 'Fuel & Transport', 'EXPENSE', 'DEBIT', false, null),
    ('5300', 'Repairs & Maintenance', 'EXPENSE', 'DEBIT', false, null),
    ('5400', 'Bank Charges', 'EXPENSE', 'DEBIT', false, null),
    ('5500', 'Telephone & Internet', 'EXPENSE', 'DEBIT', false, null),
    ('5600', 'Office & Administrative', 'EXPENSE', 'DEBIT', false, null),
    ('5700', 'Depreciation Expense', 'EXPENSE', 'DEBIT', false, null),
    ('5800', 'Professional Fees', 'EXPENSE', 'DEBIT', false, null)
) as c(code, name, type, normal_balance, is_bank, system_key)
on conflict (org_id, code) do nothing;

create or replace function public.seed_chart_of_accounts()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  org uuid := public.current_org_id();
  before_count int;
  after_count int;
begin
  if public.current_app_user_id() is null or org is null then
    raise exception 'User not logged in';
  end if;
  if public.current_app_role() <> 'admin' then
    raise exception 'Only admins can set up the chart of accounts';
  end if;

  select count(*) into before_count
    from public.chart_account
   where org_id = org;

  insert into public.chart_account (
    org_id, code, name, type, normal_balance, is_bank, is_system, description
  )
  select
    org,
    c.code,
    c.name,
    c.type,
    c.normal_balance,
    c.is_bank,
    c.system_key is not null,
    case when c.system_key is null then null else 'key:' || c.system_key end
  from (
    values
      ('1000', 'Cash on Hand', 'ASSET', 'DEBIT', false, 'cash_on_hand'),
      ('1010', 'Petty Cash', 'ASSET', 'DEBIT', false, null),
      ('1100', 'Bank - Current Account', 'ASSET', 'DEBIT', true, null),
      ('1110', 'M-Pesa Paybill / Till', 'ASSET', 'DEBIT', true, null),
      ('1200', 'Accounts Receivable (Debtors)', 'ASSET', 'DEBIT', false, 'accounts_receivable'),
      ('1300', 'Inventory - Finished Goods', 'ASSET', 'DEBIT', false, 'inventory'),
      ('1310', 'Inventory - Raw Materials', 'ASSET', 'DEBIT', false, 'raw_materials_inventory'),
      ('1400', 'VAT Input (Receivable)', 'ASSET', 'DEBIT', false, 'vat_input'),
      ('1500', 'Property, Plant & Equipment', 'ASSET', 'DEBIT', false, null),
      ('1510', 'Accumulated Depreciation', 'ASSET', 'CREDIT', false, null),
      ('2000', 'Accounts Payable (Creditors)', 'LIABILITY', 'CREDIT', false, 'accounts_payable'),
      ('2100', 'VAT Output (Payable)', 'LIABILITY', 'CREDIT', false, 'vat_output'),
      ('2110', 'PAYE Payable', 'LIABILITY', 'CREDIT', false, null),
      ('2120', 'NHIF Payable', 'LIABILITY', 'CREDIT', false, null),
      ('2130', 'NSSF Payable', 'LIABILITY', 'CREDIT', false, null),
      ('2200', 'Accrued Expenses', 'LIABILITY', 'CREDIT', false, null),
      ('2300', 'Loans Payable', 'LIABILITY', 'CREDIT', false, null),
      ('3000', 'Owner''s Capital', 'EQUITY', 'CREDIT', false, null),
      ('3100', 'Drawings', 'EQUITY', 'DEBIT', false, null),
      ('3200', 'Retained Earnings', 'EQUITY', 'CREDIT', false, 'retained_earnings'),
      ('4000', 'Sales Revenue', 'INCOME', 'CREDIT', false, 'sales_revenue'),
      ('4100', 'Other Income', 'INCOME', 'CREDIT', false, null),
      ('4200', 'Interest Income', 'INCOME', 'CREDIT', false, null),
      ('5000', 'Cost of Sales', 'EXPENSE', 'DEBIT', false, 'cost_of_sales'),
      ('5100', 'Salaries & Wages', 'EXPENSE', 'DEBIT', false, null),
      ('5200', 'Rent', 'EXPENSE', 'DEBIT', false, null),
      ('5210', 'Electricity & Water', 'EXPENSE', 'DEBIT', false, null),
      ('5220', 'Fuel & Transport', 'EXPENSE', 'DEBIT', false, null),
      ('5300', 'Repairs & Maintenance', 'EXPENSE', 'DEBIT', false, null),
      ('5400', 'Bank Charges', 'EXPENSE', 'DEBIT', false, null),
      ('5500', 'Telephone & Internet', 'EXPENSE', 'DEBIT', false, null),
      ('5600', 'Office & Administrative', 'EXPENSE', 'DEBIT', false, null),
      ('5700', 'Depreciation Expense', 'EXPENSE', 'DEBIT', false, null),
      ('5800', 'Professional Fees', 'EXPENSE', 'DEBIT', false, null)
  ) as c(code, name, type, normal_balance, is_bank, system_key)
  on conflict (org_id, code) do nothing;

  select count(*) into after_count
    from public.chart_account
   where org_id = org;

  return jsonb_build_object(
    'success', true,
    'created', after_count - before_count,
    'total', after_count
  );
end $$;

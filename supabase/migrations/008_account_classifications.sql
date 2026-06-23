-- =============================================================================
-- WORKFLOWIQ | 08_account_classifications.sql
-- Statement-grouped chart of accounts with classified account creation.
-- =============================================================================

alter table public.chart_account add column if not exists classification text;
alter table public.chart_account add column if not exists statement_group text;
alter table public.chart_account add column if not exists currency text;
alter table public.chart_account add column if not exists parent_id uuid;
alter table public.chart_account add column if not exists note text;
alter table public.chart_account add column if not exists vat_applicable boolean;

update public.chart_account
   set currency = coalesce(nullif(btrim(currency), ''), 'KES'),
       vat_applicable = coalesce(vat_applicable, false);

alter table public.chart_account alter column currency set default 'KES';
alter table public.chart_account alter column currency set not null;
alter table public.chart_account alter column vat_applicable set default false;
alter table public.chart_account alter column vat_applicable set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'chart_account_classification_check'
       and conrelid = 'public.chart_account'::regclass
  ) then
    alter table public.chart_account
      add constraint chart_account_classification_check
      check (
        classification is null or classification in (
          'INCOME',
          'EXPENSE',
          'FIXED_ASSETS',
          'BANK',
          'LOAN',
          'EQUITY',
          'ACCOUNTS_RECEIVABLE',
          'OTHER_CURRENT_ASSETS',
          'OTHER_ASSETS',
          'ACCOUNTS_PAYABLE',
          'OTHER_CURRENT_LIABILITY',
          'LONG_TERM_LIABILITY',
          'COST_OF_GOODS_SOLD',
          'OTHER_INCOME',
          'OTHER_EXPENSE'
        )
      );
  end if;

  if not exists (
    select 1 from pg_constraint
     where conname = 'chart_account_statement_group_check'
       and conrelid = 'public.chart_account'::regclass
  ) then
    alter table public.chart_account
      add constraint chart_account_statement_group_check
      check (
        statement_group is null or statement_group in (
          'NON_CURRENT_ASSETS',
          'CURRENT_ASSETS',
          'NON_CURRENT_LIABILITIES',
          'CURRENT_LIABILITIES',
          'EQUITY',
          'REVENUE',
          'OTHER_INCOME',
          'COST_OF_GOODS_SOLD',
          'ADMINISTRATIVE_EXPENSES',
          'OTHER_OPERATING_EXPENSES',
          'FINANCE_CHARGES'
        )
      );
  end if;

  if not exists (
    select 1 from pg_constraint
     where conname = 'chart_account_currency_not_blank'
       and conrelid = 'public.chart_account'::regclass
  ) then
    alter table public.chart_account
      add constraint chart_account_currency_not_blank
      check (char_length(btrim(currency)) > 0);
  end if;

  if not exists (
    select 1 from pg_constraint
     where conname = 'chart_account_parent_id_fkey'
       and conrelid = 'public.chart_account'::regclass
  ) then
    alter table public.chart_account
      add constraint chart_account_parent_id_fkey
      foreign key (parent_id) references public.chart_account(id) on delete set null;
  end if;
end $$;

create index if not exists chart_account_org_statement_group_idx
  on public.chart_account (org_id, statement_group)
  where is_active = true;

create index if not exists chart_account_org_parent_idx
  on public.chart_account (org_id, parent_id)
  where parent_id is not null;

update public.chart_account
   set classification = coalesce(
         classification,
         case
           when description = 'key:cash_on_hand' then 'BANK'
           when description = 'key:accounts_receivable' then 'ACCOUNTS_RECEIVABLE'
           when description in ('key:inventory', 'key:raw_materials_inventory', 'key:vat_input') then 'OTHER_CURRENT_ASSETS'
           when description = 'key:accounts_payable' then 'ACCOUNTS_PAYABLE'
           when description = 'key:vat_output' then 'OTHER_CURRENT_LIABILITY'
           when description = 'key:retained_earnings' then 'EQUITY'
           when description = 'key:sales_revenue' then 'INCOME'
           when description = 'key:cost_of_sales' then 'COST_OF_GOODS_SOLD'
           when type = 'ASSET' and code in ('1100', '1110') then 'BANK'
           when type = 'ASSET' and code = '1200' then 'ACCOUNTS_RECEIVABLE'
           when type = 'ASSET' and code like '15%' then 'FIXED_ASSETS'
           when type = 'ASSET' then 'OTHER_CURRENT_ASSETS'
           when type = 'LIABILITY' and code = '2000' then 'ACCOUNTS_PAYABLE'
           when type = 'LIABILITY' and code like '23%' then 'LOAN'
           when type = 'LIABILITY' then 'OTHER_CURRENT_LIABILITY'
           when type = 'EQUITY' then 'EQUITY'
           when type = 'INCOME' and code = '4000' then 'INCOME'
           when type = 'INCOME' then 'OTHER_INCOME'
           when type = 'EXPENSE' and code = '5000' then 'COST_OF_GOODS_SOLD'
           when type = 'EXPENSE' and code = '5400' then 'OTHER_EXPENSE'
           when type = 'EXPENSE' then 'EXPENSE'
           else null
         end
       ),
       statement_group = coalesce(
         statement_group,
         case
           when type = 'ASSET' and code like '15%' then 'NON_CURRENT_ASSETS'
           when type = 'ASSET' then 'CURRENT_ASSETS'
           when type = 'LIABILITY' and code like '23%' then 'NON_CURRENT_LIABILITIES'
           when type = 'LIABILITY' then 'CURRENT_LIABILITIES'
           when type = 'EQUITY' then 'EQUITY'
           when type = 'INCOME' and code = '4000' then 'REVENUE'
           when type = 'INCOME' then 'OTHER_INCOME'
           when type = 'EXPENSE' and code = '5000' then 'COST_OF_GOODS_SOLD'
           when type = 'EXPENSE' and code = '5400' then 'FINANCE_CHARGES'
           when type = 'EXPENSE' then 'ADMINISTRATIVE_EXPENSES'
           else null
         end
       );

create or replace function public.create_classified_account(
  p_name text,
  p_currency text default 'KES',
  p_classification text default null,
  p_statement_group text default null,
  p_parent_id uuid default null,
  p_description text default null,
  p_note text default null,
  p_vat_applicable boolean default false
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me uuid := public.current_app_user_id();
  org uuid := public.current_org_id();
  clean_name text := btrim(coalesce(p_name, ''));
  clean_currency text := upper(btrim(coalesce(nullif(p_currency, ''), 'KES')));
  class text := upper(btrim(coalesce(p_classification, '')));
  target_group text := nullif(upper(btrim(coalesce(p_statement_group, ''))), '');
  base_type text;
  normal text;
  default_group text;
  base int;
  max_n int;
  candidate text;
  account_id uuid;
  attempts int := 0;
begin
  if me is null or org is null then
    raise exception 'User not logged in';
  end if;

  if public.current_app_role() not in ('admin', 'manager') then
    raise exception 'Permission denied';
  end if;

  if clean_name = '' then
    raise exception 'Account name is required';
  end if;

  case class
    when 'FIXED_ASSETS' then
      base_type := 'ASSET'; normal := 'DEBIT'; default_group := 'NON_CURRENT_ASSETS';
    when 'OTHER_ASSETS' then
      base_type := 'ASSET'; normal := 'DEBIT'; default_group := 'NON_CURRENT_ASSETS';
    when 'BANK' then
      base_type := 'ASSET'; normal := 'DEBIT'; default_group := 'CURRENT_ASSETS';
    when 'ACCOUNTS_RECEIVABLE' then
      base_type := 'ASSET'; normal := 'DEBIT'; default_group := 'CURRENT_ASSETS';
    when 'OTHER_CURRENT_ASSETS' then
      base_type := 'ASSET'; normal := 'DEBIT'; default_group := 'CURRENT_ASSETS';
    when 'LONG_TERM_LIABILITY' then
      base_type := 'LIABILITY'; normal := 'CREDIT'; default_group := 'NON_CURRENT_LIABILITIES';
    when 'LOAN' then
      base_type := 'LIABILITY'; normal := 'CREDIT'; default_group := 'NON_CURRENT_LIABILITIES';
    when 'ACCOUNTS_PAYABLE' then
      base_type := 'LIABILITY'; normal := 'CREDIT'; default_group := 'CURRENT_LIABILITIES';
    when 'OTHER_CURRENT_LIABILITY' then
      base_type := 'LIABILITY'; normal := 'CREDIT'; default_group := 'CURRENT_LIABILITIES';
    when 'EQUITY' then
      base_type := 'EQUITY'; normal := 'CREDIT'; default_group := 'EQUITY';
    when 'INCOME' then
      base_type := 'INCOME'; normal := 'CREDIT'; default_group := 'REVENUE';
    when 'OTHER_INCOME' then
      base_type := 'INCOME'; normal := 'CREDIT'; default_group := 'OTHER_INCOME';
    when 'COST_OF_GOODS_SOLD' then
      base_type := 'EXPENSE'; normal := 'DEBIT'; default_group := 'COST_OF_GOODS_SOLD';
    when 'EXPENSE' then
      base_type := 'EXPENSE'; normal := 'DEBIT'; default_group := 'ADMINISTRATIVE_EXPENSES';
    when 'OTHER_EXPENSE' then
      base_type := 'EXPENSE'; normal := 'DEBIT'; default_group := 'OTHER_OPERATING_EXPENSES';
    else
      raise exception 'Pick a valid classification';
  end case;

  target_group := coalesce(target_group, default_group);
  if target_group not in (
    'NON_CURRENT_ASSETS',
    'CURRENT_ASSETS',
    'NON_CURRENT_LIABILITIES',
    'CURRENT_LIABILITIES',
    'EQUITY',
    'REVENUE',
    'OTHER_INCOME',
    'COST_OF_GOODS_SOLD',
    'ADMINISTRATIVE_EXPENSES',
    'OTHER_OPERATING_EXPENSES',
    'FINANCE_CHARGES'
  ) then
    raise exception 'Pick a valid statement group';
  end if;

  if p_parent_id is not null and not exists (
    select 1
      from public.chart_account
     where id = p_parent_id
       and org_id = org
       and is_active = true
  ) then
    raise exception 'Selected parent account not found';
  end if;

  base := case base_type
    when 'ASSET' then 1000
    when 'LIABILITY' then 2000
    when 'EQUITY' then 3000
    when 'INCOME' then 4000
    when 'EXPENSE' then 5000
    else 9000
  end;

  select coalesce(max(numbered.code_num), base)
    into max_n
    from (
      select code::int as code_num
        from public.chart_account
       where org_id = org
         and type = base_type
         and code ~ '^[0-9]+$'
    ) numbered
   where numbered.code_num >= base
     and numbered.code_num < base + 1000;

  candidate := (max_n + 10)::text;
  while exists (
    select 1
      from public.chart_account
     where org_id = org
       and code = candidate
  ) loop
    attempts := attempts + 1;
    if attempts > 200 then
      raise exception 'Could not allocate an account code';
    end if;
    candidate := (candidate::int + 1)::text;
  end loop;

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
    description,
    note,
    vat_applicable,
    is_bank,
    is_system,
    is_active,
    created_by
  )
  values (
    org,
    candidate,
    clean_name,
    base_type,
    normal,
    class,
    target_group,
    clean_currency,
    p_parent_id,
    nullif(btrim(coalesce(p_description, '')), ''),
    nullif(btrim(coalesce(p_note, '')), ''),
    coalesce(p_vat_applicable, false),
    class = 'BANK',
    false,
    true,
    me
  )
  returning id into account_id;

  return jsonb_build_object(
    'success', true,
    'account_id', account_id,
    'accountId', account_id,
    'code', candidate
  );
end $$;

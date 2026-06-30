---
name: workflowiq-supabase-accounting
description: WorkflowIQ Supabase accounting and chart-of-accounts implementation guidance. Use when working on Supabase migrations or RPCs for chart_account, accounting_tax_code, journal_entry, ledger_line, invoices, bills, expenses, payments, loan repayments, reports, or COA seeding, especially when preserving multi-org RLS, double-entry invariants, VAT handling, and non-postable header accounts.
---

# WorkflowIQ Supabase Accounting

## Core Rules

- Treat this repo as a Vite/React + Supabase app, not Django. The COA seeder is implemented as SQL migrations and the `seed_chart_of_accounts()` RPC.
- Read relevant migrations in `supabase/migrations` before changing accounting behavior. Later migrations supersede earlier definitions.
- Keep every accounting row organization-scoped with `org_id = public.current_org_id()` defaults and RLS policies.
- For `security definer` RPCs, enforce auth, role, org membership, and account ownership inside the function. RLS is not enough inside definer functions.
- Post all financial activity through `post_journal_entry(...)` unless adding a lower-level ledger primitive. Preserve the balanced-entry checks.

## Chart Of Accounts

- Preserve the 106-account transport COA template in `010_transport_coa_seed.sql`.
- Keep these system-account descriptions stable because posting RPCs depend on them:
  - `key:cash_on_hand`
  - `key:accounts_receivable`
  - `key:vat_input`
  - `key:inventory`
  - `key:accounts_payable`
  - `key:vat_output`
  - `key:retained_earnings`
  - `key:sales_revenue`
  - `key:cost_of_sales`
- Header accounts must use `is_postable = false`; never allow ledger lines to post to them.
- Do not hardcode real bank accounts or loan facilities in the seed data. Real org-specific accounts belong under headers such as `1020`, `1040`, and `2500`.
- Maintain idempotency with `on conflict (org_id, code) do nothing` or equivalent behavior. A re-run should add only missing accounts.
- Link VAT-tagged template rows to `accounting_tax_code`; do not rely only on a boolean when the tax code matters.

## Client Contract

- Update `src/lib/supabase.ts` whenever migration-visible columns become part of the client shape.
- Keep `src/lib/api.ts` as the data access boundary. Page components should use hooks exported from this file rather than calling `supabase` directly.
- Exclude `is_postable = false` accounts from posting forms, cash/bank summaries, debtors, creditors, and loan balance buckets.
- Use `statement_group` for report grouping, especially cost of sales. Do not special-case only account `5000`.

## Validation

- Run `pnpm run build` after TypeScript or client contract changes.
- If SQL is changed but no Supabase database is available locally, state that SQL execution was not verified.
- Before finishing accounting work, check that invoice, bill, expense, payment, manual journal, trial balance, profit and loss, and balance sheet paths still have the system accounts they require.

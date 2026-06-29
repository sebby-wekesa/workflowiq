# Five-Page Accounting Dashboard — Pages 1 & 3

The two pages that read straight off the ledger (no posting, no TJ detail needed):

- **Page 1 — Home:** live cash & bank, debtors, creditors & accruals, outstanding
  loans, and upcoming loan repayments to prepare for.
- **Page 3 — Chart of Accounts & Ledgers:** every account with its T-account ledger,
  each printable monthly/yearly for filing.

**26 tests pass** (the ledger core + petty cash + dashboard + these pages).

## Files

```
accounting/
  views_five_page.py     home, chart_and_ledgers, account_ledger views
  summaries.py           live roll-ups (cash/bank split, debtors, creditors, loans)
  loans.py               LoanRepayment model + upcoming_repayments() helper
  tests_five_page.py     3 tests (summaries split, debtors, repayment window)
  urls.py                routes for the whole accounting section
  templates/accounting/five/
    home.html            Page 1
    chart_ledgers.html   Page 3 chart
    account_ledger.html  Page 3 T-account ledger (printable)
```

## What's already correct (no change needed)

- Everything reads **live** from posted journal lines — no stored figures.
- The **loan repayment schedule** (`loans.py`) is the one genuine model addition the
  spec needed ("upcoming repayments to prepare for"); it's built and tested.
- The **bank vs cash-in-hand split** on the Home page uses a name heuristic
  (accounts under "Cash & Cash Equivalents" whose name contains "cash"/"petty" →
  cash-in-hand, else bank). Works with existing data; see to-do #4 to make it exact.

## Wiring to-dos (do these in your repo)

1. **`get_active_organization()`** — in `views_petty_cash.py`, replace the placeholder
   with your real org resolution. All accounting views use it.

2. **Left-nav links** — add the five-page nav. URL names are:
   - `accounting:home` — Page 1
   - `accounting:chart_ledgers` — Page 3
   - `accounting:dashboard` — chart-of-accounts setup tool (the heading-based screen,
     now at `/accounting/setup/`)
   - `accounting:petty_cash_tab` — clerk petty cash tab
   - (Pages 2, 4, 5 routes get added when those are built.)

3. **Migration** — `loans.py` adds `LoanRepayment`. Make sure it's imported in
   `models.py` (the line `from .loans import LoanRepayment` is already there) and run
   `python manage.py makemigrations accounting && migrate` in your repo.

4. **(Optional) Exact bank/cash flag** — if the name heuristic isn't precise enough,
   add a boolean to `Account`:
   ```python
   is_cash_in_hand = models.BooleanField(default=False)
   ```
   then in `summaries.cash_and_bank()` use `a.is_cash_in_hand` instead of the name check.
   Minor; the heuristic is fine to start.

5. **Base template** — the `five/*.html` templates `{% extends "base.html" %}`. Point
   at your base and ensure it has `{% block content %}` and loads `humanize`.

## Routing note

`urls.py` reorganises the accounting section so the **Home page is the default**
`/accounting/`, the **heading-based dashboard becomes the setup tool** at
`/accounting/setup/` (per your decision to keep it as the chart-of-accounts editor),
and the petty cash tab stays at `/accounting/petty-cash/`. Adjust paths to taste.

## Still to build (waiting on TJ's detail)

- **Page 2 — Accountant posting** (Cash Book Bank/Cash, Revenue, COGS, Expenditure
  forms) — needs the invoice form headings + posting form layouts.
- **Page 4 — Financial Reports** (Income Statement, Balance Sheet, Cash Flow, Statement
  of Changes in Equity) — needs TJ's statement framework/format.
- **Page 5 — Tax Computation** — income tax on running profit.

All three will post/derive through the existing ledger; no model changes expected
beyond what's here.

# Financial Reports — the FleetIQ-style analysis layer

This adds the reporting/analysis layer on top of the accounting module — turning
your double-entry ledger into real financial statements and insight, the same
way FleetIQ turned a raw GL into a P&L and profitability view.

## What's new

Three pages, all computed live from your posted ledger (no new data, no migration):

| Page | Path | What it shows |
|---|---|---|
| **Financial Insights** | `/accounting/insights` | Headline revenue / gross profit / net profit + margins, and **customer concentration risk** — the signature FleetIQ insight (e.g. "your largest customer is 62% of revenue — HIGH risk"). |
| **Profit & Loss** | `/accounting/profit-loss` | Full income statement for any date range: income, cost of sales, gross profit, expenses, net profit, with gross & net margins. |
| **Balance Sheet** | `/accounting/balance-sheet` | Assets vs Liabilities + Equity as at any date, including current-year earnings, with a balanced check. |

All three are linked from the Accounting dashboard.

## How they work

Everything is derived from the `LedgerLine` rows of posted journal entries — the
same double-entry data behind your trial balance. Because it's all from one
balanced ledger:

- **P&L** sums income accounts (credit − debit) and expense accounts (debit −
  credit) over the period; gross profit = revenue − cost of sales (account 5000);
  net profit = revenue − all expenses.
- **Balance Sheet** sums assets (debit − credit) and liabilities/equity
  (credit − debit) as at the date, and folds the current period's net income
  into equity as "Current Year Earnings" so Assets = Liabilities + Equity.
- **Insights** reuses the P&L for headline numbers, then computes each customer's
  share of revenue from confirmed sales and flags concentration risk
  (HIGH ≥ 50%, MEDIUM ≥ 30%, LOW otherwise).

## Files

| File | Purpose |
|---|---|
| `actions/accounting-reports.ts` | **New.** `getProfitAndLoss`, `getBalanceSheet`, `getFinancialInsights`. |
| `app/(dashboard)/accounting/profit-loss/page.tsx` | P&L statement. |
| `app/(dashboard)/accounting/balance-sheet/page.tsx` | Balance sheet. |
| `app/(dashboard)/accounting/insights/page.tsx` | Insights + concentration. |
| `app/(dashboard)/accounting/page.tsx` | Dashboard updated with the three new cards. |

## Deploy

Purely additive and read-only — no schema or migration changes. Just rebuild:

```bash
cd stockflow
pnpm run build
```

(Assumes the accounting module from the previous step is already in place. These
reports read its ledger.)

## Notes

- Numbers are only as complete as what's posted to the ledger. After seeding the
  chart of accounts and running **"Bring in existing sales"** on the Trial
  Balance page, the P&L will show revenue and receivables. Cost of Sales / expense
  figures appear as you post purchases, payments, and manual journals.
- The concentration analysis reads confirmed sales directly (not the ledger), so
  it's meaningful even before you've posted everything.
- I couldn't run `pnpm build` here (no node_modules in the upload, sandbox can't
  fetch Prisma's engine), so I verified every query field and relation against
  your actual schema. Send any build error and I'll fix it.
```

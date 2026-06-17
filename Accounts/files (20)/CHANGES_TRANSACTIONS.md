# Transactions — posting financial data via double-entry

This adds the **functionality** to enter everyday financial activity. Each form
is a friendly front-end that posts a correct, balanced double-entry journal
behind the scenes — users never have to think in debits and credits.

## Where it lives

A single **Record Transactions** hub at `/accounting/transactions` (also the
first card on the Accounting dashboard), with one tab per transaction type.

## The transaction types and what each posts

| Type | When you use it | Journal posted |
|---|---|---|
| **Expense** | Money paid out now (fuel, rent…) | Dr Expense (net) [+ Dr VAT Input] / Cr Bank or Cash (gross) |
| **Income** | Money received now (not a customer sale) | Dr Bank/Cash (gross) / Cr Income (net) [+ Cr VAT Output] |
| **Sales Invoice** | Customer owes you (on credit) | Dr Accounts Receivable (gross) / Cr Sales (net) [+ Cr VAT Output] |
| **Bill / Purchase** | You owe a supplier (on credit) | Dr Expense or Asset (net) [+ Dr VAT Input] / Cr Accounts Payable (gross) |
| **Bank Transfer** | Move money between your own accounts | Dr destination / Cr source |
| **Capital / Drawings** | Owner puts money in or takes it out | Capital: Dr Bank / Cr Owner's Capital · Drawings: Dr Drawings / Cr Bank |

Every entry flows through the same `postJournalEntry` engine, which **refuses
anything that doesn't balance** — so the ledger, trial balance, P&L and balance
sheet stay correct by construction.

## VAT (16%)

Each form has an “Includes 16% VAT” tick box. When on, the entered amount is
treated as VAT-inclusive (how Kenyan invoices are quoted) and auto-split:

- the net goes to the expense/income/sales account,
- the 16% goes to **VAT Input** (purchases) or **VAT Output** (sales),
- the gross hits cash/bank or debtors/creditors.

A live preview shows net / VAT / gross before posting. Invoices and bills
default VAT on; expenses and income default off — all overridable.

Verified: every journal balances exactly, with and without VAT, including the
rounding case (1,160 → net 1,000 + VAT 160).

## Account selection

Per your choice, the user picks the expense/income/asset/equity account from the
chart each time (full picker), while the system accounts (Receivable, Payable,
VAT, Cash/Bank) are resolved automatically.

## Files

| File | Purpose |
|---|---|
| `actions/accounting-transactions.ts` | **New.** `postExpense`, `postIncome`, `postBill`, `postInvoice`, `postTransfer`, `postEquityMovement`, plus `getTransactionFormData`. |
| `components/accounting/TransactionsHub.tsx` | **New.** Tabbed hub with a form per type, VAT toggle + live preview. |
| `app/(dashboard)/accounting/transactions/page.tsx` | **New.** The hub page. |
| `app/(dashboard)/accounting/page.tsx` | Dashboard updated with the “Record Transactions” card. |

## Deploy

Purely additive — no schema or migration changes (it writes through the existing
journal/ledger tables). Just rebuild:

```bash
cd stockflow
pnpm run build
```

## Notes

- Sales invoices and bills posted here create AR/AP entries, so they flow
  straight into Debtors / Creditors and the financial reports.
- I couldn't run `pnpm build` here (no node_modules in the upload, sandbox can't
  fetch Prisma's engine), so I verified every system-account key, the balance of
  each journal (with a simulation), and the imports/roles against your actual
  schema. Send any build error and I'll fix it.
```

# Accounting Module — double-entry bookkeeping

A full accounting subsystem: chart of accounts, journals, general ledger, trial
balance, banking, debtors and creditors — with sales auto-posting to the ledger.

## What it gives you

- **Chart of Accounts** — standard Kenyan SME accounts (1xxx assets, 2xxx
  liabilities, 3xxx equity, 4xxx income, 5xxx expenses), seeded and editable.
- **General Ledger** — every transaction, account by account, with a running
  balance and date filtering.
- **Trial Balance** — debits vs credits across all accounts, as at any date,
  with a balanced/out-of-balance check.
- **Banking** — bank, cash and M-Pesa account balances, computed live from the
  ledger; record money in/out.
- **Debtors** — what each customer owes (sales billed − payments received).
- **Creditors** — what you owe each supplier (purchases − payments made).
- **Manual journals** — post any balanced entry by hand, with a live
  debit=credit check.

It's true **double-entry**: every transaction is a balanced journal entry, and
the trial balance and ledger are computed entirely from those entries — so the
books always reconcile by construction.

## How auto-posting works

- **A sale** posts: Dr Accounts Receivable / Cr Sales Revenue.
- **A customer payment** posts: Dr Bank/Cash / Cr Accounts Receivable.
- **A supplier payment** posts: Dr Accounts Payable / Cr Bank/Cash.

Each auto-posted entry records its source document, so the same sale or payment
can never be posted twice.

## Pages (under `/accounting`)

| Page | Path |
|---|---|
| Dashboard (KPIs + links) | `/accounting` |
| Trial Balance | `/accounting/trial-balance` |
| General Ledger | `/accounting/ledger` |
| Debtors | `/accounting/debtors` |
| Creditors | `/accounting/creditors` |
| Banking + record payment | `/accounting/banking` |
| Chart of Accounts | `/accounting/chart` |
| Manual Journal Entry | `/accounting/journal` |

## Files

| File | Purpose |
|---|---|
| `prisma/schema.prisma` | New models: `ChartAccount`, `JournalEntry`, `LedgerLine`, `BankAccount`, `Payment` + 6 enums. |
| `prisma/migrations/20260609000000_accounting_module/` | The migration. |
| `lib/accounting/chart-of-accounts.ts` | The standard Kenyan SME chart + system-account keys. |
| `lib/accounting/posting.ts` | The double-entry engine (`postJournalEntry` enforces debits=credits). |
| `actions/accounting.ts` | Seed, chart CRUD, manual journal, trial balance, general ledger. |
| `actions/accounting-ar-ap.ts` | Debtors, creditors, banking, `recordPayment` (auto-posts). |
| `actions/accounting-posting.ts` | Sale→ledger posting + `backfillSalesPostings`. |
| `components/accounting/PaymentForm.tsx` | Record-payment form. |
| `components/accounting/JournalForm.tsx` | Manual journal form with live balance check. |
| `app/(dashboard)/accounting/**` | The seven pages above. |

## Deploy & first-run

```bash
cd stockflow
pnpm prisma migrate deploy   # applies 20260609000000_accounting_module
pnpm prisma generate
pnpm run build
```

Then, in the app:

1. Open **/accounting** → click **Set up chart of accounts** (seeds the standard accounts).
2. Open **Trial Balance** → click **Bring in existing sales** (posts your sales history to the ledger).
3. Record payments from **Banking** as customers pay and as you pay suppliers.

After step 1, the standard “Bank — Current Account” and “M-Pesa” accounts exist;
turn them into usable bank accounts from the Banking page (or add your own).

## Add "Accounting" to the sidebar

Add a nav link to `/accounting` (ADMIN/MANAGER) wherever your sidebar items are defined.

## Notes & next steps

- **Auto-posting on new sales is opt-in for now.** I added a reusable
  `postSaleToLedger` helper and a one-click **backfill** rather than editing your
  three sale-creation paths directly (safer). When you're ready, we can call
  `postSaleToLedger` inside the sale-confirmation transaction so new sales post
  instantly with no backfill needed — tell me which sale path is the live one.
- **Cost of Sales / inventory postings** aren't auto-posted yet (sales post
  revenue + receivable only). Adding COGS at the point of sale is a natural next
  step once you confirm how you value inventory (you have FIFO-ish receipts).
- **VAT** accounts exist in the chart but aren't split out automatically yet — if
  your invoices are VAT-inclusive we can add the output-VAT split to sale posting.
- I couldn't run `pnpm build` here (no node_modules in the upload and the sandbox
  can't fetch Prisma's engine), so I verified every query's relation names and
  the auth/role API against your actual schema. If the build flags anything, send
  it and I'll fix immediately.
```

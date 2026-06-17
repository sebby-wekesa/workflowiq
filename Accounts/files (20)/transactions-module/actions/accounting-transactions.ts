"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { getTenantPrisma } from "@/lib/tenant-prisma";
import { postJournalEntry, getSystemAccounts, SYSTEM_ACCOUNT_KEYS } from "@/lib/accounting/posting";

const K = SYSTEM_ACCOUNT_KEYS;
const VAT_RATE = 0.16;
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

// Given a gross amount and whether VAT applies, split into net + VAT.
// We treat the entered amount as VAT-INCLUSIVE (gross), which is how Kenyan
// receipts/invoices are usually quoted.
function splitVat(amount: number, vat: boolean) {
  if (!vat) return { net: r2(amount), vat: 0, gross: r2(amount) };
  const net = r2(amount / (1 + VAT_RATE));
  const vatAmt = r2(amount - net);
  return { net, vat: vatAmt, gross: r2(amount) };
}

function revalidateAccounting() {
  for (const p of [
    "/accounting", "/accounting/transactions", "/accounting/ledger",
    "/accounting/trial-balance", "/accounting/profit-loss",
    "/accounting/balance-sheet", "/accounting/banking",
    "/accounting/debtors", "/accounting/creditors",
  ]) revalidatePath(p);
}

// Resolve the cash/bank GL account from a chosen bank account id (or fall to Cash).
async function resolveBankGl(db: any, sys: Record<string, string>, bankAccountId?: string | null) {
  if (bankAccountId) {
    const b = await db.bankAccount.findFirst({ where: { id: bankAccountId }, select: { accountId: true } });
    if (b?.accountId) return b.accountId;
  }
  return sys[K.CASH];
}

// ── EXPENSE (money out now) ───────────────────────────────────────────────────
// Dr Expense account (net) [+ Dr VAT Input] / Cr Bank or Cash (gross)
export async function postExpense(input: {
  date: string;
  amount: number;            // gross (VAT-inclusive if hasVat)
  expenseAccountId: string;  // which expense account from the chart
  bankAccountId?: string | null;
  hasVat?: boolean;
  memo?: string;
  reference?: string;
}) {
  const user = await requireRole("ADMIN", "MANAGER");
  const db = getTenantPrisma(user.organizationId);

  const amount = Number(input.amount);
  if (!(amount > 0)) return { success: false, error: "Amount must be positive" };
  if (!input.expenseAccountId) return { success: false, error: "Pick an expense account" };

  const sys = await getSystemAccounts(db, user.organizationId);
  const bankGl = await resolveBankGl(db, sys, input.bankAccountId);
  if (!bankGl) return { success: false, error: "No cash/bank account. Seed the chart of accounts." };

  const { net, vat, gross } = splitVat(amount, Boolean(input.hasVat));
  const lines: any[] = [{ accountId: input.expenseAccountId, debit: net, description: input.memo }];
  if (vat > 0) {
    if (!sys[K.VAT_INPUT]) return { success: false, error: "VAT Input account missing. Seed the chart." };
    lines.push({ accountId: sys[K.VAT_INPUT], debit: vat, description: "VAT input" });
  }
  lines.push({ accountId: bankGl, credit: gross, description: "Paid" });

  try {
    const e = await postJournalEntry(db, user.organizationId, {
      date: new Date(input.date),
      memo: input.memo || `Expense ${input.reference ?? ""}`.trim(),
      source: "MANUAL",
      lines,
    }, user.id);
    revalidateAccounting();
    return { success: true, entryNumber: e.entryNumber };
  } catch (err: any) {
    return { success: false, error: err?.message ?? "Could not post expense" };
  }
}

// ── INCOME / OTHER RECEIPT (money in now, not a customer sale) ────────────────
// Dr Bank or Cash (gross) / Cr Income (net) [+ Cr VAT Output]
export async function postIncome(input: {
  date: string;
  amount: number;
  incomeAccountId: string;
  bankAccountId?: string | null;
  hasVat?: boolean;
  memo?: string;
  reference?: string;
}) {
  const user = await requireRole("ADMIN", "MANAGER");
  const db = getTenantPrisma(user.organizationId);

  const amount = Number(input.amount);
  if (!(amount > 0)) return { success: false, error: "Amount must be positive" };
  if (!input.incomeAccountId) return { success: false, error: "Pick an income account" };

  const sys = await getSystemAccounts(db, user.organizationId);
  const bankGl = await resolveBankGl(db, sys, input.bankAccountId);
  if (!bankGl) return { success: false, error: "No cash/bank account. Seed the chart of accounts." };

  const { net, vat, gross } = splitVat(amount, Boolean(input.hasVat));
  const lines: any[] = [{ accountId: bankGl, debit: gross, description: "Received" }];
  if (vat > 0) {
    if (!sys[K.VAT_OUTPUT]) return { success: false, error: "VAT Output account missing. Seed the chart." };
    lines.push({ accountId: sys[K.VAT_OUTPUT], credit: vat, description: "VAT output" });
  }
  lines.push({ accountId: input.incomeAccountId, credit: net, description: input.memo });

  try {
    const e = await postJournalEntry(db, user.organizationId, {
      date: new Date(input.date), memo: input.memo || "Other income",
      source: "MANUAL", lines,
    }, user.id);
    revalidateAccounting();
    return { success: true, entryNumber: e.entryNumber };
  } catch (err: any) {
    return { success: false, error: err?.message ?? "Could not post income" };
  }
}

// ── BILL / PURCHASE ON CREDIT (you owe a supplier) ───────────────────────────
// Dr Expense or asset (net) [+ Dr VAT Input] / Cr Accounts Payable (gross)
export async function postBill(input: {
  date: string;
  amount: number;
  expenseAccountId: string;  // expense or asset account being purchased
  supplierName?: string;
  hasVat?: boolean;
  memo?: string;
  reference?: string;
}) {
  const user = await requireRole("ADMIN", "MANAGER");
  const db = getTenantPrisma(user.organizationId);

  const amount = Number(input.amount);
  if (!(amount > 0)) return { success: false, error: "Amount must be positive" };
  if (!input.expenseAccountId) return { success: false, error: "Pick the account this bill is for" };

  const sys = await getSystemAccounts(db, user.organizationId);
  if (!sys[K.ACCOUNTS_PAYABLE]) return { success: false, error: "Accounts Payable missing. Seed the chart." };

  const { net, vat, gross } = splitVat(amount, Boolean(input.hasVat));
  const lines: any[] = [{ accountId: input.expenseAccountId, debit: net, description: input.memo }];
  if (vat > 0) {
    if (!sys[K.VAT_INPUT]) return { success: false, error: "VAT Input account missing. Seed the chart." };
    lines.push({ accountId: sys[K.VAT_INPUT], debit: vat, description: "VAT input" });
  }
  lines.push({ accountId: sys[K.ACCOUNTS_PAYABLE], credit: gross, description: input.supplierName ? `Owed to ${input.supplierName}` : "Creditor" });

  try {
    const e = await postJournalEntry(db, user.organizationId, {
      date: new Date(input.date),
      memo: input.memo || `Bill ${input.supplierName ?? ""}`.trim(),
      source: "PURCHASE", sourceType: "Bill", sourceId: input.reference || undefined,
      lines,
    }, user.id);
    revalidateAccounting();
    return { success: true, entryNumber: e.entryNumber };
  } catch (err: any) {
    return { success: false, error: err?.message ?? "Could not post bill" };
  }
}

// ── SALES INVOICE ON CREDIT (a customer owes you) ────────────────────────────
// Dr Accounts Receivable (gross) / Cr Sales (net) [+ Cr VAT Output]
export async function postInvoice(input: {
  date: string;
  amount: number;
  customerName?: string;
  hasVat?: boolean;
  memo?: string;
  reference?: string;
}) {
  const user = await requireRole("ADMIN", "MANAGER", "SALES");
  const db = getTenantPrisma(user.organizationId);

  const amount = Number(input.amount);
  if (!(amount > 0)) return { success: false, error: "Amount must be positive" };

  const sys = await getSystemAccounts(db, user.organizationId);
  if (!sys[K.ACCOUNTS_RECEIVABLE] || !sys[K.SALES_REVENUE])
    return { success: false, error: "Receivable/Sales accounts missing. Seed the chart." };

  const { net, vat, gross } = splitVat(amount, Boolean(input.hasVat));
  const lines: any[] = [{ accountId: sys[K.ACCOUNTS_RECEIVABLE], debit: gross, description: input.customerName ? `Due from ${input.customerName}` : "Debtor" }];
  if (vat > 0) {
    if (!sys[K.VAT_OUTPUT]) return { success: false, error: "VAT Output account missing. Seed the chart." };
    lines.push({ accountId: sys[K.VAT_OUTPUT], credit: vat, description: "VAT output" });
  }
  lines.push({ accountId: sys[K.SALES_REVENUE], credit: net, description: input.memo });

  try {
    const e = await postJournalEntry(db, user.organizationId, {
      date: new Date(input.date),
      memo: input.memo || `Invoice ${input.customerName ?? ""}`.trim(),
      source: "SALE", sourceType: "Invoice", sourceId: input.reference || undefined,
      lines,
    }, user.id);
    revalidateAccounting();
    return { success: true, entryNumber: e.entryNumber };
  } catch (err: any) {
    return { success: false, error: err?.message ?? "Could not post invoice" };
  }
}

// ── BANK TRANSFER (between your own cash/bank accounts) ───────────────────────
// Dr destination / Cr source
export async function postTransfer(input: {
  date: string;
  amount: number;
  fromAccountId: string; // GL account id (asset)
  toAccountId: string;   // GL account id (asset)
  memo?: string;
}) {
  const user = await requireRole("ADMIN", "MANAGER");
  const db = getTenantPrisma(user.organizationId);

  const amount = Number(input.amount);
  if (!(amount > 0)) return { success: false, error: "Amount must be positive" };
  if (!input.fromAccountId || !input.toAccountId) return { success: false, error: "Pick both accounts" };
  if (input.fromAccountId === input.toAccountId) return { success: false, error: "From and to must differ" };

  try {
    const e = await postJournalEntry(db, user.organizationId, {
      date: new Date(input.date),
      memo: input.memo || "Bank transfer",
      source: "MANUAL",
      lines: [
        { accountId: input.toAccountId, debit: amount, description: "Transfer in" },
        { accountId: input.fromAccountId, credit: amount, description: "Transfer out" },
      ],
    }, user.id);
    revalidateAccounting();
    return { success: true, entryNumber: e.entryNumber };
  } catch (err: any) {
    return { success: false, error: err?.message ?? "Could not post transfer" };
  }
}

// ── CAPITAL CONTRIBUTION / DRAWINGS (owner equity movements) ──────────────────
// Capital in:  Dr Bank/Cash / Cr Owner's Capital
// Drawings:    Dr Drawings  / Cr Bank/Cash
export async function postEquityMovement(input: {
  kind: "CAPITAL" | "DRAWINGS";
  date: string;
  amount: number;
  equityAccountId: string; // Owner's Capital (3000) or Drawings (3100)
  bankAccountId?: string | null;
  memo?: string;
}) {
  const user = await requireRole("ADMIN", "MANAGER");
  const db = getTenantPrisma(user.organizationId);

  const amount = Number(input.amount);
  if (!(amount > 0)) return { success: false, error: "Amount must be positive" };
  if (!input.equityAccountId) return { success: false, error: "Pick the equity account" };

  const sys = await getSystemAccounts(db, user.organizationId);
  const bankGl = await resolveBankGl(db, sys, input.bankAccountId);
  if (!bankGl) return { success: false, error: "No cash/bank account. Seed the chart." };

  const lines =
    input.kind === "CAPITAL"
      ? [
          { accountId: bankGl, debit: amount, description: "Capital introduced" },
          { accountId: input.equityAccountId, credit: amount, description: input.memo },
        ]
      : [
          { accountId: input.equityAccountId, debit: amount, description: input.memo }, // Drawings (debit-normal)
          { accountId: bankGl, credit: amount, description: "Withdrawn" },
        ];

  try {
    const e = await postJournalEntry(db, user.organizationId, {
      date: new Date(input.date),
      memo: input.memo || (input.kind === "CAPITAL" ? "Capital contribution" : "Owner drawings"),
      source: "MANUAL", lines,
    }, user.id);
    revalidateAccounting();
    return { success: true, entryNumber: e.entryNumber };
  } catch (err: any) {
    return { success: false, error: err?.message ?? "Could not post entry" };
  }
}

// ── Account lists for the transaction forms ───────────────────────────────────
export async function getTransactionFormData() {
  const user = await requireRole("ADMIN", "MANAGER", "SALES");
  const db = getTenantPrisma(user.organizationId);

  const accounts = await db.chartAccount.findMany({
    where: { isActive: true },
    orderBy: { code: "asc" },
    select: { id: true, code: true, name: true, type: true },
  });
  const banks = await db.bankAccount.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
  });

  const a = accounts as any[];
  return {
    all: a.map((x) => ({ id: x.id, code: x.code, name: x.name, type: x.type })),
    expense: a.filter((x) => x.type === "EXPENSE").map((x) => ({ id: x.id, code: x.code, name: x.name })),
    income: a.filter((x) => x.type === "INCOME").map((x) => ({ id: x.id, code: x.code, name: x.name })),
    asset: a.filter((x) => x.type === "ASSET").map((x) => ({ id: x.id, code: x.code, name: x.name })),
    equity: a.filter((x) => x.type === "EQUITY").map((x) => ({ id: x.id, code: x.code, name: x.name })),
    banks: (banks as any[]).map((b) => ({ id: b.id, name: b.name })),
  };
}

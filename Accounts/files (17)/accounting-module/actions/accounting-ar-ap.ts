"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { getTenantPrisma } from "@/lib/tenant-prisma";
import { postJournalEntry, getSystemAccounts, SYSTEM_ACCOUNT_KEYS } from "@/lib/accounting/posting";

const K = SYSTEM_ACCOUNT_KEYS;

// ── Debtors (Accounts Receivable) ─────────────────────────────────────────────
// Outstanding = total confirmed sales to the customer − payments received.

export async function getDebtors() {
  const user = await requireRole("ADMIN", "MANAGER", "SALES");
  const db = getTenantPrisma(user.organizationId);

  const customers = await db.customer.findMany({
    orderBy: { name: "asc" },
    include: {
      SaleOrder: { select: { totalAmount: true, status: true } },
    },
  });

  const payments = await db.payment.findMany({
    where: { direction: "RECEIVED" },
    select: { customerId: true, amount: true },
  });
  const paidByCustomer = new Map<string, number>();
  for (const p of payments as any[]) {
    if (!p.customerId) continue;
    paidByCustomer.set(p.customerId, (paidByCustomer.get(p.customerId) ?? 0) + Number(p.amount));
  }

  const rows = (customers as any[]).map((c) => {
    const billed = c.SaleOrder
      .filter((s: any) => s.status !== "CANCELLED")
      .reduce((sum: number, s: any) => sum + Number(s.totalAmount), 0);
    const paid = paidByCustomer.get(c.id) ?? 0;
    return {
      id: c.id,
      name: c.name,
      code: c.code,
      phone: c.phone,
      billed: Math.round(billed * 100) / 100,
      paid: Math.round(paid * 100) / 100,
      outstanding: Math.round((billed - paid) * 100) / 100,
    };
  });

  const totalOutstanding = rows.reduce((s, r) => s + r.outstanding, 0);
  return { rows: rows.filter((r) => r.billed !== 0 || r.paid !== 0), totalOutstanding: Math.round(totalOutstanding * 100) / 100 };
}

// ── Creditors (Accounts Payable) ──────────────────────────────────────────────

export async function getCreditors() {
  const user = await requireRole("ADMIN", "MANAGER");
  const db = getTenantPrisma(user.organizationId);

  const suppliers = await db.supplier.findMany({
    orderBy: { name: "asc" },
    include: { PurchaseOrder: { select: { totalAmount: true, status: true } } },
  });

  const payments = await db.payment.findMany({
    where: { direction: "PAID" },
    select: { supplierId: true, amount: true },
  });
  const paidBySupplier = new Map<string, number>();
  for (const p of payments as any[]) {
    if (!p.supplierId) continue;
    paidBySupplier.set(p.supplierId, (paidBySupplier.get(p.supplierId) ?? 0) + Number(p.amount));
  }

  const rows = (suppliers as any[]).map((s) => {
    const billed = s.PurchaseOrder
      .filter((p: any) => p.status !== "CANCELLED" && p.status !== "DRAFT")
      .reduce((sum: number, p: any) => sum + Number(p.totalAmount), 0);
    const paid = paidBySupplier.get(s.id) ?? 0;
    return {
      id: s.id,
      name: s.name,
      code: s.code,
      phone: s.phone,
      billed: Math.round(billed * 100) / 100,
      paid: Math.round(paid * 100) / 100,
      outstanding: Math.round((billed - paid) * 100) / 100,
    };
  });

  const totalOutstanding = rows.reduce((s, r) => s + r.outstanding, 0);
  return { rows: rows.filter((r) => r.billed !== 0 || r.paid !== 0), totalOutstanding: Math.round(totalOutstanding * 100) / 100 };
}

// ── Banking ───────────────────────────────────────────────────────────────────

export async function listBankAccounts() {
  const user = await requireRole("ADMIN", "MANAGER");
  const db = getTenantPrisma(user.organizationId);

  const banks = await db.bankAccount.findMany({
    orderBy: { name: "asc" },
    include: { account: { select: { id: true, code: true, name: true } } },
  });

  // Current balance = opening balance + net movement on the linked GL account.
  const result = [];
  for (const b of banks as any[]) {
    const lines = await db.ledgerLine.findMany({
      where: { accountId: b.accountId, journalEntry: { status: "POSTED" } },
      select: { debit: true, credit: true },
    });
    const net = (lines as any[]).reduce((s, l) => s + Number(l.debit) - Number(l.credit), 0);
    result.push({
      id: b.id,
      name: b.name,
      bankName: b.bankName,
      accountNumber: b.accountNumber,
      currency: b.currency,
      glCode: b.account.code,
      balance: Math.round((Number(b.openingBalance) + net) * 100) / 100,
    });
  }
  return result;
}

export async function createBankAccount(input: {
  name: string;
  bankName?: string;
  accountNumber?: string;
  glAccountId: string; // an existing ASSET ChartAccount
  openingBalance?: number;
}) {
  const user = await requireRole("ADMIN", "MANAGER");
  const db = getTenantPrisma(user.organizationId);

  const gl = await db.chartAccount.findFirst({ where: { id: input.glAccountId } });
  if (!gl) return { success: false, error: "Pick a valid GL account" };
  if (gl.type !== "ASSET") return { success: false, error: "Bank accounts must map to an ASSET account" };

  const exists = await db.bankAccount.findFirst({ where: { accountId: input.glAccountId } });
  if (exists) return { success: false, error: "That GL account is already a bank account" };

  const bank = await db.bankAccount.create({
    data: {
      organizationId: user.organizationId,
      accountId: input.glAccountId,
      name: input.name.trim(),
      bankName: input.bankName?.trim() || null,
      accountNumber: input.accountNumber?.trim() || null,
      openingBalance: input.openingBalance ?? 0,
    },
  });
  await db.chartAccount.update({ where: { id: input.glAccountId }, data: { isBank: true } });

  revalidatePath("/accounting/banking");
  return { success: true, bankAccountId: bank.id };
}

// ── Payments (with auto-posting) ──────────────────────────────────────────────

async function nextPaymentNumber(db: any, direction: "RECEIVED" | "PAID"): Promise<string> {
  const prefix = direction === "RECEIVED" ? "RCT" : "PMT";
  const year = new Date().getFullYear();
  const last = await db.payment.findFirst({
    where: { direction },
    orderBy: { createdAt: "desc" },
    select: { paymentNumber: true },
  });
  let n = 1;
  if (last?.paymentNumber) {
    const m = last.paymentNumber.match(new RegExp(`${prefix}-\\d{4}-(\\d+)`));
    if (m) n = parseInt(m[1]) + 1;
  }
  return `${prefix}-${year}-${n.toString().padStart(6, "0")}`;
}

// Record a customer payment (money in) or supplier payment (money out), and
// auto-post the matching journal entry.
//   RECEIVED:  Dr Bank/Cash   Cr Accounts Receivable
//   PAID:      Dr Accounts Payable   Cr Bank/Cash
export async function recordPayment(input: {
  direction: "RECEIVED" | "PAID";
  amount: number;
  date: string;
  method?: "CASH" | "BANK_TRANSFER" | "MPESA" | "CHEQUE" | "CARD" | "OTHER";
  customerId?: string | null;
  supplierId?: string | null;
  bankAccountId?: string | null; // which bank/cash account the money moved through
  reference?: string;
  notes?: string;
}) {
  const user = await requireRole("ADMIN", "MANAGER");
  const db = getTenantPrisma(user.organizationId);

  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { success: false, error: "Amount must be positive" };
  }
  if (input.direction === "RECEIVED" && !input.customerId) {
    return { success: false, error: "Select the customer who paid" };
  }
  if (input.direction === "PAID" && !input.supplierId) {
    return { success: false, error: "Select the supplier being paid" };
  }

  const sys = await getSystemAccounts(db, user.organizationId);
  const arId = sys[K.ACCOUNTS_RECEIVABLE];
  const apId = sys[K.ACCOUNTS_PAYABLE];
  const cashId = sys[K.CASH];

  // Determine the cash/bank GL account.
  let bankGlId: string | undefined;
  let bankAccountId: string | null = input.bankAccountId ?? null;
  if (bankAccountId) {
    const bank = await db.bankAccount.findFirst({ where: { id: bankAccountId }, select: { accountId: true } });
    bankGlId = bank?.accountId;
  }
  if (!bankGlId) bankGlId = cashId; // fall back to Cash on Hand

  if (!bankGlId) return { success: false, error: "No cash/bank account found. Seed the chart of accounts first." };
  if (input.direction === "RECEIVED" && !arId)
    return { success: false, error: "Accounts Receivable account missing. Seed the chart of accounts." };
  if (input.direction === "PAID" && !apId)
    return { success: false, error: "Accounts Payable account missing. Seed the chart of accounts." };

  try {
    const result = await db.$transaction(async (tx: any) => {
      const paymentNumber = await nextPaymentNumber(tx, input.direction);

      const lines =
        input.direction === "RECEIVED"
          ? [
              { accountId: bankGlId!, debit: amount, description: "Payment received" },
              { accountId: arId!, credit: amount, description: "Settle debtor" },
            ]
          : [
              { accountId: apId!, debit: amount, description: "Settle creditor" },
              { accountId: bankGlId!, credit: amount, description: "Payment made" },
            ];

      const entry = await postJournalEntry(
        tx,
        user.organizationId,
        {
          date: new Date(input.date),
          memo: `${input.direction === "RECEIVED" ? "Receipt" : "Payment"} ${paymentNumber}`,
          source: input.direction === "RECEIVED" ? "PAYMENT_RECEIVED" : "PAYMENT_MADE",
          sourceType: "Payment",
          sourceId: paymentNumber,
          lines,
        },
        user.id
      );

      const payment = await tx.payment.create({
        data: {
          organizationId: user.organizationId,
          paymentNumber,
          direction: input.direction,
          method: input.method ?? "BANK_TRANSFER",
          date: new Date(input.date),
          amount,
          reference: input.reference ?? null,
          notes: input.notes ?? null,
          customerId: input.customerId ?? null,
          supplierId: input.supplierId ?? null,
          bankAccountId,
          journalEntryId: entry.id,
          createdBy: user.id,
        },
      });

      return { paymentNumber: payment.paymentNumber, entryNumber: entry.entryNumber };
    });

    revalidatePath("/accounting/debtors");
    revalidatePath("/accounting/creditors");
    revalidatePath("/accounting/banking");
    revalidatePath("/accounting/ledger");
    return { success: true, ...result };
  } catch (e: any) {
    return { success: false, error: e?.message ?? "Could not record payment" };
  }
}

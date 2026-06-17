"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { getTenantPrisma } from "@/lib/tenant-prisma";
import { KENYA_SME_CHART } from "@/lib/accounting/chart-of-accounts";
import { postJournalEntry } from "@/lib/accounting/posting";

// ── Setup ───────────────────────────────────────────────────────────────────

// Seed the standard Kenyan SME chart of accounts. Idempotent: existing accounts
// (matched by code) are left alone; only missing ones are created.
export async function seedChartOfAccounts() {
  const user = await requireRole("ADMIN", "MANAGER");
  const db = getTenantPrisma(user.organizationId);

  const existing = await db.chartAccount.findMany({ select: { code: true } });
  const haveCodes = new Set((existing as any[]).map((a) => a.code));

  let created = 0;
  for (const acc of KENYA_SME_CHART) {
    if (haveCodes.has(acc.code)) continue;
    await db.chartAccount.create({
      data: {
        organizationId: user.organizationId,
        code: acc.code,
        name: acc.name,
        type: acc.type,
        normalBalance: acc.normalBalance,
        isBank: acc.isBank ?? false,
        isSystem: Boolean(acc.key),
        // Store the stable system key in description so the posting engine can
        // find the account even after the user renames it.
        description: acc.key ? `key:${acc.key}` : null,
      },
    });
    created++;
  }

  revalidatePath("/accounting");
  revalidatePath("/accounting/chart");
  return { success: true, created, total: KENYA_SME_CHART.length };
}

// ── Chart of accounts CRUD ───────────────────────────────────────────────────

export async function listAccounts() {
  const user = await requireRole("ADMIN", "MANAGER", "SALES");
  const db = getTenantPrisma(user.organizationId);
  const accounts = await db.chartAccount.findMany({
    orderBy: { code: "asc" },
  });
  return accounts.map((a: any) => ({
    id: a.id,
    code: a.code,
    name: a.name,
    type: a.type,
    normalBalance: a.normalBalance,
    isBank: a.isBank,
    isSystem: a.isSystem,
    isActive: a.isActive,
  }));
}

export async function createAccount(input: {
  code: string;
  name: string;
  type: "ASSET" | "LIABILITY" | "EQUITY" | "INCOME" | "EXPENSE";
  normalBalance?: "DEBIT" | "CREDIT";
}) {
  const user = await requireRole("ADMIN", "MANAGER");
  const db = getTenantPrisma(user.organizationId);

  const code = input.code.trim();
  const name = input.name.trim();
  if (!code || !name) return { success: false, error: "Code and name are required" };

  const clash = await db.chartAccount.findFirst({ where: { code } });
  if (clash) return { success: false, error: `Account code ${code} already exists` };

  // Default normal balance by type if not specified.
  const normalBalance =
    input.normalBalance ??
    (input.type === "ASSET" || input.type === "EXPENSE" ? "DEBIT" : "CREDIT");

  const account = await db.chartAccount.create({
    data: {
      organizationId: user.organizationId,
      code,
      name,
      type: input.type,
      normalBalance,
    },
  });
  revalidatePath("/accounting/chart");
  return { success: true, accountId: account.id };
}

export async function updateAccount(
  id: string,
  input: { name?: string; isActive?: boolean }
) {
  const user = await requireRole("ADMIN", "MANAGER");
  const db = getTenantPrisma(user.organizationId);
  const data: any = {};
  if (input.name != null) data.name = input.name.trim();
  if (input.isActive != null) data.isActive = input.isActive;
  await db.chartAccount.update({ where: { id }, data });
  revalidatePath("/accounting/chart");
  return { success: true };
}

// ── Manual journal entry ──────────────────────────────────────────────────────

export async function createManualJournal(input: {
  date: string;
  memo?: string;
  lines: { accountId: string; debit?: number; credit?: number; description?: string }[];
}) {
  const user = await requireRole("ADMIN", "MANAGER");
  const db = getTenantPrisma(user.organizationId);

  try {
    const entry = await postJournalEntry(
      db,
      user.organizationId,
      {
        date: new Date(input.date),
        memo: input.memo,
        source: "MANUAL",
        lines: input.lines,
      },
      user.id
    );
    revalidatePath("/accounting/journal");
    revalidatePath("/accounting/ledger");
    return { success: true, entryNumber: entry.entryNumber };
  } catch (e: any) {
    return { success: false, error: e?.message ?? "Could not post entry" };
  }
}

// ── Reports: Trial Balance ────────────────────────────────────────────────────

// Sum debits and credits per account up to (and including) `asOf`, then present
// each account's net on its normal side. Totals must balance.
export async function getTrialBalance(asOf?: string) {
  const user = await requireRole("ADMIN", "MANAGER", "SALES");
  const db = getTenantPrisma(user.organizationId);

  const dateFilter = asOf ? { lte: new Date(asOf) } : undefined;

  const accounts = await db.chartAccount.findMany({
    where: { isActive: true },
    orderBy: { code: "asc" },
  });

  // Aggregate ledger lines per account via the posted journal entries.
  const lines = await db.ledgerLine.findMany({
    where: {
      journalEntry: dateFilter
        ? { date: dateFilter, status: "POSTED" }
        : { status: "POSTED" },
    },
    select: { accountId: true, debit: true, credit: true },
  });

  const agg = new Map<string, { debit: number; credit: number }>();
  for (const l of lines as any[]) {
    const cur = agg.get(l.accountId) ?? { debit: 0, credit: 0 };
    cur.debit += Number(l.debit);
    cur.credit += Number(l.credit);
    agg.set(l.accountId, cur);
  }

  const rows: any[] = [];
  let totalDebit = 0;
  let totalCredit = 0;

  for (const a of accounts as any[]) {
    const sums = agg.get(a.id) ?? { debit: 0, credit: 0 };
    const net = sums.debit - sums.credit; // positive = net debit
    if (Math.abs(net) < 0.005 && sums.debit === 0 && sums.credit === 0) continue; // skip untouched accounts

    // Present the balance on the side that matches its sign.
    const debitBal = net > 0 ? net : 0;
    const creditBal = net < 0 ? -net : 0;
    totalDebit += debitBal;
    totalCredit += creditBal;

    rows.push({
      code: a.code,
      name: a.name,
      type: a.type,
      debit: Math.round(debitBal * 100) / 100,
      credit: Math.round(creditBal * 100) / 100,
    });
  }

  return {
    asOf: asOf ?? new Date().toISOString().slice(0, 10),
    rows,
    totalDebit: Math.round(totalDebit * 100) / 100,
    totalCredit: Math.round(totalCredit * 100) / 100,
    balanced: Math.abs(totalDebit - totalCredit) < 0.01,
  };
}

// ── Reports: General Ledger (one account, running balance) ────────────────────

export async function getGeneralLedger(input: {
  accountId?: string;
  from?: string;
  to?: string;
}) {
  const user = await requireRole("ADMIN", "MANAGER", "SALES");
  const db = getTenantPrisma(user.organizationId);

  const accounts = await db.chartAccount.findMany({
    orderBy: { code: "asc" },
    select: { id: true, code: true, name: true, type: true, normalBalance: true },
  });

  if (!input.accountId) {
    return { accounts, accountId: null, lines: [], openingBalance: 0, account: null };
  }

  const account = (accounts as any[]).find((a) => a.id === input.accountId) ?? null;
  if (!account) return { accounts, accountId: input.accountId, lines: [], openingBalance: 0, account: null };

  const from = input.from ? new Date(input.from) : null;
  const to = input.to ? new Date(input.to) : null;

  // Opening balance = net of all posted lines strictly before `from`.
  let openingBalance = 0;
  if (from) {
    const prior = await db.ledgerLine.findMany({
      where: {
        accountId: input.accountId,
        journalEntry: { status: "POSTED", date: { lt: from } },
      },
      select: { debit: true, credit: true },
    });
    const debit = (prior as any[]).reduce((s, l) => s + Number(l.debit), 0);
    const credit = (prior as any[]).reduce((s, l) => s + Number(l.credit), 0);
    openingBalance =
      account.normalBalance === "DEBIT" ? debit - credit : credit - debit;
  }

  const dateWhere: any = { status: "POSTED" };
  if (from || to) {
    dateWhere.date = {};
    if (from) dateWhere.date.gte = from;
    if (to) dateWhere.date.lte = to;
  }

  const ledgerLines = await db.ledgerLine.findMany({
    where: { accountId: input.accountId, journalEntry: dateWhere },
    include: { journalEntry: { select: { entryNumber: true, date: true, memo: true, source: true } } },
    orderBy: [{ journalEntry: { date: "asc" } }, { createdAt: "asc" }],
  });

  let running = openingBalance;
  const lines = (ledgerLines as any[]).map((l) => {
    const debit = Number(l.debit);
    const credit = Number(l.credit);
    running += account.normalBalance === "DEBIT" ? debit - credit : credit - debit;
    return {
      date: l.journalEntry.date,
      entryNumber: l.journalEntry.entryNumber,
      memo: l.description ?? l.journalEntry.memo,
      source: l.journalEntry.source,
      debit,
      credit,
      balance: Math.round(running * 100) / 100,
    };
  });

  return {
    accounts,
    accountId: input.accountId,
    account,
    openingBalance: Math.round(openingBalance * 100) / 100,
    lines,
  };
}

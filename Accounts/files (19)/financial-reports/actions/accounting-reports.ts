"use server";

import { requireRole } from "@/lib/auth";
import { getTenantPrisma } from "@/lib/tenant-prisma";

// Shared helper: net ledger movement per account over an optional date window.
// Returns Map<accountId, { debit, credit }>.
async function ledgerSums(db: any, where: any) {
  const lines = await db.ledgerLine.findMany({
    where: { journalEntry: { status: "POSTED", ...where } },
    select: { accountId: true, debit: true, credit: true },
  });
  const agg = new Map<string, { debit: number; credit: number }>();
  for (const l of lines as any[]) {
    const cur = agg.get(l.accountId) ?? { debit: 0, credit: 0 };
    cur.debit += Number(l.debit);
    cur.credit += Number(l.credit);
    agg.set(l.accountId, cur);
  }
  return agg;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

// ── PROFIT & LOSS (Income Statement) ─────────────────────────────────────────
// Income accounts are credit-normal (credit − debit = income).
// Expense accounts are debit-normal (debit − credit = expense).
export async function getProfitAndLoss(input?: { from?: string; to?: string }) {
  const user = await requireRole("ADMIN", "MANAGER", "SALES");
  const db = getTenantPrisma(user.organizationId);

  const dateWhere: any = {};
  if (input?.from || input?.to) {
    dateWhere.date = {};
    if (input.from) dateWhere.date.gte = new Date(input.from);
    if (input.to) dateWhere.date.lte = new Date(input.to);
  }

  const accounts = await db.chartAccount.findMany({
    where: { type: { in: ["INCOME", "EXPENSE"] } },
    orderBy: { code: "asc" },
  });
  const sums = await ledgerSums(db, dateWhere);

  const income: any[] = [];
  const expenses: any[] = [];
  let totalIncome = 0;
  let totalExpense = 0;
  let costOfSales = 0;

  for (const a of accounts as any[]) {
    const s = sums.get(a.id) ?? { debit: 0, credit: 0 };
    if (a.type === "INCOME") {
      const amt = s.credit - s.debit;
      if (amt !== 0) {
        income.push({ code: a.code, name: a.name, amount: r2(amt) });
        totalIncome += amt;
      }
    } else {
      const amt = s.debit - s.credit;
      if (amt !== 0) {
        expenses.push({ code: a.code, name: a.name, amount: r2(amt) });
        totalExpense += amt;
        if (a.code === "5000") costOfSales += amt; // Cost of Sales
      }
    }
  }

  const grossProfit = totalIncome - costOfSales;
  const netProfit = totalIncome - totalExpense;

  return {
    from: input?.from ?? null,
    to: input?.to ?? new Date().toISOString().slice(0, 10),
    income,
    expenses,
    totalIncome: r2(totalIncome),
    costOfSales: r2(costOfSales),
    grossProfit: r2(grossProfit),
    totalExpense: r2(totalExpense),
    netProfit: r2(netProfit),
    grossMargin: totalIncome ? r2((grossProfit / totalIncome) * 100) : 0,
    netMargin: totalIncome ? r2((netProfit / totalIncome) * 100) : 0,
  };
}

// ── BALANCE SHEET ────────────────────────────────────────────────────────────
// Assets (debit-normal), Liabilities & Equity (credit-normal), as at a date.
// Retained earnings for the current period = net income, which we fold into
// equity so the sheet balances.
export async function getBalanceSheet(input?: { asOf?: string }) {
  const user = await requireRole("ADMIN", "MANAGER", "SALES");
  const db = getTenantPrisma(user.organizationId);

  const asOf = input?.asOf ? new Date(input.asOf) : new Date();
  const dateWhere = { date: { lte: asOf } };

  const accounts = await db.chartAccount.findMany({ orderBy: { code: "asc" } });
  const sums = await ledgerSums(db, dateWhere);

  const assets: any[] = [];
  const liabilities: any[] = [];
  const equity: any[] = [];
  let totalAssets = 0;
  let totalLiabilities = 0;
  let totalEquity = 0;
  let periodIncome = 0;
  let periodExpense = 0;

  for (const a of accounts as any[]) {
    const s = sums.get(a.id) ?? { debit: 0, credit: 0 };
    if (a.type === "ASSET") {
      const amt = s.debit - s.credit;
      if (amt !== 0) { assets.push({ code: a.code, name: a.name, amount: r2(amt) }); totalAssets += amt; }
    } else if (a.type === "LIABILITY") {
      const amt = s.credit - s.debit;
      if (amt !== 0) { liabilities.push({ code: a.code, name: a.name, amount: r2(amt) }); totalLiabilities += amt; }
    } else if (a.type === "EQUITY") {
      const amt = s.credit - s.debit;
      if (amt !== 0) { equity.push({ code: a.code, name: a.name, amount: r2(amt) }); totalEquity += amt; }
    } else if (a.type === "INCOME") {
      periodIncome += s.credit - s.debit;
    } else if (a.type === "EXPENSE") {
      periodExpense += s.debit - s.credit;
    }
  }

  // Current-year earnings (not yet closed to retained earnings) shown in equity.
  const currentEarnings = periodIncome - periodExpense;
  if (currentEarnings !== 0) {
    equity.push({ code: "—", name: "Current Year Earnings", amount: r2(currentEarnings) });
    totalEquity += currentEarnings;
  }

  const totalLiabAndEquity = totalLiabilities + totalEquity;

  return {
    asOf: asOf.toISOString().slice(0, 10),
    assets,
    liabilities,
    equity,
    totalAssets: r2(totalAssets),
    totalLiabilities: r2(totalLiabilities),
    totalEquity: r2(totalEquity),
    totalLiabAndEquity: r2(totalLiabAndEquity),
    balanced: Math.abs(totalAssets - totalLiabAndEquity) < 0.01,
  };
}

// ── FINANCIAL INSIGHTS (the FleetIQ-style "ground truth" view) ───────────────
// Headline numbers + customer concentration risk + receivables aging signal.
export async function getFinancialInsights(input?: { from?: string; to?: string }) {
  const user = await requireRole("ADMIN", "MANAGER");
  const db = getTenantPrisma(user.organizationId);

  const pl = await getProfitAndLoss(input);

  // Customer concentration: share of revenue by customer (signature FleetIQ insight).
  const sales = await db.saleOrder.findMany({
    where: { status: { not: "CANCELLED" } },
    select: { customerName: true, totalAmount: true },
  });
  const byCustomer = new Map<string, number>();
  let totalSales = 0;
  for (const s of sales as any[]) {
    const amt = Number(s.totalAmount);
    const name = s.customerName || "—";
    byCustomer.set(name, (byCustomer.get(name) ?? 0) + amt);
    totalSales += amt;
  }
  const concentration = [...byCustomer.entries()]
    .map(([name, amount]) => ({
      name,
      amount: r2(amount),
      share: totalSales ? r2((amount / totalSales) * 100) : 0,
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10);

  const topShare = concentration[0]?.share ?? 0;
  const concentrationRisk =
    topShare >= 50 ? "HIGH" : topShare >= 30 ? "MEDIUM" : "LOW";

  return {
    pl,
    totalSales: r2(totalSales),
    concentration,
    topCustomer: concentration[0] ?? null,
    concentrationRisk,
    customerCount: byCustomer.size,
  };
}

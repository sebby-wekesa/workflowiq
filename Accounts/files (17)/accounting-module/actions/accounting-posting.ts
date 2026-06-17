"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { getTenantPrisma } from "@/lib/tenant-prisma";
import {
  postJournalEntry,
  getSystemAccounts,
  alreadyPosted,
  SYSTEM_ACCOUNT_KEYS,
} from "@/lib/accounting/posting";

const K = SYSTEM_ACCOUNT_KEYS;

// Post a single sale to the ledger: Dr Accounts Receivable / Cr Sales Revenue.
// Safe to call repeatedly — skips if already posted. `db` may be a tx.
export async function postSaleToLedger(
  db: any,
  organizationId: string,
  sale: { id: string; totalAmount: number; date: Date; orderNumber?: string },
  userId?: string
): Promise<{ posted: boolean; reason?: string }> {
  if (await alreadyPosted(db, organizationId, "SALE", "SaleOrder", sale.id)) {
    return { posted: false, reason: "already posted" };
  }
  const sys = await getSystemAccounts(db, organizationId);
  const arId = sys[K.ACCOUNTS_RECEIVABLE];
  const salesId = sys[K.SALES_REVENUE];
  if (!arId || !salesId) return { posted: false, reason: "system accounts missing" };

  const amount = Number(sale.totalAmount);
  if (!(amount > 0)) return { posted: false, reason: "zero amount" };

  await postJournalEntry(
    db,
    organizationId,
    {
      date: sale.date,
      memo: `Sale ${sale.orderNumber ?? sale.id}`,
      source: "SALE",
      sourceType: "SaleOrder",
      sourceId: sale.id,
      lines: [
        { accountId: arId, debit: amount, description: "Debtor" },
        { accountId: salesId, credit: amount, description: "Sales revenue" },
      ],
    },
    userId
  );
  return { posted: true };
}

// Backfill: post journals for every non-cancelled sale that isn't yet on the
// ledger. Run once after seeding the chart of accounts to bring history in.
export async function backfillSalesPostings() {
  const user = await requireRole("ADMIN", "MANAGER");
  const db = getTenantPrisma(user.organizationId);

  const sales = await db.saleOrder.findMany({
    where: { status: { not: "CANCELLED" } },
    select: { id: true, totalAmount: true, createdAt: true },
  });

  let posted = 0;
  let skipped = 0;
  for (const s of sales as any[]) {
    const res = await postSaleToLedger(
      db,
      user.organizationId,
      { id: s.id, totalAmount: Number(s.totalAmount), date: s.createdAt },
      user.id
    );
    if (res.posted) posted++;
    else skipped++;
  }

  revalidatePath("/accounting/ledger");
  revalidatePath("/accounting/trial-balance");
  return { success: true, posted, skipped, total: sales.length };
}

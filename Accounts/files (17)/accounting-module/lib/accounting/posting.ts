// Core double-entry posting engine. Every accounting transaction goes through
// postJournalEntry, which enforces that debits == credits before writing.

import { SYSTEM_ACCOUNT_KEYS } from "./chart-of-accounts";

export type PostingLine = {
  accountId: string;
  debit?: number;
  credit?: number;
  description?: string;
};

export type PostJournalInput = {
  date: Date;
  memo?: string;
  source?: "MANUAL" | "SALE" | "PURCHASE" | "PAYMENT_RECEIVED" | "PAYMENT_MADE" | "OPENING_BALANCE";
  sourceType?: string | null;
  sourceId?: string | null;
  lines: PostingLine[];
};

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

// Generate the next journal entry number for the org, e.g. "JE-2026-000123".
export async function nextJournalNumber(db: any): Promise<string> {
  const year = new Date().getFullYear();
  const last = await db.journalEntry.findFirst({
    orderBy: { createdAt: "desc" },
    select: { entryNumber: true },
  });
  let n = 1;
  if (last?.entryNumber) {
    const m = last.entryNumber.match(/JE-\d{4}-(\d+)/);
    if (m) n = parseInt(m[1]) + 1;
  }
  return `JE-${year}-${n.toString().padStart(6, "0")}`;
}

// Validate + post a balanced journal entry. `db` is a tenant client or tx.
// Throws if the entry is unbalanced or empty. Returns the created entry id.
export async function postJournalEntry(
  db: any,
  organizationId: string,
  input: PostJournalInput,
  userId?: string
): Promise<{ id: string; entryNumber: string }> {
  const lines = (input.lines || []).filter(
    (l) => (l.debit ?? 0) !== 0 || (l.credit ?? 0) !== 0
  );
  if (lines.length < 2) {
    throw new Error("A journal entry needs at least two lines");
  }

  // No line may have both a debit and a credit.
  for (const l of lines) {
    if ((l.debit ?? 0) > 0 && (l.credit ?? 0) > 0) {
      throw new Error("A line cannot have both a debit and a credit");
    }
    if ((l.debit ?? 0) < 0 || (l.credit ?? 0) < 0) {
      throw new Error("Debit and credit amounts must be positive");
    }
  }

  const totalDebit = round2(lines.reduce((s, l) => s + (l.debit ?? 0), 0));
  const totalCredit = round2(lines.reduce((s, l) => s + (l.credit ?? 0), 0));

  if (totalDebit !== totalCredit) {
    throw new Error(
      `Journal entry does not balance: debits ${totalDebit} ≠ credits ${totalCredit}`
    );
  }
  if (totalDebit === 0) {
    throw new Error("Journal entry total cannot be zero");
  }

  const entryNumber = await nextJournalNumber(db);

  const entry = await db.journalEntry.create({
    data: {
      organizationId,
      entryNumber,
      date: input.date,
      memo: input.memo ?? null,
      status: "POSTED",
      source: input.source ?? "MANUAL",
      sourceType: input.sourceType ?? null,
      sourceId: input.sourceId ?? null,
      postedAt: new Date(),
      postedBy: userId ?? null,
      createdBy: userId ?? null,
      lines: {
        create: lines.map((l) => ({
          organizationId,
          accountId: l.accountId,
          debit: round2(l.debit ?? 0),
          credit: round2(l.credit ?? 0),
          description: l.description ?? null,
        })),
      },
    },
    select: { id: true, entryNumber: true },
  });

  return entry;
}

// Look up the org's system accounts (AR, AP, sales, etc.) by their stable key,
// returning a map of key -> accountId. Used by the auto-posting helpers.
export async function getSystemAccounts(
  db: any,
  organizationId: string
): Promise<Record<string, string>> {
  const accounts = await db.chartAccount.findMany({
    where: { organizationId, isSystem: true },
    select: { id: true, code: true, name: true, description: true },
  });

  // System accounts store their key in `description` as "key:<key>" when seeded,
  // so we can map them even if the user renames the account.
  const map: Record<string, string> = {};
  for (const a of accounts as any[]) {
    const m = (a.description || "").match(/key:([a-z_]+)/);
    if (m) map[m[1]] = a.id;
  }
  return map;
}

// Check whether a source document has already been auto-posted (idempotency).
export async function alreadyPosted(
  db: any,
  organizationId: string,
  source: string,
  sourceType: string,
  sourceId: string
): Promise<boolean> {
  const existing = await db.journalEntry.findFirst({
    where: { organizationId, source, sourceType, sourceId, status: { not: "VOID" } },
    select: { id: true },
  });
  return Boolean(existing);
}

export { SYSTEM_ACCOUNT_KEYS };

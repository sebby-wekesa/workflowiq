import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { listAccounts } from "@/actions/accounting";
import { JournalForm } from "@/components/accounting/JournalForm";

export const dynamic = "force-dynamic";

export default async function JournalPage() {
  await requireRole("ADMIN", "MANAGER");
  const accounts = await listAccounts();

  return (
    <div className="dashboard-content">
      <div className="section-header">
        <div>
          <h1>Manual Journal Entry</h1>
          <div className="section-sub">
            Post a balanced entry ·{" "}
            <Link href="/accounting" style={{ color: "var(--muted)" }}>← Accounting</Link>
          </div>
        </div>
      </div>
      {accounts.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>
          Seed the chart of accounts first.
        </div>
      ) : (
        <JournalForm accounts={accounts.map((a) => ({ id: a.id, code: a.code, name: a.name }))} />
      )}
    </div>
  );
}

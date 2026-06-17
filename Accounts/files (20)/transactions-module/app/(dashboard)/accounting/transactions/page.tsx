import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { getTransactionFormData } from "@/actions/accounting-transactions";
import { TransactionsHub } from "@/components/accounting/TransactionsHub";

export const dynamic = "force-dynamic";

export default async function TransactionsPage() {
  await requireRole("ADMIN", "MANAGER", "SALES");
  const data = await getTransactionFormData();

  const seeded = data.all.length > 0;

  return (
    <div className="dashboard-content">
      <div className="section-header">
        <div>
          <h1>Record Transactions</h1>
          <div className="section-sub">
            Post everyday financial activity ·{" "}
            <Link href="/accounting" style={{ color: "var(--muted)" }}>← Accounting</Link>
          </div>
        </div>
      </div>

      {!seeded ? (
        <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>
          Seed the chart of accounts first (Accounting → Set up chart of accounts).
        </div>
      ) : (
        <TransactionsHub data={data} />
      )}
    </div>
  );
}

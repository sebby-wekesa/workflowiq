import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { listBankAccounts } from "@/actions/accounting-ar-ap";
import { getDebtors, getCreditors } from "@/actions/accounting-ar-ap";
import { PaymentForm } from "@/components/accounting/PaymentForm";

export const dynamic = "force-dynamic";

function money(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default async function BankingPage() {
  await requireRole("ADMIN", "MANAGER");
  const [banks, debtors, creditors] = await Promise.all([
    listBankAccounts(),
    getDebtors().catch(() => ({ rows: [] as any[], totalOutstanding: 0 })),
    getCreditors().catch(() => ({ rows: [] as any[], totalOutstanding: 0 })),
  ]);

  const customers = debtors.rows.map((r: any) => ({ id: r.id, name: r.name }));
  const suppliers = creditors.rows.map((r: any) => ({ id: r.id, name: r.name }));

  return (
    <div className="dashboard-content">
      <div className="section-header">
        <div>
          <h1>Banking</h1>
          <div className="section-sub">
            Account balances &amp; payments ·{" "}
            <Link href="/accounting" style={{ color: "var(--muted)" }}>← Accounting</Link>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, marginBottom: 20 }}>
        {(banks as any[]).length === 0 ? (
          <div className="card" style={{ padding: 18, color: "var(--muted)" }}>
            No bank accounts yet. Seed the chart of accounts — the standard “Bank — Current Account”
            and “M-Pesa” accounts become bankable, or add one from the Chart of Accounts page.
          </div>
        ) : (
          (banks as any[]).map((b) => (
            <div key={b.id} className="card" style={{ padding: 16 }}>
              <div style={{ fontWeight: 700 }}>{b.name}</div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>
                {b.bankName ?? "—"} {b.accountNumber ? `· ${b.accountNumber}` : ""} · GL {b.glCode}
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: "#2E5496" }}>{b.currency} {money(b.balance)}</div>
            </div>
          ))
        )}
      </div>

      <PaymentForm
        banks={(banks as any[]).map((b) => ({ id: b.id, name: b.name }))}
        customers={customers}
        suppliers={suppliers}
      />
    </div>
  );
}

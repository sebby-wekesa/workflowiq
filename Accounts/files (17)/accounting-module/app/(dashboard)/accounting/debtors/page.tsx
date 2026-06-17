import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { getDebtors } from "@/actions/accounting-ar-ap";

export const dynamic = "force-dynamic";

function money(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default async function DebtorsPage() {
  await requireRole("ADMIN", "MANAGER", "SALES");
  const { rows, totalOutstanding } = await getDebtors();

  return (
    <div className="dashboard-content">
      <div className="section-header">
        <div>
          <h1>Debtors</h1>
          <div className="section-sub">
            Customers who owe you ·{" "}
            <Link href="/accounting" style={{ color: "var(--muted)" }}>← Accounting</Link>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>Total outstanding</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#2E7D32" }}>KES {money(totalOutstanding)}</div>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>No customer balances yet.</div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid var(--border2)", textAlign: "left" }}>
                <th style={{ padding: "10px 16px" }}>Customer</th>
                <th style={{ padding: "10px 16px" }}>Phone</th>
                <th style={{ padding: "10px 16px", textAlign: "right" }}>Billed</th>
                <th style={{ padding: "10px 16px", textAlign: "right" }}>Paid</th>
                <th style={{ padding: "10px 16px", textAlign: "right" }}>Outstanding</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} style={{ borderBottom: "1px solid var(--border2)" }}>
                  <td style={{ padding: "8px 16px", fontWeight: 600 }}>{r.name}</td>
                  <td style={{ padding: "8px 16px", color: "var(--muted)", fontSize: 13 }}>{r.phone ?? "—"}</td>
                  <td style={{ padding: "8px 16px", textAlign: "right", fontFamily: "monospace" }}>{money(r.billed)}</td>
                  <td style={{ padding: "8px 16px", textAlign: "right", fontFamily: "monospace" }}>{money(r.paid)}</td>
                  <td style={{ padding: "8px 16px", textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: r.outstanding > 0 ? "#b91c1c" : "#2E7D32" }}>
                    {money(r.outstanding)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 12 }}>
        Record a customer payment from the Banking page to reduce these balances.
      </p>
    </div>
  );
}

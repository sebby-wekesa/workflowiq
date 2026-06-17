import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { getTrialBalance } from "@/actions/accounting";
import { backfillSalesPostings } from "@/actions/accounting-posting";

export const dynamic = "force-dynamic";

async function backfillAction() {
  "use server";
  await backfillSalesPostings();
}

function money(n: number) {
  return n === 0 ? "—" : n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default async function TrialBalancePage({
  searchParams,
}: {
  searchParams: Promise<{ asOf?: string }>;
}) {
  await requireRole("ADMIN", "MANAGER", "SALES");
  const { asOf } = await searchParams;
  const tb = await getTrialBalance(asOf);

  return (
    <div className="dashboard-content">
      <div className="section-header">
        <div>
          <h1>Trial Balance</h1>
          <div className="section-sub">
            As at {tb.asOf} ·{" "}
            <Link href="/accounting" style={{ color: "var(--muted)" }}>← Accounting</Link>
          </div>
        </div>
        <form action={backfillAction}>
          <button type="submit" className="btn btn-ghost btn-sm">Bring in existing sales</button>
        </form>
      </div>

      {!tb.balanced && (
        <div className="card" style={{ padding: 14, marginBottom: 14, borderLeft: "3px solid #b91c1c" }}>
          <strong style={{ color: "#b91c1c" }}>Out of balance.</strong> Debits and credits don’t match —
          this usually means a manual entry was forced through. Review recent journals.
        </div>
      )}

      {tb.rows.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>
          <p style={{ marginBottom: 6 }}>No posted transactions yet.</p>
          <p style={{ fontSize: 13 }}>
            Seed the chart of accounts, then click <strong>Bring in existing sales</strong> to post your history.
          </p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid var(--border2)", textAlign: "left" }}>
                <th style={{ padding: "10px 16px" }}>Code</th>
                <th style={{ padding: "10px 16px" }}>Account</th>
                <th style={{ padding: "10px 16px" }}>Type</th>
                <th style={{ padding: "10px 16px", textAlign: "right" }}>Debit</th>
                <th style={{ padding: "10px 16px", textAlign: "right" }}>Credit</th>
              </tr>
            </thead>
            <tbody>
              {tb.rows.map((r) => (
                <tr key={r.code} style={{ borderBottom: "1px solid var(--border2)" }}>
                  <td style={{ padding: "8px 16px", fontFamily: "monospace" }}>{r.code}</td>
                  <td style={{ padding: "8px 16px" }}>{r.name}</td>
                  <td style={{ padding: "8px 16px", fontSize: 12, color: "var(--muted)" }}>{r.type}</td>
                  <td style={{ padding: "8px 16px", textAlign: "right", fontFamily: "monospace" }}>{money(r.debit)}</td>
                  <td style={{ padding: "8px 16px", textAlign: "right", fontFamily: "monospace" }}>{money(r.credit)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: "2px solid var(--border2)", fontWeight: 700 }}>
                <td style={{ padding: "10px 16px" }} colSpan={3}>Total</td>
                <td style={{ padding: "10px 16px", textAlign: "right", fontFamily: "monospace" }}>{money(tb.totalDebit)}</td>
                <td style={{ padding: "10px 16px", textAlign: "right", fontFamily: "monospace" }}>{money(tb.totalCredit)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

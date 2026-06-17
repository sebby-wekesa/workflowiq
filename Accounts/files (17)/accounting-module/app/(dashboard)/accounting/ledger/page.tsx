import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { getGeneralLedger } from "@/actions/accounting";

export const dynamic = "force-dynamic";

function money(n: number) {
  return n === 0 ? "—" : n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(d: any) {
  return new Date(d).toISOString().slice(0, 10);
}

export default async function GeneralLedgerPage({
  searchParams,
}: {
  searchParams: Promise<{ account?: string; from?: string; to?: string }>;
}) {
  await requireRole("ADMIN", "MANAGER", "SALES");
  const sp = await searchParams;
  const data = await getGeneralLedger({ accountId: sp.account, from: sp.from, to: sp.to });

  return (
    <div className="dashboard-content">
      <div className="section-header">
        <div>
          <h1>General Ledger</h1>
          <div className="section-sub">
            <Link href="/accounting" style={{ color: "var(--muted)" }}>← Accounting</Link>
          </div>
        </div>
      </div>

      {/* Account picker */}
      <form method="get" className="card" style={{ padding: 14, marginBottom: 16, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "end" }}>
        <div style={{ flex: "2 1 260px" }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: 4 }}>ACCOUNT</label>
          <select name="account" defaultValue={data.accountId ?? ""} style={selectStyle}>
            <option value="">Select an account…</option>
            {data.accounts.map((a: any) => (
              <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
            ))}
          </select>
        </div>
        <div style={{ flex: "1 1 130px" }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: 4 }}>FROM</label>
          <input type="date" name="from" defaultValue={sp.from ?? ""} style={selectStyle} />
        </div>
        <div style={{ flex: "1 1 130px" }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: 4 }}>TO</label>
          <input type="date" name="to" defaultValue={sp.to ?? ""} style={selectStyle} />
        </div>
        <button type="submit" className="btn btn-primary btn-sm">View</button>
      </form>

      {!data.account ? (
        <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>
          Pick an account to see its ledger.
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border2)", fontWeight: 700 }}>
            {data.account.code} — {data.account.name}
            <span style={{ float: "right", fontWeight: 400, color: "var(--muted)", fontSize: 13 }}>
              Opening: {money(data.openingBalance)}
            </span>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border2)", textAlign: "left", fontSize: 12 }}>
                <th style={{ padding: "8px 16px" }}>Date</th>
                <th style={{ padding: "8px 16px" }}>Entry</th>
                <th style={{ padding: "8px 16px" }}>Memo</th>
                <th style={{ padding: "8px 16px", textAlign: "right" }}>Debit</th>
                <th style={{ padding: "8px 16px", textAlign: "right" }}>Credit</th>
                <th style={{ padding: "8px 16px", textAlign: "right" }}>Balance</th>
              </tr>
            </thead>
            <tbody>
              {data.lines.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: 24, textAlign: "center", color: "var(--muted)" }}>No transactions in this period.</td></tr>
              ) : (
                data.lines.map((l: any, i: number) => (
                  <tr key={i} style={{ borderBottom: "1px solid var(--border2)" }}>
                    <td style={{ padding: "7px 16px", fontFamily: "monospace", fontSize: 13 }}>{fmtDate(l.date)}</td>
                    <td style={{ padding: "7px 16px", fontFamily: "monospace", fontSize: 12 }}>{l.entryNumber}</td>
                    <td style={{ padding: "7px 16px", fontSize: 13 }}>{l.memo ?? "—"}</td>
                    <td style={{ padding: "7px 16px", textAlign: "right", fontFamily: "monospace" }}>{money(l.debit)}</td>
                    <td style={{ padding: "7px 16px", textAlign: "right", fontFamily: "monospace" }}>{money(l.credit)}</td>
                    <td style={{ padding: "7px 16px", textAlign: "right", fontFamily: "monospace", fontWeight: 600 }}>{l.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  background: "var(--surface2)",
  border: "1px solid var(--border2)",
  borderRadius: "var(--radius-sm)",
  color: "var(--text)",
  fontSize: 14,
};

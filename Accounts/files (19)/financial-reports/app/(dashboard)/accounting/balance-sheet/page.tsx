import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { getBalanceSheet } from "@/actions/accounting-reports";

export const dynamic = "force-dynamic";

function money(n: number) {
  const v = Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n < 0 ? `(${v})` : v;
}

export default async function BalanceSheetPage({
  searchParams,
}: {
  searchParams: Promise<{ asOf?: string }>;
}) {
  await requireRole("ADMIN", "MANAGER", "SALES");
  const sp = await searchParams;
  const bs = await getBalanceSheet({ asOf: sp.asOf });

  return (
    <div className="dashboard-content">
      <div className="section-header">
        <div>
          <h1>Balance Sheet</h1>
          <div className="section-sub">
            As at {bs.asOf} ·{" "}
            <Link href="/accounting" style={{ color: "var(--muted)" }}>← Accounting</Link>
          </div>
        </div>
        <form method="get" style={{ display: "flex", gap: 8, alignItems: "end" }}>
          <input type="date" name="asOf" defaultValue={sp.asOf ?? ""} style={inp} />
          <button type="submit" className="btn btn-ghost btn-sm">Apply</button>
        </form>
      </div>

      {!bs.balanced && (
        <div className="card" style={{ padding: 12, marginBottom: 14, borderLeft: "3px solid #b91c1c", color: "#b91c1c" }}>
          Assets don’t equal Liabilities + Equity. Check for unbalanced manual journals.
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" }}>
        <Block title="Assets" rows={bs.assets} total={bs.totalAssets} totalLabel="Total Assets" />
        <div style={{ display: "grid", gap: 16 }}>
          <Block title="Liabilities" rows={bs.liabilities} total={bs.totalLiabilities} totalLabel="Total Liabilities" />
          <Block title="Equity" rows={bs.equity} total={bs.totalEquity} totalLabel="Total Equity" />
          <div className="card" style={{ padding: "12px 16px", display: "flex", justifyContent: "space-between", fontWeight: 800, background: "rgba(46,84,150,0.06)" }}>
            <span>Liabilities + Equity</span>
            <span style={{ fontFamily: "monospace" }}>{money(bs.totalLiabAndEquity)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Block({ title, rows, total, totalLabel }: { title: string; rows: any[]; total: number; totalLabel: string }) {
  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ padding: "10px 16px", background: "var(--surface2)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--muted)" }}>
        {title}
      </div>
      {rows.length === 0 ? (
        <div style={{ padding: "8px 16px", color: "var(--muted)", fontSize: 13 }}>None</div>
      ) : rows.map((r, i) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "7px 16px", borderBottom: "1px solid var(--border2)" }}>
          <span><span style={{ fontFamily: "monospace", color: "var(--muted)", fontSize: 12, marginRight: 8 }}>{r.code}</span>{r.name}</span>
          <span style={{ fontFamily: "monospace" }}>{money(r.amount)}</span>
        </div>
      ))}
      <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 16px", fontWeight: 700, borderTop: "2px solid var(--border2)" }}>
        <span>{totalLabel}</span>
        <span style={{ fontFamily: "monospace" }}>{money(total)}</span>
      </div>
    </div>
  );
}

const inp: React.CSSProperties = { padding: "8px 10px", background: "var(--surface2)", border: "1px solid var(--border2)", borderRadius: "var(--radius-sm)", color: "var(--text)", fontSize: 14 };

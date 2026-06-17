import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { getProfitAndLoss } from "@/actions/accounting-reports";

export const dynamic = "force-dynamic";

function money(n: number) {
  const v = Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n < 0 ? `(${v})` : v;
}

export default async function ProfitLossPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  await requireRole("ADMIN", "MANAGER", "SALES");
  const sp = await searchParams;
  const pl = await getProfitAndLoss({ from: sp.from, to: sp.to });

  return (
    <div className="dashboard-content">
      <div className="section-header">
        <div>
          <h1>Profit &amp; Loss</h1>
          <div className="section-sub">
            {pl.from ? `${pl.from} → ${pl.to}` : `Up to ${pl.to}`} ·{" "}
            <Link href="/accounting" style={{ color: "var(--muted)" }}>← Accounting</Link>
          </div>
        </div>
      </div>

      <form method="get" className="card" style={{ padding: 12, marginBottom: 16, display: "flex", gap: 12, alignItems: "end" }}>
        <div><label style={lbl}>FROM</label><input type="date" name="from" defaultValue={sp.from ?? ""} style={inp} /></div>
        <div><label style={lbl}>TO</label><input type="date" name="to" defaultValue={sp.to ?? ""} style={inp} /></div>
        <button type="submit" className="btn btn-primary btn-sm">Apply</button>
      </form>

      <div className="card" style={{ padding: 0, overflow: "hidden", maxWidth: 640 }}>
        <Section title="Income" rows={pl.income} />
        <TotalRow label="Total Income" value={pl.totalIncome} strong />

        {pl.costOfSales > 0 && (
          <>
            <TotalRow label="Cost of Sales" value={-pl.costOfSales} />
            <TotalRow label="Gross Profit" value={pl.grossProfit} strong accent />
          </>
        )}

        <Section title="Expenses" rows={pl.expenses} />
        <TotalRow label="Total Expenses" value={-pl.totalExpense} strong />

        <div style={{ borderTop: "2px solid var(--border2)", padding: "14px 16px", display: "flex", justifyContent: "space-between", background: pl.netProfit >= 0 ? "rgba(46,125,50,0.08)" : "rgba(185,28,28,0.08)" }}>
          <span style={{ fontWeight: 800, fontSize: 16 }}>NET {pl.netProfit >= 0 ? "PROFIT" : "LOSS"}</span>
          <span style={{ fontWeight: 800, fontSize: 16, fontFamily: "monospace", color: pl.netProfit >= 0 ? "#2E7D32" : "#b91c1c" }}>
            {money(pl.netProfit)}
          </span>
        </div>
      </div>

      <div style={{ display: "flex", gap: 24, marginTop: 16 }}>
        <Metric label="Gross margin" value={`${pl.grossMargin}%`} />
        <Metric label="Net margin" value={`${pl.netMargin}%`} accent={pl.netMargin >= 0 ? "#2E7D32" : "#b91c1c"} />
      </div>
    </div>
  );
}

function Section({ title, rows }: { title: string; rows: any[] }) {
  return (
    <>
      <div style={{ padding: "10px 16px", background: "var(--surface2)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--muted)" }}>
        {title}
      </div>
      {rows.length === 0 ? (
        <div style={{ padding: "8px 16px", color: "var(--muted)", fontSize: 13 }}>None</div>
      ) : rows.map((r) => (
        <div key={r.code} style={{ display: "flex", justifyContent: "space-between", padding: "7px 16px", borderBottom: "1px solid var(--border2)" }}>
          <span><span style={{ fontFamily: "monospace", color: "var(--muted)", fontSize: 12, marginRight: 8 }}>{r.code}</span>{r.name}</span>
          <span style={{ fontFamily: "monospace" }}>{money(r.amount)}</span>
        </div>
      ))}
    </>
  );
}

function TotalRow({ label, value, strong, accent }: { label: string; value: number; strong?: boolean; accent?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "9px 16px", borderBottom: "1px solid var(--border2)", fontWeight: strong ? 700 : 400, background: accent ? "rgba(46,84,150,0.06)" : undefined }}>
      <span>{label}</span>
      <span style={{ fontFamily: "monospace" }}>{Math.abs(value).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
    </div>
  );
}

function Metric({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="card" style={{ padding: 14, minWidth: 140 }}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--muted)", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: accent ?? "var(--text)" }}>{value}</div>
    </div>
  );
}

const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: 4 };
const inp: React.CSSProperties = { padding: "8px 10px", background: "var(--surface2)", border: "1px solid var(--border2)", borderRadius: "var(--radius-sm)", color: "var(--text)", fontSize: 14 };

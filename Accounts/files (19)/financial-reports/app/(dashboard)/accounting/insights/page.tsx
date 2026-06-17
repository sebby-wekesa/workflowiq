import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { getFinancialInsights } from "@/actions/accounting-reports";

export const dynamic = "force-dynamic";

function money(n: number) {
  return "KES " + n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

const riskColor: Record<string, string> = { HIGH: "#b91c1c", MEDIUM: "#C55A11", LOW: "#2E7D32" };

export default async function InsightsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  await requireRole("ADMIN", "MANAGER");
  const sp = await searchParams;
  const ins = await getFinancialInsights({ from: sp.from, to: sp.to });
  const pl = ins.pl;

  return (
    <div className="dashboard-content">
      <div className="section-header">
        <div>
          <h1>Financial Insights</h1>
          <div className="section-sub">
            Ground-truth numbers from your ledger ·{" "}
            <Link href="/accounting" style={{ color: "var(--muted)" }}>← Accounting</Link>
          </div>
        </div>
      </div>

      {/* Headline P&L */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 14, marginBottom: 22 }}>
        <Kpi label="Revenue" value={money(pl.totalIncome)} accent="#2E5496" />
        <Kpi label="Gross profit" value={money(pl.grossProfit)} sub={`${pl.grossMargin}% margin`} accent="#2E7D32" />
        <Kpi label={pl.netProfit >= 0 ? "Net profit" : "Net loss"} value={money(pl.netProfit)} sub={`${pl.netMargin}% margin`} accent={pl.netProfit >= 0 ? "#2E7D32" : "#b91c1c"} />
        <Kpi label="Customers" value={String(ins.customerCount)} accent="#555" />
      </div>

      {/* Concentration risk — the signature insight */}
      <div className="card" style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontWeight: 700 }}>Customer concentration</div>
          <span style={{ fontSize: 12, fontWeight: 800, padding: "3px 10px", borderRadius: 6, background: `${riskColor[ins.concentrationRisk]}22`, color: riskColor[ins.concentrationRisk] }}>
            {ins.concentrationRisk} RISK
          </span>
        </div>

        {ins.topCustomer && (
          <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 14 }}>
            Your largest customer, <strong style={{ color: "var(--text)" }}>{ins.topCustomer.name}</strong>, is{" "}
            <strong style={{ color: riskColor[ins.concentrationRisk] }}>{ins.topCustomer.share}%</strong> of revenue.
            {ins.concentrationRisk === "HIGH" && " Losing them would put serious strain on the business — worth diversifying."}
            {ins.concentrationRisk === "MEDIUM" && " A meaningful chunk of revenue rides on one client."}
            {ins.concentrationRisk === "LOW" && " Revenue is well spread across customers."}
          </p>
        )}

        {ins.concentration.length === 0 ? (
          <div style={{ color: "var(--muted)", fontSize: 13 }}>No sales recorded yet.</div>
        ) : (
          <div>
            {ins.concentration.map((c) => (
              <div key={c.name} style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 2 }}>
                  <span>{c.name}</span>
                  <span style={{ fontFamily: "monospace", color: "var(--muted)" }}>{money(c.amount)} · {c.share}%</span>
                </div>
                <div style={{ height: 6, background: "var(--surface2)", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ width: `${Math.min(c.share, 100)}%`, height: "100%", background: c.share >= 50 ? "#b91c1c" : c.share >= 30 ? "#C55A11" : "#2E5496" }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <p style={{ fontSize: 12, color: "var(--muted)" }}>
        These figures come straight from your posted ledger and confirmed sales — no estimates.
        Open <Link href="/accounting/profit-loss" style={{ color: "var(--accent)" }}>Profit &amp; Loss</Link> for the full breakdown.
      </p>
    </div>
  );
}

function Kpi({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent: string }) {
  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--muted)", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 19, fontWeight: 700, color: accent }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

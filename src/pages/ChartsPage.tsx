import { Link } from "react-router-dom";
import { DownloadIcon, LandmarkIcon, PrinterIcon, ReceiptIcon, TrendingUpIcon } from "lucide-react";
import { useAuth } from "@/components/providers/auth";
import { useChartsDashboardSummary, type ChartsDashboardSummary } from "@/lib/api";

function money(value: number) {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function exportDashboard(summary: ChartsDashboardSummary) {
  const rows = [
    ["Total Cash Book Balance", summary.totalCashBookBalance],
    ["Total Revenue", summary.totalRevenue],
    ["Total Cost of Goods Sold", summary.totalCostOfGoodsSold],
    ["Gross Profit", summary.grossProfit],
    ["Total Administrative Expenses", summary.totalAdministrativeExpenses],
    ["Total Finance Charges", summary.totalFinanceCharges],
    ["Total Other Operating Expenses", summary.totalOtherOperatingExpenses],
    ["Total Operating Expenses", summary.totalOperatingExpenses],
    ["Net Profit / Loss", summary.netProfitLoss],
    ["Outstanding Invoices", summary.outstandingInvoices],
    ["Paid Invoices", summary.paidInvoices],
    ["Overdue Invoices", summary.overdueInvoices],
    ["Credit Notes Issued", summary.creditNotesIssued],
    ["Net Revenue", summary.netRevenue],
  ];
  const body = ["Metric\tAmount", ...rows.map(([label, value]) => `${label}\t${value}`)].join("\n");
  const blob = new Blob([body], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "charts-dashboard.xls";
  link.click();
  URL.revokeObjectURL(url);
}

export default function ChartsPage() {
  const { appUser, organization } = useAuth();
  const summary = useChartsDashboardSummary();

  if (!appUser) return <div className="panel-state">Loading charts...</div>;

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">{organization?.name ?? "Workshop"}</p>
          <h1>Charts</h1>
        </div>
        <div className="header-actions">
          <button type="button" className="button button-secondary" onClick={() => window.print()} disabled={!summary.data}>
            <PrinterIcon className="size-4" />
            PDF
          </button>
          <button type="button" className="button button-secondary" onClick={() => summary.data && exportDashboard(summary.data)} disabled={!summary.data}>
            <DownloadIcon className="size-4" />
            Excel
          </button>
        </div>
      </header>

      {summary.error && <div className="error-banner">Could not load charts dashboard: {summary.error.message}</div>}
      {summary.isLoading && <div className="panel-state"><div className="loader" />Loading charts dashboard...</div>}

      {!summary.isLoading && !summary.error && summary.data && (
        <>
          <section className="charts-dashboard-grid">
            <DashboardMetric icon={LandmarkIcon} label="Total Cash Book Balance" value={money(summary.data.totalCashBookBalance)} detail="Cash at bank plus cash in hand" tone="green" />
            <DashboardMetric icon={ReceiptIcon} label="Total Revenue" value={money(summary.data.totalRevenue)} detail={`Net revenue ${money(summary.data.netRevenue)}`} tone="blue" />
            <DashboardMetric icon={TrendingUpIcon} label="Total Cost of Goods Sold" value={money(summary.data.totalCostOfGoodsSold)} detail={`Gross profit ${money(summary.data.grossProfit)}`} tone="orange" />
            <DashboardMetric icon={TrendingUpIcon} label="Net Profit / Loss" value={money(summary.data.netProfitLoss)} detail={`Operating expenses ${money(summary.data.totalOperatingExpenses)}`} tone="red" />
          </section>

          <section className="charts-profit-grid">
            <FormulaPanel
              title="Revenue"
              rows={[
                ["Total Revenue", summary.data.totalRevenue],
                ["Credit Notes Issued", -summary.data.creditNotesIssued],
                ["Net Revenue", summary.data.netRevenue],
              ]}
            />
            <FormulaPanel
              title="Gross Profit"
              rows={[
                ["Revenue", summary.data.totalRevenue],
                ["Cost of Goods Sold", -summary.data.totalCostOfGoodsSold],
                ["Gross Profit", summary.data.grossProfit],
              ]}
            />
            <FormulaPanel
              title="Operating Expenses"
              rows={[
                ["Administrative Expenses", summary.data.totalAdministrativeExpenses],
                ["Finance Charges", summary.data.totalFinanceCharges],
                ["Other Operating Expenses", summary.data.totalOtherOperatingExpenses],
                ["Total Operating Expenses", summary.data.totalOperatingExpenses],
              ]}
            />
            <FormulaPanel
              title="Invoices"
              rows={[
                ["Outstanding Invoices", summary.data.outstandingInvoices],
                ["Paid Invoices", summary.data.paidInvoices],
                ["Overdue Invoices", summary.data.overdueInvoices],
              ]}
            />
          </section>

          <div className="charts-dashboard-actions">
            <Link to="/accounting/chart" className="button button-primary">Open accounting charts</Link>
            <Link to="/accounting/reports" className="button button-secondary">Open reports</Link>
            <Link to="/accounting/ledger" className="button button-secondary">Open general ledger</Link>
          </div>
        </>
      )}
    </div>
  );
}

function DashboardMetric({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: typeof LandmarkIcon;
  label: string;
  value: string;
  detail: string;
  tone: "green" | "blue" | "orange" | "red";
}) {
  return (
    <div className={`metric metric-${tone} charts-dashboard-metric`}>
      <span><Icon className="size-4" />{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function FormulaPanel({ title, rows }: { title: string; rows: [string, number][] }) {
  return (
    <div className="card charts-formula-card">
      <div className="card-heading">
        <div>
          <p className="eyebrow">Formula</p>
          <h2>{title}</h2>
        </div>
      </div>
      <div className="accounting-home-rows">
        {rows.map(([label, amount], index) => (
          <div className="accounting-home-row" key={label}>
            <div><strong>{label}</strong></div>
            <span className={index === rows.length - 1 ? "charts-formula-total" : undefined}>
              {money(amount)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

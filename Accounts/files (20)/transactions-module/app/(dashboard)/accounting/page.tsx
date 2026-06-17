import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { getTrialBalance } from "@/actions/accounting";
import { getDebtors, getCreditors, listBankAccounts } from "@/actions/accounting-ar-ap";
import { seedChartOfAccounts } from "@/actions/accounting";

export const dynamic = "force-dynamic";

async function seedAction() {
  "use server";
  await seedChartOfAccounts();
}

function money(n: number) {
  return "KES " + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default async function AccountingPage() {
  await requireRole("ADMIN", "MANAGER");

  // Each of these is resilient to an empty/unseeded org.
  const [tb, debtors, creditors, banks] = await Promise.all([
    getTrialBalance().catch(() => null),
    getDebtors().catch(() => ({ rows: [], totalOutstanding: 0 })),
    getCreditors().catch(() => ({ rows: [], totalOutstanding: 0 })),
    listBankAccounts().catch(() => []),
  ]);

  const cards = [
    { href: "/accounting/transactions", title: "Record Transactions", desc: "Expenses, income, bills, invoices, transfers", icon: "➕" },
    { href: "/accounting/insights", title: "Financial Insights", desc: "Revenue, profit & concentration risk", icon: "💡" },
    { href: "/accounting/profit-loss", title: "Profit & Loss", desc: "Income statement for any period", icon: "📈" },
    { href: "/accounting/balance-sheet", title: "Balance Sheet", desc: "Assets, liabilities & equity", icon: "📊" },
    { href: "/accounting/trial-balance", title: "Trial Balance", desc: "Debits vs credits across all accounts", icon: "⚖️" },
    { href: "/accounting/ledger", title: "General Ledger", desc: "Every transaction, account by account", icon: "📒" },
    { href: "/accounting/debtors", title: "Debtors", desc: "Who owes you and how much", icon: "📥" },
    { href: "/accounting/creditors", title: "Creditors", desc: "Who you owe and how much", icon: "📤" },
    { href: "/accounting/banking", title: "Banking", desc: "Bank & cash account balances", icon: "🏦" },
    { href: "/accounting/chart", title: "Chart of Accounts", desc: "Your account list", icon: "🗂️" },
    { href: "/accounting/journal", title: "Journal Entry", desc: "Post a manual entry", icon: "✍️" },
  ];

  const bankTotal = (banks as any[]).reduce((s, b) => s + b.balance, 0);
  const needsSeed = !tb || tb.rows.length === 0;

  return (
    <div className="dashboard-content">
      <div className="section-header">
        <div>
          <h1>Accounting</h1>
          <div className="section-sub">Trial balance, ledger, banking, debtors &amp; creditors</div>
        </div>
        <form action={seedAction}>
          <button type="submit" className="btn btn-ghost btn-sm">
            {needsSeed ? "Set up chart of accounts" : "Add any missing accounts"}
          </button>
        </form>
      </div>

      {needsSeed && (
        <div className="card" style={{ padding: 20, marginBottom: 16, borderLeft: "3px solid #C55A11" }}>
          <p style={{ fontWeight: 600, marginBottom: 4 }}>Get started</p>
          <p style={{ fontSize: 13, color: "var(--muted)" }}>
            Click <strong>Set up chart of accounts</strong> above to load the standard Kenyan SME
            accounts. Then open Trial Balance and use “Bring in existing sales” to post your history.
          </p>
        </div>
      )}

      {/* KPI row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, marginBottom: 20 }}>
        <Kpi label="Owed to you (debtors)" value={money(debtors.totalOutstanding)} accent="#2E7D32" />
        <Kpi label="You owe (creditors)" value={money(creditors.totalOutstanding)} accent="#C55A11" />
        <Kpi label="Cash & bank" value={money(bankTotal)} accent="#2E5496" />
        <Kpi
          label="Trial balance"
          value={tb ? (tb.balanced ? "Balanced ✓" : "Out of balance!") : "—"}
          accent={tb && tb.balanced ? "#2E7D32" : "#b91c1c"}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14 }}>
        {cards.map((c) => (
          <Link key={c.href} href={c.href} className="card" style={{ padding: 18, textDecoration: "none", color: "inherit", display: "block" }}>
            <div style={{ fontSize: 22, marginBottom: 8 }}>{c.icon}</div>
            <div style={{ fontWeight: 700, marginBottom: 2 }}>{c.title}</div>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>{c.desc}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function Kpi({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--muted)", marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color: accent }}>{value}</div>
    </div>
  );
}

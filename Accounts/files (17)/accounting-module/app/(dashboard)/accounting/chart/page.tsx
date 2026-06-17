import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { listAccounts } from "@/actions/accounting";

export const dynamic = "force-dynamic";

const TYPE_ORDER = ["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"];

export default async function ChartOfAccountsPage() {
  await requireRole("ADMIN", "MANAGER");
  const accounts = await listAccounts();

  const byType: Record<string, any[]> = {};
  for (const a of accounts) (byType[a.type] ??= []).push(a);

  return (
    <div className="dashboard-content">
      <div className="section-header">
        <div>
          <h1>Chart of Accounts</h1>
          <div className="section-sub">
            Your account list ·{" "}
            <Link href="/accounting" style={{ color: "var(--muted)" }}>← Accounting</Link>
          </div>
        </div>
      </div>

      {accounts.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>
          No accounts yet. Go back to Accounting and click “Set up chart of accounts”.
        </div>
      ) : (
        TYPE_ORDER.filter((t) => byType[t]?.length).map((type) => (
          <div key={type} style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--muted)", marginBottom: 6 }}>
              {type}
            </div>
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <tbody>
                  {byType[type].map((a) => (
                    <tr key={a.id} style={{ borderBottom: "1px solid var(--border2)" }}>
                      <td style={{ padding: "8px 16px", fontFamily: "monospace", width: 80 }}>{a.code}</td>
                      <td style={{ padding: "8px 16px", fontWeight: 600 }}>{a.name}</td>
                      <td style={{ padding: "8px 16px", fontSize: 12, color: "var(--muted)" }}>{a.normalBalance}</td>
                      <td style={{ padding: "8px 16px", textAlign: "right" }}>
                        {a.isBank && <Tag text="Bank" color="#2E5496" />}
                        {a.isSystem && <Tag text="System" color="#C55A11" />}
                        {!a.isActive && <Tag text="Inactive" color="#9E9E9E" />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}
      <p style={{ fontSize: 12, color: "var(--muted)" }}>
        System accounts are used by automatic posting — you can rename them, but don’t delete them.
      </p>
    </div>
  );
}

function Tag({ text, color }: { text: string; color: string }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 4, marginLeft: 6, background: `${color}22`, color }}>
      {text}
    </span>
  );
}

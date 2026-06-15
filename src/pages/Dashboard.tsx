import { useMemo, useState } from "react";
import Brand from "@/components/Brand";
import { useAuth } from "@/components/providers/auth";
import { useCustomers, useJobs, useStock } from "@/lib/api";
import type { JobStatus } from "@/lib/supabase";

type View = "overview" | "jobs" | "stock" | "customers";

const statusLabels: Record<JobStatus, string> = {
  received: "Received",
  workshop: "Workshop",
  relining: "Relining",
  qc: "Quality check",
  done: "Ready",
  collected: "Collected",
};

const pipeline: JobStatus[] = ["received", "workshop", "relining", "qc", "done"];

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(value));
}

function initials(name?: string | null) {
  return (name || "W I").split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

export default function Dashboard() {
  const { appUser, organization, signOut } = useAuth();
  const [view, setView] = useState<View>("overview");
  const jobs = useJobs();
  const stock = useStock();
  const customers = useCustomers();

  const metrics = useMemo(() => {
    const jobRows = jobs.data ?? [];
    const stockRows = stock.data ?? [];
    return {
      active: jobRows.filter((job) => !["done", "collected"].includes(job.status)).length,
      ready: jobRows.filter((job) => job.status === "done").length,
      urgent: jobRows.filter((job) => job.priority === "urgent" && job.status !== "collected").length,
      lowStock: stockRows.filter((item) => item.current_qty <= item.min_threshold).length,
    };
  }, [jobs.data, stock.data]);

  const isLoading = jobs.isLoading || stock.isLoading || customers.isLoading;
  const error = jobs.error || stock.error || customers.error;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Brand compact />
        <nav>
          {(["overview", "jobs", "stock", "customers"] as View[]).map((item) => (
            <button
              key={item}
              className={view === item ? "active" : ""}
              onClick={() => setView(item)}
            >
              <span className={`nav-icon nav-${item}`} />
              {item[0].toUpperCase() + item.slice(1)}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="workspace">
            <span className="avatar">{initials(organization?.name)}</span>
            <div><strong>{organization?.name ?? "Workshop"}</strong><small>{appUser?.role}</small></div>
          </div>
          <button className="sign-out" onClick={signOut}>Sign out</button>
        </div>
      </aside>

      <main className="dashboard">
        <header className="dashboard-header">
          <div>
            <p className="eyebrow">{organization?.name ?? "Your workshop"}</p>
            <h1>{view === "overview" ? "Good morning" : view[0].toUpperCase() + view.slice(1)}</h1>
          </div>
          <div className="header-actions">
            <span className="live-indicator">Live workspace</span>
            <span className="avatar user-avatar">{initials(appUser?.name || appUser?.email)}</span>
          </div>
        </header>

        {isLoading && <div className="panel-state"><div className="loader" />Loading workshop data...</div>}
        {error && <div className="error-banner">Could not load workshop data: {error.message}</div>}

        {!isLoading && !error && view === "overview" && (
          <>
            <section className="metric-grid">
              <Metric label="Active jobs" value={metrics.active} detail="In production" tone="green" />
              <Metric label="Ready to collect" value={metrics.ready} detail="Awaiting customer" tone="blue" />
              <Metric label="Urgent jobs" value={metrics.urgent} detail="Needs attention" tone="orange" />
              <Metric label="Low stock items" value={metrics.lowStock} detail="At or below minimum" tone="red" />
            </section>

            <section className="dashboard-grid">
              <div className="card pipeline-card">
                <div className="card-heading"><div><p className="eyebrow">Current load</p><h2>Job pipeline</h2></div><span>{metrics.active + metrics.ready} open</span></div>
                <div className="pipeline">
                  {pipeline.map((status) => {
                    const count = (jobs.data ?? []).filter((job) => job.status === status).length;
                    const max = Math.max(...pipeline.map((item) => (jobs.data ?? []).filter((job) => job.status === item).length), 1);
                    return (
                      <div className="pipeline-row" key={status}>
                        <span>{statusLabels[status]}</span>
                        <div><i style={{ width: `${Math.max((count / max) * 100, count ? 8 : 0)}%` }} /></div>
                        <strong>{count}</strong>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="card attention-card">
                <div className="card-heading"><div><p className="eyebrow">Inventory</p><h2>Needs attention</h2></div></div>
                <div className="attention-list">
                  {(stock.data ?? []).filter((item) => item.current_qty <= item.min_threshold).slice(0, 4).map((item) => (
                    <div key={item.id}><span className="stock-signal" /><div><strong>{item.name}</strong><small>{item.current_qty} {item.unit} remaining</small></div><em>Low</em></div>
                  ))}
                  {metrics.lowStock === 0 && <div className="empty-state">All stock levels look healthy.</div>}
                </div>
              </div>
            </section>

            <DataTable title="Recent jobs" columns={["Job", "Customer", "Stage", "Priority", "Received"]}>
              {(jobs.data ?? []).slice(0, 6).map((job) => (
                <tr key={job.id}>
                  <td><strong>{job.job_number}</strong><small>{job.description}</small></td>
                  <td>{job.customerName}</td>
                  <td><span className={`status status-${job.status}`}>{statusLabels[job.status]}</span></td>
                  <td><span className={`priority priority-${job.priority}`}>{job.priority}</span></td>
                  <td>{formatDate(job.created_at)}</td>
                </tr>
              ))}
            </DataTable>
          </>
        )}

        {!isLoading && !error && view === "jobs" && (
          <DataTable title={`${jobs.data?.length ?? 0} workshop jobs`} columns={["Job", "Customer", "Stage", "Priority", "Received"]}>
            {(jobs.data ?? []).map((job) => (
              <tr key={job.id}>
                <td><strong>{job.job_number}</strong><small>{job.description}</small></td>
                <td>{job.customerName}</td>
                <td><span className={`status status-${job.status}`}>{statusLabels[job.status]}</span></td>
                <td><span className={`priority priority-${job.priority}`}>{job.priority}</span></td>
                <td>{formatDate(job.created_at)}</td>
              </tr>
            ))}
          </DataTable>
        )}

        {!isLoading && !error && view === "stock" && (
          <DataTable title={`${stock.data?.length ?? 0} inventory items`} columns={["Item", "Category", "Available", "Minimum", "Supplier"]}>
            {(stock.data ?? []).map((item) => (
              <tr key={item.id}>
                <td><strong>{item.name}</strong></td>
                <td>{item.category.replaceAll("_", " ")}</td>
                <td className={item.current_qty <= item.min_threshold ? "danger-text" : ""}>{item.current_qty} {item.unit}</td>
                <td>{item.min_threshold} {item.unit}</td>
                <td>{item.supplier ?? "—"}</td>
              </tr>
            ))}
          </DataTable>
        )}

        {!isLoading && !error && view === "customers" && (
          <DataTable title={`${customers.data?.length ?? 0} customers`} columns={["Customer", "Phone", "Location", "Added"]}>
            {(customers.data ?? []).map((customer) => (
              <tr key={customer.id}>
                <td><strong>{customer.name}</strong></td>
                <td>{customer.phone || "—"}</td>
                <td>{customer.location ?? "—"}</td>
                <td>{formatDate(customer.created_at)}</td>
              </tr>
            ))}
          </DataTable>
        )}
      </main>
    </div>
  );
}

function Metric({ label, value, detail, tone }: { label: string; value: number; detail: string; tone: string }) {
  return <div className={`metric metric-${tone}`}><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>;
}

function DataTable({ title, columns, children }: { title: string; columns: string[]; children: React.ReactNode }) {
  return (
    <section className="card table-card">
      <div className="card-heading"><div><p className="eyebrow">Workspace data</p><h2>{title}</h2></div></div>
      <div className="table-scroll"><table><thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{children}</tbody></table></div>
    </section>
  );
}

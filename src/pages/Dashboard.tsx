import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/components/providers/auth";
import {
  useCreateCustomer, useCreateJob, useCreateStock, useCustomers, useJobs, useStock, useStockMovements,
} from "@/lib/api";
import type {
  Customer, JobCondition, JobPriority, JobStatus, StockCategory,
} from "@/lib/supabase";

type View = "overview" | "jobs" | "stock" | "customers" | "movements";
type CreateModal = "job" | "stock" | "customer" | null;

const routeToView: Record<string, View> = {
  "/dashboard": "overview",
  "/jobs": "jobs",
  "/customers": "customers",
  "/stock": "stock",
  "/deliveries": "overview",
  "/staff": "overview",
  "/reports": "overview",
};

const statusLabels: Record<JobStatus, string> = {
  received: "Received",
  workshop: "Workshop",
  relining: "Relining",
  qc: "Quality check",
  done: "Ready",
  collected: "Collected",
};

const pipeline: JobStatus[] = ["received", "workshop", "relining", "qc", "done"];
const jobConditions: { value: JobCondition; label: string }[] = [
  { value: "good", label: "Good" },
  { value: "worn", label: "Worn" },
  { value: "heavily_worn", label: "Heavily worn" },
  { value: "damaged", label: "Damaged" },
];
const stockCategories: { value: StockCategory; label: string }[] = [
  { value: "lining_material", label: "Lining material" },
  { value: "rivets", label: "Rivets" },
  { value: "adhesive", label: "Adhesive" },
  { value: "hardware", label: "Hardware" },
  { value: "consumable", label: "Consumable" },
  { value: "other", label: "Other" },
];

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(value));
}

function localDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function initials(name?: string | null) {
  return (name || "W I").split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

export default function Dashboard() {
  const { pathname } = useLocation();
  const { appUser, organization } = useAuth();
  const view = routeToView[pathname] ?? "overview";
  const [createModal, setCreateModal] = useState<CreateModal>(null);
  const [selectedStockId, setSelectedStockId] = useState<string | null>(null);
  const jobs = useJobs();
  const stock = useStock();
  const customers = useCustomers();
  const movements = useStockMovements(selectedStockId ?? undefined);

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
    <>
    <div className="dashboard">
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
          <section className="jobs-section">
            <div className="section-heading">
              <div><p className="eyebrow">Workshop jobs</p><h2>{jobs.data?.length ?? 0} job cards</h2></div>
              <button type="button" className="add-button" onClick={() => setCreateModal("job")}>+ Create job</button>
            </div>
            <div className="job-grid">
              {(jobs.data ?? []).map((job) => (
                <article className={`job-card job-card-${job.status}`} key={job.id}>
                  <div className="job-card-heading">
                    <div><span>{job.job_number}</span><h3>{job.customerName}</h3></div>
                    <span className={`status status-${job.status}`}>{statusLabels[job.status]}</span>
                  </div>
                  <p className="job-description">{job.description}</p>
                  <div className="job-details">
                    <div><span>Quantity</span><strong>{job.quantity}</strong></div>
                    <div><span>Condition</span><strong>{job.condition.replaceAll("_", " ")}</strong></div>
                    <div><span>Received</span><strong>{formatDate(job.date_received)}</strong></div>
                    <div><span>Priority</span><strong className={`priority priority-${job.priority}`}>{job.priority}</strong></div>
                  </div>
                  <div className="job-card-footer">
                    <span>{job.customerPhone || "No phone number"}</span>
                    <span>{job.intake_notes || "No intake notes"}</span>
                  </div>
                </article>
              ))}
              {jobs.data?.length === 0 && <div className="empty-card">No jobs yet. Create the first job card.</div>}
            </div>
          </section>
        )}

         {!isLoading && !error && view === "stock" && (
            <DataTable
              title={`${stock.data?.length ?? 0} inventory items`}
              columns={["Item", "Category", "Available", "Minimum", "Supplier"]}
              action={<button type="button" className="add-button" onClick={() => setCreateModal("stock")}>+ Add stock</button>}
            >
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

          {!isLoading && !error && view === "movements" && selectedStockId && (
            <DataTable
              title={`${stock.data?.find(s => s.id === selectedStockId)?.name ?? "Unknown" } movements`}
              columns={["Date", "Type", "Quantity", "Reason", "By"]}
              action={
                <>
                  <button type="button" className="add-button" onClick={() => setCreateModal("stock")}>+ New movement</button>
                  <button type="button" className="add-button" onClick={() => setSelectedStockId(null)} style={{marginLeft: "8px"}}>
                    All stocks
                  </button>
                </>
              }
            >
              {(movements.data ?? []).map((movement) => (
                <tr key={movement.id}>
                  <td>{movement.created_at}</td>
                  <td>{movement.type}</td>
                  <td>{movement.quantity}</td>
                  <td>{movement.reason}</td>
                  <td>{movement.performedByName ?? "System"}</td>
                </tr>
              ))}
            </DataTable>
          )}

          {createModal === "job" && <AddJobModal customers={customers.data ?? []} onClose={() => setCreateModal(null)} />}
          {createModal === "stock" && <AddStockModal onClose={() => setCreateModal(null)} />}
          {createModal === "customer" && <AddCustomerModal onClose={() => setCreateModal(null)} />}
          {selectedStockId && createModal !== "stock" && (
            <button type="button" className="add-button" onClick={() => setSelectedStockId(null)} style={{marginTop: "16px"}}>
              Back to stock list
            </button>
          )}

        {!isLoading && !error && view === "customers" && (
          <DataTable
            title={`${customers.data?.length ?? 0} customers`}
            columns={["Customer", "Phone", "Location", "Added"]}
            action={<button type="button" className="add-button" onClick={() => setCreateModal("customer")}>+ Add customer</button>}
          >
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
    </div>

      {createModal === "job" && <AddJobModal customers={customers.data ?? []} onClose={() => setCreateModal(null)} />}
      {createModal === "stock" && <AddStockModal onClose={() => setCreateModal(null)} />}
      {createModal === "customer" && <AddCustomerModal onClose={() => setCreateModal(null)} />}
    </>
  );
}

function Metric({ label, value, detail, tone }: { label: string; value: number; detail: string; tone: string }) {
  return <div className={`metric metric-${tone}`}><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>;
}

function DataTable({
  title, columns, children, action,
}: { title: string; columns: string[]; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="card table-card">
      <div className="card-heading"><div><p className="eyebrow">Workspace data</p><h2>{title}</h2></div>{action}</div>
      <div className="table-scroll"><table><thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{children}</tbody></table></div>
    </section>
  );
}

function AddJobModal({ customers, onClose }: { customers: Customer[]; onClose: () => void }) {
  const createJob = useCreateJob();
  const [form, setForm] = useState({
    customerId: customers[0]?.id ?? "new",
    customerName: "",
    customerPhone: "",
    description: "",
    quantity: "1",
    condition: "worn" as JobCondition,
    dateReceived: localDate(),
    priority: "normal" as JobPriority,
    intakeNotes: "",
  });
  const isNewCustomer = form.customerId === "new";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const selectedCustomer = customers.find((customer) => customer.id === form.customerId);
    try {
      await createJob.mutateAsync({
        customerId: isNewCustomer ? undefined : selectedCustomer?.id,
        customerName: isNewCustomer ? form.customerName.trim() : selectedCustomer?.name ?? "",
        customerPhone: isNewCustomer ? form.customerPhone.trim() : selectedCustomer?.phone ?? "",
        description: form.description.trim(),
        quantity: Number(form.quantity),
        condition: form.condition,
        intakeNotes: form.intakeNotes.trim() || undefined,
        dateReceived: form.dateReceived,
        priority: form.priority,
      });
      onClose();
    } catch {
      // The mutation error is rendered below the form.
    }
  }

  return (
    <Modal title="Create job" description="Create a job card and add it to the workshop pipeline." onClose={onClose}>
      <form className="create-form" onSubmit={submit}>
        <label>
          Customer
          <select required autoFocus value={form.customerId} onChange={(event) => setForm({ ...form, customerId: event.target.value })}>
            {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}{customer.phone ? ` - ${customer.phone}` : ""}</option>)}
            <option value="new">+ New customer</option>
          </select>
        </label>
        {isNewCustomer && (
          <div className="form-grid">
            <label>
              New customer name
              <input required value={form.customerName} onChange={(event) => setForm({ ...form, customerName: event.target.value })} placeholder="Customer or company name" />
            </label>
            <label>
              Phone
              <input type="tel" value={form.customerPhone} onChange={(event) => setForm({ ...form, customerPhone: event.target.value })} placeholder="Phone number" />
            </label>
          </div>
        )}
        <label>
          Job description
          <textarea required rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Describe the work required" />
        </label>
        <div className="form-grid">
          <label>
            Quantity
            <input required type="number" min="1" step="any" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} />
          </label>
          <label>
            Condition
            <select value={form.condition} onChange={(event) => setForm({ ...form, condition: event.target.value as JobCondition })}>
              {jobConditions.map((condition) => <option key={condition.value} value={condition.value}>{condition.label}</option>)}
            </select>
          </label>
        </div>
        <div className="form-grid">
          <label>
            Date received
            <input required type="date" value={form.dateReceived} onChange={(event) => setForm({ ...form, dateReceived: event.target.value })} />
          </label>
          <label>
            Priority
            <select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value as JobPriority })}>
              <option value="normal">Normal</option>
              <option value="urgent">Urgent</option>
            </select>
          </label>
        </div>
        <label>
          Intake notes
          <textarea rows={3} value={form.intakeNotes} onChange={(event) => setForm({ ...form, intakeNotes: event.target.value })} placeholder="Optional notes recorded at intake" />
        </label>
        {createJob.error && <p className="form-message form-message-error">{createJob.error.message}</p>}
        <FormActions pending={createJob.isPending} submitLabel="Create job" onClose={onClose} />
      </form>
    </Modal>
  );
}

function AddCustomerModal({ onClose }: { onClose: () => void }) {
  const createCustomer = useCreateCustomer();
  const [form, setForm] = useState({ name: "", phone: "", location: "", notes: "" });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await createCustomer.mutateAsync({
        name: form.name.trim(),
        phone: form.phone.trim(),
        location: form.location.trim() || undefined,
        notes: form.notes.trim() || undefined,
      });
      onClose();
    } catch {
      // The mutation error is rendered below the form.
    }
  }

  return (
    <Modal title="Add customer" description="Create a customer record for jobs and collections." onClose={onClose}>
      <form className="create-form" onSubmit={submit}>
        <label>
          Customer name
          <input required autoFocus value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Customer or company name" />
        </label>
        <div className="form-grid">
          <label>
            Phone
            <input type="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="Phone number" />
          </label>
          <label>
            Location
            <input value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} placeholder="Town or area" />
          </label>
        </div>
        <label>
          Notes
          <textarea rows={3} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Optional customer notes" />
        </label>
        {createCustomer.error && <p className="form-message form-message-error">{createCustomer.error.message}</p>}
        <FormActions pending={createCustomer.isPending} submitLabel="Add customer" onClose={onClose} />
      </form>
    </Modal>
  );
}

function AddStockModal({ onClose }: { onClose: () => void }) {
  const createStock = useCreateStock();
  const [form, setForm] = useState({
    name: "",
    category: "lining_material" as StockCategory,
    unit: "sets",
    currentQty: "0",
    minThreshold: "0",
    supplier: "",
    notes: "",
  });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await createStock.mutateAsync({
        name: form.name.trim(),
        category: form.category,
        unit: form.unit.trim(),
        currentQty: Number(form.currentQty),
        minThreshold: Number(form.minThreshold),
        supplier: form.supplier.trim() || undefined,
        notes: form.notes.trim() || undefined,
      });
      onClose();
    } catch {
      // The mutation error is rendered below the form.
    }
  }

  return (
    <Modal title="Add stock item" description="Create an inventory item and record its opening quantity." onClose={onClose}>
      <form className="create-form" onSubmit={submit}>
        <label>
          Item name
          <input required autoFocus value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Stock item name" />
        </label>
        <div className="form-grid">
          <label>
            Category
            <select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value as StockCategory })}>
              {stockCategories.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}
            </select>
          </label>
          <label>
            Unit
            <input required value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })} placeholder="sets, pieces, litres..." />
          </label>
        </div>
        <div className="form-grid">
          <label>
            Opening quantity
            <input required type="number" min="0" step="any" value={form.currentQty} onChange={(event) => setForm({ ...form, currentQty: event.target.value })} />
          </label>
          <label>
            Low stock threshold
            <input required type="number" min="0" step="any" value={form.minThreshold} onChange={(event) => setForm({ ...form, minThreshold: event.target.value })} />
          </label>
        </div>
        <label>
          Supplier
          <input value={form.supplier} onChange={(event) => setForm({ ...form, supplier: event.target.value })} placeholder="Optional supplier" />
        </label>
        <label>
          Notes
          <textarea rows={3} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Optional stock notes" />
        </label>
        {createStock.error && <p className="form-message form-message-error">{createStock.error.message}</p>}
        <FormActions pending={createStock.isPending} submitLabel="Add stock item" onClose={onClose} />
      </form>
    </Modal>
  );
}

function Modal({
  title, description, children, onClose,
}: { title: string; description: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className="modal-heading">
          <div><p className="eyebrow">New record</p><h2 id="modal-title">{title}</h2><p>{description}</p></div>
          <button type="button" className="modal-close" aria-label="Close" onClick={onClose}>&times;</button>
        </div>
        {children}
      </section>
    </div>
  );
}

function FormActions({
  pending, submitLabel, onClose,
}: { pending: boolean; submitLabel: string; onClose: () => void }) {
  return (
    <div className="form-actions">
      <button type="button" className="button button-secondary" onClick={onClose} disabled={pending}>Cancel</button>
      <button type="submit" className="button button-primary" disabled={pending}>{pending ? "Saving..." : submitLabel}</button>
    </div>
  );
}

import { useState, type ComponentType, type FormEvent, type ReactNode } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  BookOpenIcon,
  FileTextIcon,
  LineChartIcon,
  ListChecksIcon,
  ReceiptTextIcon,
} from "lucide-react";
import { AccountTree } from "@/components/accounting/AccountTree";
import { useAuth } from "@/components/providers/auth";
import {
  useAccountTree,
  useAccountingAccounts,
  useAccountingBills,
  useAccountingEntries,
  useAccountingExpenses,
  useAccountingInvoices,
  useAccountingPayments,
  useAccountingSuppliers,
  useBalanceSheet,
  useCreateSupplier,
  useCustomers,
  useCustomerLedger,
  useGeneralLedger,
  useParentAccountOptions,
  usePostBill,
  usePostExpense,
  usePostInvoice,
  usePostJournal,
  useProfitAndLoss,
  useRecordAccountingPayment,
  useSeedChartOfAccounts,
  useSupplierLedger,
  useTrialBalance,
} from "@/lib/api";
import type { AccountTreeGroup, ParentAccountOption } from "@/lib/api";
import type { ChartAccount, Customer, Supplier } from "@/lib/supabase";

type View = "overview" | "chart" | "journal" | "transactions" | "ledger" | "ledgers" | "reports";

const navItems: { view: View; label: string; href: string; icon: ComponentType<{ className?: string }> }[] = [
  { view: "chart", label: "Account Tree", href: "/accounting", icon: ListChecksIcon },
  { view: "transactions", label: "Transactions", href: "/accounting/transactions", icon: ReceiptTextIcon },
  { view: "journal", label: "Journal", href: "/accounting/journal", icon: BookOpenIcon },
  { view: "ledger", label: "General Ledger", href: "/accounting/ledger", icon: FileTextIcon },
  { view: "ledgers", label: "Ledgers", href: "/accounting/ledgers", icon: FileTextIcon },
  { view: "reports", label: "Reports", href: "/accounting/reports", icon: LineChartIcon },
];

function viewFromPath(pathname: string): View {
  if (pathname.includes("/overview")) return "overview";
  if (pathname.includes("/chart")) return "chart";
  if (pathname.includes("/transactions") || pathname.includes("/invoices") || pathname.includes("/payments") || pathname.includes("/expenses")) return "transactions";
  if (pathname.includes("/ledgers") || pathname.includes("/debtors") || pathname.includes("/creditors")) return "ledgers";
  if (pathname.includes("/ledger")) return "ledger";
  if (pathname.includes("/journal")) return "journal";
  if (pathname.includes("/reports") || pathname.includes("/trial-balance") || pathname.includes("/profit-loss") || pathname.includes("/balance-sheet")) return "reports";
  return "chart";
}

function money(value: number) {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function localDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function parseAmount(value: string) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) throw new Error("Enter a positive amount");
  return n;
}

export default function AccountingPage() {
  const { appUser, organization } = useAuth();
  const { pathname } = useLocation();
  const view = viewFromPath(pathname);

  const accounts = useAccountingAccounts();
  const accountTree = useAccountTree(view === "chart");
  const parentOptions = useParentAccountOptions(view === "chart");
  const overviewView = view === "overview";
  const trial = useTrialBalance(undefined, overviewView);
  const pl = useProfitAndLoss(undefined, overviewView);
  const balance = useBalanceSheet(undefined, overviewView);
  const customerLedger = useCustomerLedger(overviewView);
  const supplierLedger = useSupplierLedger(overviewView);
  const seedChart = useSeedChartOfAccounts();

  const hasAccounts = (accounts.data?.length ?? 0) > 0;
  const isLoading =
    accounts.isLoading ||
    (view === "chart" && (accountTree.isLoading || parentOptions.isLoading)) ||
    (overviewView && (trial.isLoading || pl.isLoading || balance.isLoading));
  const error =
    accounts.error ||
    (view === "chart" ? accountTree.error || parentOptions.error : null) ||
    (overviewView ? trial.error || pl.error || balance.error : null);

  const handleSeed = async () => {
    try {
      const result = await seedChart.mutateAsync();
      toast.success(`Chart ready. ${result?.created ?? 0} accounts added.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not seed chart of accounts");
    }
  };

  if (!appUser) return <div className="panel-state">Loading accounting...</div>;

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">{organization?.name ?? "Workshop"}</p>
          <h1>Accounting</h1>
        </div>
        <div className="header-actions">
          <span className="live-indicator">Double-entry ledger</span>
        </div>
      </header>

      <AccountingNav view={view} />

      {error && <div className="error-banner">Could not load accounting data: {error.message}</div>}
      {isLoading && <div className="panel-state"><div className="loader" />Loading accounting...</div>}

      {!isLoading && !error && !hasAccounts && (
        <div className="card" style={{ padding: 24, marginTop: 16 }}>
          <p className="eyebrow">First run</p>
          <h2 style={{ margin: "0 0 8px" }}>Set up the chart of accounts</h2>
          <p style={{ margin: "0 0 18px", color: "#657c76", fontSize: 13 }}>
            Seed the standard accounts, or expand any heading below and add accounts manually.
          </p>
          <button type="button" className="add-button" onClick={handleSeed} disabled={seedChart.isPending}>
            {seedChart.isPending ? "Setting up..." : "Set up chart of accounts"}
          </button>
        </div>
      )}

      {!isLoading && !error && view === "chart" && (
        <ChartView
          groups={accountTree.data ?? []}
          parents={parentOptions.data ?? []}
          onSeed={handleSeed}
          seedPending={seedChart.isPending}
        />
      )}
      {!isLoading && !error && hasAccounts && view === "overview" && (
        <Overview
          totalDebit={trial.data?.totalDebit ?? 0}
          totalCredit={trial.data?.totalCredit ?? 0}
          netProfit={pl.data?.netProfit ?? 0}
          totalAssets={balance.data?.totalAssets ?? 0}
          receivables={customerLedger.data?.totalOutstanding ?? 0}
          payables={supplierLedger.data?.totalOutstanding ?? 0}
        />
      )}
      {!isLoading && !error && hasAccounts && view === "journal" && (
        <JournalView accounts={accounts.data ?? []} />
      )}
      {!isLoading && !error && hasAccounts && view === "transactions" && (
        <TransactionsView accounts={accounts.data ?? []} />
      )}
      {!isLoading && !error && hasAccounts && view === "ledger" && <GeneralLedgerView />}
      {!isLoading && !error && hasAccounts && view === "ledgers" && <LedgersView />}
      {!isLoading && !error && hasAccounts && view === "reports" && <ReportsView />}
    </div>
  );
}

function AccountingNav({ view }: { view: View }) {
  return (
    <div className="account-tools">
      {navItems.map((item) => (
        <Link
          key={item.view}
          to={item.href}
          className={view === item.view ? "add-button" : "button button-secondary"}
          style={{ minHeight: 35, display: "inline-flex", alignItems: "center", gap: 8, textDecoration: "none" }}
        >
          <item.icon className="size-4" />
          {item.label}
        </Link>
      ))}
    </div>
  );
}

function Overview({
  totalDebit,
  totalCredit,
  netProfit,
  totalAssets,
  receivables,
  payables,
}: {
  totalDebit: number;
  totalCredit: number;
  netProfit: number;
  totalAssets: number;
  receivables: number;
  payables: number;
}) {
  return (
    <>
      <section className="metric-grid">
        <Metric label="Trial balance" value={money(totalDebit)} detail={Math.abs(totalDebit - totalCredit) < 0.01 ? "Balanced" : "Out of balance"} tone="green" />
        <Metric label="Net profit" value={money(netProfit)} detail="Current posted ledger" tone="blue" />
        <Metric label="Assets" value={money(totalAssets)} detail="As of today" tone="orange" />
        <Metric label="Receivables" value={money(receivables)} detail={`Payables ${money(payables)}`} tone="red" />
      </section>

      <section className="dashboard-grid">
        <div className="card">
          <div className="card-heading"><div><p className="eyebrow">Workflow</p><h2>Post daily activity</h2></div></div>
          <div className="attention-list">
            <LinkRow href="/accounting/transactions" title="Record transactions" text="Invoices, bills, expenses, and payments" />
            <LinkRow href="/accounting/journal" title="Manual journal" text="Post balanced debit and credit lines" />
            <LinkRow href="/accounting/reports" title="Financial reports" text="Trial balance, profit and loss, balance sheet" />
          </div>
        </div>
        <div className="card">
          <div className="card-heading"><div><p className="eyebrow">Controls</p><h2>Accounting setup</h2></div></div>
          <div className="attention-list">
            <LinkRow href="/accounting/chart" title="Chart of accounts" text="Manage ledger accounts and bank accounts" />
            <LinkRow href="/accounting/ledgers" title="Customer and supplier ledgers" text="Track debtors and creditors" />
          </div>
        </div>
      </section>
    </>
  );
}

function LinkRow({ href, title, text }: { href: string; title: string; text: string }) {
  return (
    <Link to={href} style={{ color: "inherit", textDecoration: "none", display: "flex", alignItems: "center", gap: 10, padding: "12px 0", borderTop: "1px solid #edf1ee" }}>
      <span className="stock-signal" />
      <div><strong>{title}</strong><small>{text}</small></div>
      <em>Open</em>
    </Link>
  );
}

function Metric({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: "green" | "blue" | "orange" | "red" }) {
  return (
    <div className={`metric metric-${tone}`}>
      <span>{label}</span>
      <strong style={{ fontSize: 24, letterSpacing: -1 }}>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function ChartView({
  groups,
  parents,
  onSeed,
  seedPending,
}: {
  groups: AccountTreeGroup[];
  parents: ParentAccountOption[];
  onSeed: () => void;
  seedPending: boolean;
}) {
  const accountCount = groups.reduce((sum, group) => sum + group.accounts.length, 0);

  return (
    <>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Chart of accounts</p>
          <h2>{accountCount} accounts in statement structure</h2>
        </div>
        <button type="button" className="add-button" onClick={onSeed} disabled={seedPending}>
          {seedPending ? "Loading..." : "Load standard accounts"}
        </button>
      </div>
      <AccountTree groups={groups} parents={parents} />
    </>
  );
}

function JournalView({ accounts }: { accounts: ChartAccount[] }) {
  const entries = useAccountingEntries();
  return (
    <>
      <ManualJournalForm accounts={accounts.filter((a) => a.is_active)} />
      <DataTable title="Recent journal entries" columns={["Date", "Entry", "Memo", "Source", "Debit", "Credit"]}>
        {(entries.data ?? []).slice(0, 30).map((entry) => (
          <tr key={entry.id}>
            <td>{new Date(entry.date).toLocaleDateString()}</td>
            <td><strong>{entry.entry_number}</strong></td>
            <td>{entry.memo ?? "-"}</td>
            <td>{entry.source}</td>
            <td>{money(Number(entry.total_debit))}</td>
            <td>{money(Number(entry.total_credit))}</td>
          </tr>
        ))}
      </DataTable>
    </>
  );
}

function ManualJournalForm({ accounts }: { accounts: ChartAccount[] }) {
  const postJournal = usePostJournal();
  const [date, setDate] = useState(localDate());
  const [memo, setMemo] = useState("");
  const [lines, setLines] = useState([
    { accountId: "", debit: "", credit: "", description: "" },
    { accountId: "", debit: "", credit: "", description: "" },
  ]);
  const totalDebit = lines.reduce((sum, line) => sum + Number(line.debit || 0), 0);
  const totalCredit = lines.reduce((sum, line) => sum + Number(line.credit || 0), 0);

  const updateLine = (index: number, patch: Partial<(typeof lines)[number]>) => {
    setLines((current) => current.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const result = await postJournal.mutateAsync({
        date,
        memo,
        lines: lines.map((line) => ({
          accountId: line.accountId,
          debit: Number(line.debit || 0),
          credit: Number(line.credit || 0),
          description: line.description,
        })),
      });
      toast.success(`Posted ${result.entryNumber ?? result.entry_number}`);
      setMemo("");
      setLines([{ accountId: "", debit: "", credit: "", description: "" }, { accountId: "", debit: "", credit: "", description: "" }]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not post journal");
    }
  };

  return (
    <form className="card create-form" style={{ padding: 18, marginBottom: 16 }} onSubmit={submit}>
      <div className="section-heading" style={{ marginBottom: 0 }}>
        <div><p className="eyebrow">Manual journal</p><h2>Balanced entry</h2></div>
        <span className={Math.abs(totalDebit - totalCredit) < 0.01 ? "status status-done" : "status status-qc"}>
          Dr {money(totalDebit)} / Cr {money(totalCredit)}
        </span>
      </div>
      <div className="form-grid">
        <label>Date<input type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></label>
        <label>Memo<input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="Opening balance" /></label>
      </div>
      {lines.map((line, index) => (
        <div className="form-grid" key={index}>
          <label>Account
            <select value={line.accountId} onChange={(e) => updateLine(index, { accountId: e.target.value })} required>
              <option value="">Select account</option>
              {accounts.map((account) => <option key={account.id} value={account.id}>{account.code} - {account.name}</option>)}
            </select>
          </label>
          <label>Description<input value={line.description} onChange={(e) => updateLine(index, { description: e.target.value })} /></label>
          <label>Debit<input type="number" min="0" step="0.01" value={line.debit} onChange={(e) => updateLine(index, { debit: e.target.value, credit: e.target.value ? "" : line.credit })} /></label>
          <label>Credit<input type="number" min="0" step="0.01" value={line.credit} onChange={(e) => updateLine(index, { credit: e.target.value, debit: e.target.value ? "" : line.debit })} /></label>
        </div>
      ))}
      <div className="form-actions">
        <button type="button" className="button button-secondary" onClick={() => setLines((current) => [...current, { accountId: "", debit: "", credit: "", description: "" }])}>Add line</button>
        <button type="submit" className="button button-primary" disabled={postJournal.isPending || Math.abs(totalDebit - totalCredit) >= 0.01}>Post journal</button>
      </div>
    </form>
  );
}

function TransactionsView({ accounts }: { accounts: ChartAccount[] }) {
  const [tab, setTab] = useState<"invoice" | "payment" | "expense" | "bill">("invoice");
  const customers = useCustomers();
  const suppliers = useAccountingSuppliers();
  const invoices = useAccountingInvoices();
  const bills = useAccountingBills();
  const expenses = useAccountingExpenses();
  const payments = useAccountingPayments();
  const activeAccounts = accounts.filter((a) => a.is_active);
  const bankAccounts = activeAccounts.filter((a) => a.is_bank || a.description === "key:cash_on_hand");
  const expenseAccounts = activeAccounts.filter((a) => a.type === "EXPENSE" || a.type === "ASSET");

  return (
    <>
      <div className="card" style={{ padding: 8, display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
        {(["invoice", "payment", "expense", "bill"] as const).map((item) => (
          <button key={item} type="button" className={tab === item ? "add-button" : "button button-secondary"} onClick={() => setTab(item)}>
            {item[0].toUpperCase() + item.slice(1)}
          </button>
        ))}
      </div>
      {tab === "invoice" && <InvoiceForm customers={customers.data ?? []} />}
      {tab === "payment" && (
        <PaymentForm
          customers={customers.data ?? []}
          suppliers={suppliers.data ?? []}
          invoices={invoices.data ?? []}
          bills={bills.data ?? []}
          bankAccounts={bankAccounts}
        />
      )}
      {tab === "expense" && <ExpenseForm accounts={expenseAccounts} bankAccounts={bankAccounts} suppliers={suppliers.data ?? []} />}
      {tab === "bill" && <BillForm accounts={expenseAccounts} suppliers={suppliers.data ?? []} />}
      <SupplierForm />
      <DataTable title="Recent accounting documents" columns={["Type", "Number", "Party", "Date", "Amount", "Status"]}>
        {(invoices.data ?? []).slice(0, 8).map((invoice) => (
          <tr key={invoice.id}><td>Invoice</td><td><strong>{invoice.invoice_number}</strong></td><td>{invoice.customer?.name ?? "-"}</td><td>{new Date(invoice.date).toLocaleDateString()}</td><td>{money(Number(invoice.total_amount))}</td><td>{invoice.status}</td></tr>
        ))}
        {(bills.data ?? []).slice(0, 8).map((bill) => (
          <tr key={bill.id}><td>Bill</td><td><strong>{bill.bill_number}</strong></td><td>{bill.supplier?.name ?? "-"}</td><td>{new Date(bill.date).toLocaleDateString()}</td><td>{money(Number(bill.total_amount))}</td><td>{bill.status}</td></tr>
        ))}
        {(expenses.data ?? []).slice(0, 8).map((expense) => (
          <tr key={expense.id}><td>Expense</td><td><strong>{expense.expense_number}</strong></td><td>{expense.supplier?.name ?? expense.vendor_name ?? "-"}</td><td>{new Date(expense.date).toLocaleDateString()}</td><td>{money(Number(expense.total_amount))}</td><td>paid</td></tr>
        ))}
        {(payments.data ?? []).slice(0, 8).map((payment) => (
          <tr key={payment.id}><td>Payment</td><td><strong>{payment.payment_number}</strong></td><td>{payment.customer?.name ?? payment.supplier?.name ?? "-"}</td><td>{new Date(payment.date).toLocaleDateString()}</td><td>{money(Number(payment.amount))}</td><td>{payment.direction}</td></tr>
        ))}
      </DataTable>
    </>
  );
}

function InvoiceForm({ customers }: { customers: Customer[] }) {
  const postInvoice = usePostInvoice();
  const [customerId, setCustomerId] = useState("");
  const [date, setDate] = useState(localDate());
  const [dueDate, setDueDate] = useState("");
  const [amount, setAmount] = useState("");
  const [hasVat, setHasVat] = useState(true);
  const [memo, setMemo] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const result = await postInvoice.mutateAsync({ customerId, date, dueDate: dueDate || null, amount: parseAmount(amount), hasVat, memo });
      toast.success(`Posted invoice ${result.invoiceNumber}`);
      setAmount("");
      setMemo("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not post invoice");
    }
  };

  return (
    <AccountingForm title="Sales invoice" onSubmit={submit} pending={postInvoice.isPending} submitLabel="Post invoice">
      <label>Customer<SelectCustomer value={customerId} setValue={setCustomerId} customers={customers} /></label>
      <label>Date<input type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></label>
      <label>Due date<input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></label>
      <label>Amount<input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required /></label>
      <VatCheckbox checked={hasVat} setChecked={setHasVat} />
      <label>Memo<input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="Invoice details" /></label>
    </AccountingForm>
  );
}

function BillForm({ accounts, suppliers }: { accounts: ChartAccount[]; suppliers: Supplier[] }) {
  const postBill = usePostBill();
  const [supplierId, setSupplierId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [date, setDate] = useState(localDate());
  const [dueDate, setDueDate] = useState("");
  const [amount, setAmount] = useState("");
  const [hasVat, setHasVat] = useState(true);
  const [memo, setMemo] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const result = await postBill.mutateAsync({ supplierId, accountId, date, dueDate: dueDate || null, amount: parseAmount(amount), hasVat, memo });
      toast.success(`Posted bill ${result.billNumber}`);
      setAmount("");
      setMemo("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not post bill");
    }
  };

  return (
    <AccountingForm title="Supplier bill" onSubmit={submit} pending={postBill.isPending} submitLabel="Post bill">
      <label>Supplier<SelectSupplier value={supplierId} setValue={setSupplierId} suppliers={suppliers} /></label>
      <label>Expense or asset account<SelectAccount value={accountId} setValue={setAccountId} accounts={accounts} /></label>
      <label>Date<input type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></label>
      <label>Due date<input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></label>
      <label>Amount<input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required /></label>
      <VatCheckbox checked={hasVat} setChecked={setHasVat} />
      <label>Memo<input value={memo} onChange={(e) => setMemo(e.target.value)} /></label>
    </AccountingForm>
  );
}

function ExpenseForm({ accounts, bankAccounts, suppliers }: { accounts: ChartAccount[]; bankAccounts: ChartAccount[]; suppliers: Supplier[] }) {
  const postExpense = usePostExpense();
  const [accountId, setAccountId] = useState("");
  const [bankId, setBankId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [vendorName, setVendorName] = useState("");
  const [date, setDate] = useState(localDate());
  const [amount, setAmount] = useState("");
  const [hasVat, setHasVat] = useState(false);
  const [memo, setMemo] = useState("");
  const [reference, setReference] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const result = await postExpense.mutateAsync({
        expenseAccountId: accountId,
        bankAccountId: bankId || null,
        supplierId: supplierId || null,
        vendorName,
        date,
        amount: parseAmount(amount),
        hasVat,
        memo,
        reference,
      });
      toast.success(`Posted expense ${result.expenseNumber}`);
      setAmount("");
      setMemo("");
      setReference("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not post expense");
    }
  };

  return (
    <AccountingForm title="Paid expense" onSubmit={submit} pending={postExpense.isPending} submitLabel="Post expense">
      <label>Expense or asset account<SelectAccount value={accountId} setValue={setAccountId} accounts={accounts} /></label>
      <label>Paid from<SelectAccount value={bankId} setValue={setBankId} accounts={bankAccounts} placeholder="Cash on Hand" /></label>
      <label>Supplier<SelectSupplier value={supplierId} setValue={setSupplierId} suppliers={suppliers} optional /></label>
      <label>Vendor name<input value={vendorName} onChange={(e) => setVendorName(e.target.value)} placeholder="Optional" /></label>
      <label>Date<input type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></label>
      <label>Amount<input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required /></label>
      <VatCheckbox checked={hasVat} setChecked={setHasVat} />
      <label>Reference<input value={reference} onChange={(e) => setReference(e.target.value)} /></label>
      <label>Memo<input value={memo} onChange={(e) => setMemo(e.target.value)} /></label>
    </AccountingForm>
  );
}

function PaymentForm({
  customers,
  suppliers,
  invoices,
  bills,
  bankAccounts,
}: {
  customers: Customer[];
  suppliers: Supplier[];
  invoices: { id: string; invoice_number: string; customer_id: string; total_amount: number; status: string }[];
  bills: { id: string; bill_number: string; supplier_id: string; total_amount: number; status: string }[];
  bankAccounts: ChartAccount[];
}) {
  const recordPayment = useRecordAccountingPayment();
  const [direction, setDirection] = useState<"received" | "paid">("received");
  const [customerId, setCustomerId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [invoiceId, setInvoiceId] = useState("");
  const [billId, setBillId] = useState("");
  const [bankId, setBankId] = useState("");
  const [date, setDate] = useState(localDate());
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const result = await recordPayment.mutateAsync({
        direction,
        customerId: direction === "received" ? customerId || null : null,
        supplierId: direction === "paid" ? supplierId || null : null,
        invoiceId: direction === "received" ? invoiceId || null : null,
        billId: direction === "paid" ? billId || null : null,
        bankAccountId: bankId || null,
        date,
        amount: parseAmount(amount),
        reference,
        notes,
      });
      toast.success(`Recorded ${result.paymentNumber}`);
      setAmount("");
      setReference("");
      setNotes("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not record payment");
    }
  };

  const openInvoices = invoices.filter((i) => i.status !== "paid");
  const openBills = bills.filter((b) => b.status !== "paid");

  return (
    <AccountingForm title="Payment" onSubmit={submit} pending={recordPayment.isPending} submitLabel="Record payment">
      <label>Direction
        <select value={direction} onChange={(e) => setDirection(e.target.value as "received" | "paid")}>
          <option value="received">Money in from customer</option>
          <option value="paid">Money out to supplier</option>
        </select>
      </label>
      {direction === "received" ? (
        <>
          <label>Customer<SelectCustomer value={customerId} setValue={setCustomerId} customers={customers} /></label>
          <label>Invoice
            <select value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)}>
              <option value="">Optional invoice</option>
              {openInvoices.map((invoice) => <option key={invoice.id} value={invoice.id}>{invoice.invoice_number} - {money(Number(invoice.total_amount))}</option>)}
            </select>
          </label>
        </>
      ) : (
        <>
          <label>Supplier<SelectSupplier value={supplierId} setValue={setSupplierId} suppliers={suppliers} /></label>
          <label>Bill
            <select value={billId} onChange={(e) => setBillId(e.target.value)}>
              <option value="">Optional bill</option>
              {openBills.map((bill) => <option key={bill.id} value={bill.id}>{bill.bill_number} - {money(Number(bill.total_amount))}</option>)}
            </select>
          </label>
        </>
      )}
      <label>Cash or bank<SelectAccount value={bankId} setValue={setBankId} accounts={bankAccounts} placeholder="Cash on Hand" /></label>
      <label>Date<input type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></label>
      <label>Amount<input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required /></label>
      <label>Reference<input value={reference} onChange={(e) => setReference(e.target.value)} /></label>
      <label>Notes<input value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
    </AccountingForm>
  );
}

function SupplierForm() {
  const createSupplier = useCreateSupplier();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await createSupplier.mutateAsync({ name, phone });
      toast.success("Supplier added");
      setName("");
      setPhone("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add supplier");
    }
  };

  return (
    <form className="card create-form" style={{ padding: 18, marginBottom: 16 }} onSubmit={submit}>
      <div className="section-heading" style={{ marginBottom: 0 }}><div><p className="eyebrow">Supplier setup</p><h2>Add supplier</h2></div></div>
      <div className="form-grid">
        <label>Name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Supplier name" required /></label>
        <label>Phone<input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Optional" /></label>
      </div>
      <div className="form-actions"><button type="submit" className="button button-secondary" disabled={createSupplier.isPending}>Add supplier</button></div>
    </form>
  );
}

function AccountingForm({
  title,
  children,
  onSubmit,
  pending,
  submitLabel,
}: {
  title: string;
  children: ReactNode;
  onSubmit: (event: FormEvent) => void;
  pending: boolean;
  submitLabel: string;
}) {
  return (
    <form className="card create-form" style={{ padding: 18, marginBottom: 16 }} onSubmit={onSubmit}>
      <div className="section-heading" style={{ marginBottom: 0 }}><div><p className="eyebrow">Transaction</p><h2>{title}</h2></div></div>
      <div className="form-grid">{children}</div>
      <div className="form-actions"><button type="submit" className="button button-primary" disabled={pending}>{pending ? "Posting..." : submitLabel}</button></div>
    </form>
  );
}

function SelectAccount({ value, setValue, accounts, placeholder = "Select account" }: { value: string; setValue: (v: string) => void; accounts: ChartAccount[]; placeholder?: string }) {
  return (
    <select value={value} onChange={(e) => setValue(e.target.value)} required={placeholder === "Select account"}>
      <option value="">{placeholder}</option>
      {accounts.map((account) => <option key={account.id} value={account.id}>{account.code} - {account.name}</option>)}
    </select>
  );
}

function SelectCustomer({ value, setValue, customers }: { value: string; setValue: (v: string) => void; customers: Customer[] }) {
  return (
    <select value={value} onChange={(e) => setValue(e.target.value)} required>
      <option value="">Select customer</option>
      {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
    </select>
  );
}

function SelectSupplier({ value, setValue, suppliers, optional }: { value: string; setValue: (v: string) => void; suppliers: Supplier[]; optional?: boolean }) {
  return (
    <select value={value} onChange={(e) => setValue(e.target.value)} required={!optional}>
      <option value="">{optional ? "Optional supplier" : "Select supplier"}</option>
      {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
    </select>
  );
}

function VatCheckbox({ checked, setChecked }: { checked: boolean; setChecked: (v: boolean) => void }) {
  return (
    <label style={{ alignContent: "end" }}>
      <span><input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} style={{ width: "auto", marginRight: 8 }} /> Includes 16% VAT</span>
    </label>
  );
}

function GeneralLedgerView() {
  const [searchParams, setSearchParams] = useSearchParams();
  const accountId = searchParams.get("account") ?? "";
  const ledger = useGeneralLedger({ accountId: accountId || undefined });

  const setAccountId = (nextAccountId: string) => {
    const next = new URLSearchParams(searchParams);
    if (nextAccountId) next.set("account", nextAccountId);
    else next.delete("account");
    setSearchParams(next);
  };

  return (
    <>
      <form className="card create-form" style={{ padding: 18, marginBottom: 16 }}>
        <div className="section-heading" style={{ marginBottom: 0 }}>
          <div>
            <p className="eyebrow">General ledger</p>
            <h2>{ledger.data?.account?.name ?? "Account report"}</h2>
          </div>
          {ledger.data?.account && (
            <span className="status">
              Opening {money(ledger.data.openingBalance)}
            </span>
          )}
        </div>
        <div className="form-grid">
          <label>
            Account
            <select value={accountId} onChange={(event) => setAccountId(event.target.value)}>
              <option value="">Select account</option>
              {(ledger.data?.accounts ?? []).map((account) => (
                <option key={account.id} value={account.id}>
                  {account.code} - {account.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </form>

      {ledger.error && <div className="error-banner">Could not load ledger: {ledger.error.message}</div>}
      {ledger.isLoading && <div className="panel-state"><div className="loader" />Loading ledger...</div>}

      {!ledger.isLoading && !ledger.error && (
        <DataTable title="Account entries" columns={["Date", "Entry", "Memo", "Source", "Debit", "Credit", "Balance"]}>
          {(ledger.data?.lines ?? []).map((line, index) => (
            <tr key={`${line.entryNumber}-${index}`}>
              <td>{new Date(line.date).toLocaleDateString()}</td>
              <td><strong>{line.entryNumber}</strong><small>{line.description ?? ""}</small></td>
              <td>{line.memo ?? "-"}</td>
              <td>{line.source}</td>
              <td>{money(line.debit)}</td>
              <td>{money(line.credit)}</td>
              <td>{money(line.balance)}</td>
            </tr>
          ))}
          {(ledger.data?.lines ?? []).length === 0 && (
            <tr>
              <td colSpan={7}>{accountId ? "No posted entries for this account yet." : "Select an account to view its ledger."}</td>
            </tr>
          )}
        </DataTable>
      )}
    </>
  );
}

function LedgersView() {
  const customers = useCustomerLedger();
  const suppliers = useSupplierLedger();
  return (
    <section className="dashboard-grid">
      <LedgerTable title={`Customer ledger - ${money(customers.data?.totalOutstanding ?? 0)} outstanding`} rows={customers.data?.rows ?? []} empty="No customer balances yet." />
      <LedgerTable title={`Supplier ledger - ${money(suppliers.data?.totalOutstanding ?? 0)} outstanding`} rows={suppliers.data?.rows ?? []} empty="No supplier balances yet." />
    </section>
  );
}

function LedgerTable({ title, rows, empty }: { title: string; rows: { id: string; name: string; billed: number; paid: number; outstanding: number }[]; empty: string }) {
  return (
    <DataTable title={title} columns={["Party", "Billed", "Paid", "Outstanding"]}>
      {rows.map((row) => (
        <tr key={row.id}><td><strong>{row.name}</strong></td><td>{money(row.billed)}</td><td>{money(row.paid)}</td><td className={row.outstanding > 0 ? "danger-text" : ""}>{money(row.outstanding)}</td></tr>
      ))}
      {rows.length === 0 && <tr><td colSpan={4}>{empty}</td></tr>}
    </DataTable>
  );
}

function ReportsView() {
  const trial = useTrialBalance();
  const pl = useProfitAndLoss();
  const balance = useBalanceSheet();
  const isLoading = trial.isLoading || pl.isLoading || balance.isLoading;
  const error = trial.error || pl.error || balance.error;

  if (isLoading) return <div className="panel-state"><div className="loader" />Loading reports...</div>;
  if (error) return <div className="error-banner">Could not load reports: {error.message}</div>;

  return (
    <>
      <section className="metric-grid">
        <Metric label="Trial balance" value={trial.data?.balanced ? "Balanced" : "Check"} detail={`${money(trial.data?.totalDebit ?? 0)} debits`} tone="green" />
        <Metric label="Revenue" value={money(pl.data?.totalIncome ?? 0)} detail={`Gross profit ${money(pl.data?.grossProfit ?? 0)}`} tone="blue" />
        <Metric label="Net profit" value={money(pl.data?.netProfit ?? 0)} detail={`${pl.data?.netMargin ?? 0}% net margin`} tone="orange" />
        <Metric label="Balance sheet" value={balance.data?.balanced ? "Balanced" : "Check"} detail={`Assets ${money(balance.data?.totalAssets ?? 0)}`} tone="red" />
      </section>
      <DataTable title="Trial balance" columns={["Account", "Type", "Debit", "Credit"]}>
        {(trial.data?.rows ?? []).map((row) => <tr key={row.accountId}><td><strong>{row.code}</strong><small>{row.name}</small></td><td>{row.type}</td><td>{money(row.debit)}</td><td>{money(row.credit)}</td></tr>)}
      </DataTable>
      <section className="dashboard-grid">
        <ReportBlock title="Profit and loss" rows={[...(pl.data?.income ?? []), ...(pl.data?.expenses ?? [])]} totalLabel="Net profit" total={pl.data?.netProfit ?? 0} />
        <ReportBlock title="Balance sheet" rows={[...(balance.data?.assets ?? []), ...(balance.data?.liabilities ?? []), ...(balance.data?.equity ?? [])]} totalLabel="Assets" total={balance.data?.totalAssets ?? 0} />
      </section>
    </>
  );
}

function ReportBlock({ title, rows, totalLabel, total }: { title: string; rows: { code: string; name: string; amount: number }[]; totalLabel: string; total: number }) {
  return (
    <div className="card table-card">
      <div className="card-heading"><div><p className="eyebrow">Report</p><h2>{title}</h2></div><span>{totalLabel}: {money(total)}</span></div>
      <div className="table-scroll">
        <table><tbody>{rows.map((row, i) => <tr key={`${row.code}-${i}`}><td><strong>{row.code}</strong><small>{row.name}</small></td><td>{money(row.amount)}</td></tr>)}</tbody></table>
      </div>
    </div>
  );
}

function DataTable({ title, columns, children }: { title: string; columns: string[]; children: ReactNode }) {
  return (
    <div className="card table-card">
      <div className="card-heading"><div><p className="eyebrow">Accounting</p><h2>{title}</h2></div></div>
      <div className="table-scroll">
        <table>
          <thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </div>
  );
}

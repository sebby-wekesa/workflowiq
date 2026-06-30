import { useMemo, useState, type ComponentType, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";
import {
  BanknoteIcon,
  CreditCardIcon,
  DownloadIcon,
  FileTextIcon,
  LandmarkIcon,
  PlusIcon,
  PrinterIcon,
  ReceiptIcon,
  SearchIcon,
} from "lucide-react";
import {
  useAccountingSuppliers,
  useBankReconciliations,
  useCashBookAccounts,
  useCashBookTransactions,
  useCogsEntries,
  useCreateBankReconciliation,
  useCreateCashBookAccount,
  useCreditNotes,
  useCustomers,
  useOperatingExpenses,
  usePostCashBookTransaction,
  usePostCogsEntry,
  usePostCreditNote,
  usePostCustomerInvoice,
  usePostOperatingExpense,
  useRevenueInvoices,
  type CashBookAccount,
  type CashBookTransactionRow,
  type CogsEntryRow,
  type OperatingExpenseRow,
  type RevenueCreditNote,
  type RevenueInvoice,
} from "@/lib/api";
import type { ChartAccount, Customer, Supplier } from "@/lib/supabase";

type ChartSection =
  | "cash"
  | "revenue"
  | "cogs"
  | "admin"
  | "finance"
  | "other";

type ChartFilters = {
  search: string;
  from: string;
  to: string;
  branch: string;
  accountId: string;
  customerId: string;
  payee: string;
  transactionType: string;
  status: string;
  user: string;
};

const EMPTY_FILTERS: ChartFilters = {
  search: "",
  from: "",
  to: "",
  branch: "",
  accountId: "",
  customerId: "",
  payee: "",
  transactionType: "",
  status: "",
  user: "",
};

const SECTIONS: { id: ChartSection; label: string; icon: ComponentType<{ className?: string }> }[] = [
  { id: "cash", label: "Cash Book", icon: BanknoteIcon },
  { id: "revenue", label: "Revenue", icon: ReceiptIcon },
  { id: "cogs", label: "Cost of Goods Sold", icon: CreditCardIcon },
  { id: "admin", label: "Administrative Expenses", icon: FileTextIcon },
  { id: "finance", label: "Finance Charges", icon: LandmarkIcon },
  { id: "other", label: "Other Operating Expenses", icon: FileTextIcon },
];

const ADMIN_CATEGORIES = [
  "Rent",
  "Salaries",
  "Office supplies",
  "Utilities",
  "Internet",
  "Licenses",
  "Professional fees",
  "Insurance",
  "Other admin costs",
];

const FINANCE_CATEGORIES = [
  "Bank charges",
  "Loan interest",
  "Mobile money charges",
  "Transaction fees",
  "Penalties",
  "Other finance costs",
];

const OTHER_CATEGORIES = [
  "Transport",
  "Repairs and maintenance",
  "Marketing",
  "Staff welfare",
  "Training",
  "Travel",
  "Miscellaneous operating costs",
];

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
  if (!Number.isFinite(n) || n < 0) throw new Error("Enter a valid amount");
  return n;
}

function positiveAmount(value: string) {
  const n = parseAmount(value);
  if (n <= 0) throw new Error("Enter a positive amount");
  return n;
}

function shortDate(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-KE", { day: "2-digit", month: "short", year: "numeric" });
}

function isPostableAccount(account: ChartAccount) {
  return account.is_active && account.is_postable !== false;
}

function exportRows(filename: string, rows: Record<string, string | number | null | undefined>[]) {
  const headers = Object.keys(rows[0] ?? { Empty: "" });
  const body = [
    headers.join("\t"),
    ...rows.map((row) => headers.map((header) => String(row[header] ?? "").replace(/\s+/g, " ")).join("\t")),
  ].join("\n");
  const blob = new Blob([body], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename}.xls`;
  link.click();
  URL.revokeObjectURL(url);
}

function printPdf() {
  window.print();
}

function inDateRange(date: string, filters: ChartFilters) {
  const value = new Date(date).getTime();
  if (filters.from && value < new Date(filters.from).getTime()) return false;
  if (filters.to && value > new Date(`${filters.to}T23:59:59`).getTime()) return false;
  return true;
}

function includesSearch(filters: ChartFilters, values: (string | number | null | undefined)[]) {
  const term = filters.search.trim().toLowerCase();
  if (!term) return true;
  return values.some((value) => String(value ?? "").toLowerCase().includes(term));
}

export function ChartsAccountingModule({
  accounts,
}: {
  accounts: ChartAccount[];
}) {
  const [section, setSection] = useState<ChartSection>("cash");
  const [filters, setFilters] = useState<ChartFilters>(EMPTY_FILTERS);

  const customers = useCustomers();
  const suppliers = useAccountingSuppliers();
  const cashAccounts = useCashBookAccounts();
  const cashTransactions = useCashBookTransactions();
  const reconciliations = useBankReconciliations();
  const invoices = useRevenueInvoices();
  const creditNotes = useCreditNotes();
  const cogsEntries = useCogsEntries();
  const operatingExpenses = useOperatingExpenses();

  const activeAccounts = useMemo(() => accounts.filter(isPostableAccount), [accounts]);
  const paymentAccounts = useMemo(
    () => cashAccounts.data?.map((account) => account.chart_account).filter(Boolean) as ChartAccount[] | undefined,
    [cashAccounts.data],
  );
  const accountOptions = paymentAccounts?.length ? paymentAccounts : activeAccounts.filter((account) => account.type === "ASSET");

  const branchOptions = useMemo(() => {
    const branches = new Set<string>();
    cashAccounts.data?.forEach((account) => account.branch && branches.add(account.branch));
    invoices.data?.forEach((invoice) => invoice.branch && branches.add(invoice.branch));
    creditNotes.data?.forEach((note) => note.branch && branches.add(note.branch));
    cogsEntries.data?.forEach((entry) => entry.branch && branches.add(entry.branch));
    operatingExpenses.data?.forEach((expense) => expense.branch && branches.add(expense.branch));
    return [...branches].sort();
  }, [cashAccounts.data, cogsEntries.data, creditNotes.data, invoices.data, operatingExpenses.data]);

  const filteredTransactions = useMemo(
    () => (cashTransactions.data ?? []).filter((transaction) => {
      if (!inDateRange(transaction.date, filters)) return false;
      if (filters.accountId) {
        const account = cashAccounts.data?.find((item) => item.id === transaction.cashAccountId);
        if (account?.chart_account_id !== filters.accountId) return false;
      }
      if (filters.transactionType && transaction.transactionType !== filters.transactionType) return false;
      if (filters.user && !transaction.user.toLowerCase().includes(filters.user.toLowerCase())) return false;
      return includesSearch(filters, [
        transaction.referenceNumber,
        transaction.description,
        transaction.transactionType,
        transaction.accountName,
        transaction.user,
      ]);
    }),
    [cashAccounts.data, cashTransactions.data, filters],
  );

  const filteredInvoices = useMemo(
    () => (invoices.data ?? []).filter((invoice) => {
      if (!inDateRange(invoice.date, filters)) return false;
      if (filters.branch && invoice.branch !== filters.branch) return false;
      if (filters.customerId && invoice.customer_id !== filters.customerId) return false;
      if (filters.status && invoice.status !== filters.status) return false;
      if (filters.payee && !String(invoice.customer?.name ?? "").toLowerCase().includes(filters.payee.toLowerCase())) return false;
      return includesSearch(filters, [
        invoice.invoice_number,
        invoice.customer?.name,
        invoice.branch,
        invoice.sales_person,
        invoice.payment_terms,
        invoice.status,
      ]);
    }),
    [filters, invoices.data],
  );

  const filteredCreditNotes = useMemo(
    () => (creditNotes.data ?? []).filter((note) => {
      if (!inDateRange(note.date, filters)) return false;
      if (filters.branch && note.branch !== filters.branch) return false;
      if (filters.customerId && note.customer_id !== filters.customerId) return false;
      if (filters.status && note.status !== filters.status) return false;
      if (filters.payee && !String(note.customer?.name ?? "").toLowerCase().includes(filters.payee.toLowerCase())) return false;
      return includesSearch(filters, [note.credit_note_number, note.customer?.name, note.reason, note.notes, note.status]);
    }),
    [creditNotes.data, filters],
  );

  const filteredCogs = useMemo(
    () => (cogsEntries.data ?? []).filter((entry) => {
      if (!inDateRange(entry.date, filters)) return false;
      if (filters.branch && entry.branch !== filters.branch) return false;
      if (filters.accountId && entry.payment_account_id !== filters.accountId) return false;
      if (filters.status && entry.status !== filters.status) return false;
      return includesSearch(filters, [entry.cogs_number, entry.branch, entry.product_service, entry.project, entry.notes, entry.status]);
    }),
    [cogsEntries.data, filters],
  );

  const filteredExpenses = useMemo(
    () => (operatingExpenses.data ?? []).filter((expense) => {
      if (!inDateRange(expense.date, filters)) return false;
      if (filters.branch && expense.branch !== filters.branch) return false;
      if (filters.accountId && expense.payment_account_id !== filters.accountId) return false;
      if (filters.payee && !expense.payee.toLowerCase().includes(filters.payee.toLowerCase())) return false;
      if (filters.status && expense.status !== filters.status) return false;
      return includesSearch(filters, [
        expense.expense_number,
        expense.payee,
        expense.description,
        expense.category,
        expense.payment_method,
        expense.reference_number,
        expense.status,
      ]);
    }),
    [filters, operatingExpenses.data],
  );

  const isLoading =
    cashAccounts.isLoading ||
    cashTransactions.isLoading ||
    reconciliations.isLoading ||
    invoices.isLoading ||
    creditNotes.isLoading ||
    cogsEntries.isLoading ||
    operatingExpenses.isLoading ||
    customers.isLoading ||
    suppliers.isLoading;
  const error =
    cashAccounts.error ||
    cashTransactions.error ||
    reconciliations.error ||
    invoices.error ||
    creditNotes.error ||
    cogsEntries.error ||
    operatingExpenses.error ||
    customers.error ||
    suppliers.error;

  return (
    <div className="charts-module">
      <div className="charts-section-tabs" role="tablist" aria-label="Chart accounting sections">
        {SECTIONS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={section === item.id ? "charts-tab charts-tab-active" : "charts-tab"}
            onClick={() => setSection(item.id)}
          >
            <item.icon className="size-4" />
            <span>{item.label}</span>
          </button>
        ))}
      </div>

      <ChartsFilterBar
        filters={filters}
        setFilters={setFilters}
        accounts={accountOptions}
        customers={customers.data ?? []}
        branches={branchOptions}
      />

      {error && <div className="error-banner">Could not load chart accounting data: {error.message}</div>}
      {isLoading && <div className="panel-state"><div className="loader" />Loading chart...</div>}

      {!isLoading && !error && section === "cash" && (
        <CashBookSection
          accounts={cashAccounts.data ?? []}
          transactions={filteredTransactions}
          reconciliations={reconciliations.data ?? []}
          ledgerAccounts={activeAccounts}
        />
      )}

      {!isLoading && !error && section === "revenue" && (
        <RevenueSection
          customers={customers.data ?? []}
          invoices={filteredInvoices}
          creditNotes={filteredCreditNotes}
        />
      )}

      {!isLoading && !error && section === "cogs" && (
        <CogsSection
          entries={filteredCogs}
          invoices={invoices.data ?? []}
          paymentAccounts={accountOptions}
        />
      )}

      {!isLoading && !error && section === "admin" && (
        <ExpenseSection
          title="Administrative Expenses"
          group="administrative"
          categories={ADMIN_CATEGORIES}
          expenses={filteredExpenses.filter((expense) => expense.expense_group === "administrative")}
          paymentAccounts={accountOptions}
          suppliers={suppliers.data ?? []}
        />
      )}

      {!isLoading && !error && section === "finance" && (
        <ExpenseSection
          title="Finance Charges"
          group="finance"
          categories={FINANCE_CATEGORIES}
          expenses={filteredExpenses.filter((expense) => expense.expense_group === "finance")}
          paymentAccounts={accountOptions}
          suppliers={suppliers.data ?? []}
        />
      )}

      {!isLoading && !error && section === "other" && (
        <ExpenseSection
          title="Other Operating Expenses"
          group="other_operating"
          categories={OTHER_CATEGORIES}
          expenses={filteredExpenses.filter((expense) => expense.expense_group === "other_operating")}
          paymentAccounts={accountOptions}
          suppliers={suppliers.data ?? []}
        />
      )}

    </div>
  );
}

function ChartsFilterBar({
  filters,
  setFilters,
  accounts,
  customers,
  branches,
}: {
  filters: ChartFilters;
  setFilters: (filters: ChartFilters) => void;
  accounts: ChartAccount[];
  customers: Customer[];
  branches: string[];
}) {
  return (
    <div className="charts-filter-panel">
      <label className="charts-search">
        <SearchIcon className="size-4" />
        <input
          value={filters.search}
          onChange={(event) => setFilters({ ...filters, search: event.target.value })}
          placeholder="Search tables"
        />
      </label>
      <label>From<input type="date" value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value })} /></label>
      <label>To<input type="date" value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} /></label>
      <label>Branch
        <select value={filters.branch} onChange={(event) => setFilters({ ...filters, branch: event.target.value })}>
          <option value="">All branches</option>
          {branches.map((branch) => <option key={branch} value={branch}>{branch}</option>)}
        </select>
      </label>
      <label>Account
        <select value={filters.accountId} onChange={(event) => setFilters({ ...filters, accountId: event.target.value })}>
          <option value="">All accounts</option>
          {accounts.map((account) => <option key={account.id} value={account.id}>{account.code} - {account.name}</option>)}
        </select>
      </label>
      <label>Customer
        <select value={filters.customerId} onChange={(event) => setFilters({ ...filters, customerId: event.target.value })}>
          <option value="">All customers</option>
          {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
        </select>
      </label>
      <label>Supplier / Payee<input value={filters.payee} onChange={(event) => setFilters({ ...filters, payee: event.target.value })} /></label>
      <label>Type<input value={filters.transactionType} onChange={(event) => setFilters({ ...filters, transactionType: event.target.value })} /></label>
      <label>Status
        <select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="posted">Posted</option>
          <option value="approved">Approved</option>
          <option value="paid">Paid</option>
          <option value="partial">Partial</option>
          <option value="open">Open</option>
          <option value="reconciled">Reconciled</option>
        </select>
      </label>
      <label>User<input value={filters.user} onChange={(event) => setFilters({ ...filters, user: event.target.value })} /></label>
      <button type="button" className="button button-secondary" onClick={() => setFilters(EMPTY_FILTERS)}>
        Clear
      </button>
    </div>
  );
}

function CashBookSection({
  accounts,
  transactions,
  reconciliations,
  ledgerAccounts,
}: {
  accounts: CashBookAccount[];
  transactions: CashBookTransactionRow[];
  reconciliations: { id: string; reconciliation_number: string; statement_date: string; statement_balance: number; system_balance: number; difference: number; status: string; cash_account?: { account_name: string } | null }[];
  ledgerAccounts: ChartAccount[];
}) {
  const [subCategory, setSubCategory] = useState<"bank" | "cash">("bank");
  const bankAccounts = accounts.filter((account) => account.account_kind === "bank");
  const cashAccounts = accounts.filter((account) => account.account_kind === "cash");
  const bankTotal = bankAccounts.reduce((sum, account) => sum + account.currentBalance, 0);
  const cashTotal = cashAccounts.reduce((sum, account) => sum + account.currentBalance, 0);
  const selectedAccounts = subCategory === "bank" ? bankAccounts : cashAccounts;
  const selectedTransactions = transactions.filter((transaction) => transaction.accountKind === subCategory);
  const selectedTitle = subCategory === "bank" ? "Cash at Bank" : "Cash in Hand";

  return (
    <>
      <section className="charts-summary-row">
        <MetricCard label="Total Cash at Bank" value={money(bankTotal)} tone={0} />
        <MetricCard label="Total Cash in Hand" value={money(cashTotal)} tone={1} />
        <MetricCard label="Total Cash Book Balance" value={money(bankTotal + cashTotal)} tone={2} />
      </section>
      <section className="cash-book-subcategories" aria-label="Cash Book subcategories">
        <button
          type="button"
          className={subCategory === "bank" ? "cash-book-subcategory cash-book-subcategory-active" : "cash-book-subcategory"}
          onClick={() => setSubCategory("bank")}
        >
          <span>Cash at Bank</span>
          <strong>{money(bankTotal)}</strong>
          <small>{bankAccounts.length} bank accounts</small>
        </button>
        <button
          type="button"
          className={subCategory === "cash" ? "cash-book-subcategory cash-book-subcategory-active" : "cash-book-subcategory"}
          onClick={() => setSubCategory("cash")}
        >
          <span>Cash in Hand</span>
          <strong>{money(cashTotal)}</strong>
          <small>{cashAccounts.length} cash accounts</small>
        </button>
      </section>
      <section className="charts-two-column">
        <CashAccountForm key={`account-${subCategory}`} kind={subCategory} />
        <CashTransactionForm key={`transaction-${subCategory}`} kind={subCategory} accounts={selectedAccounts} ledgerAccounts={ledgerAccounts} />
        {subCategory === "bank" && <BankReconciliationForm accounts={bankAccounts} />}
      </section>
      <section className="charts-account-ledger">
        <AccountList title={selectedTitle} accounts={selectedAccounts} />
      </section>
      <ExportableCashTransactions title={`${selectedTitle} transaction history`} filename={`${subCategory === "bank" ? "cash-at-bank" : "cash-in-hand"}-transactions`} transactions={selectedTransactions} />
      {subCategory === "bank" && (
        <ChartsTable title="Bank reconciliations" columns={["Number", "Account", "Statement date", "Statement", "System", "Difference", "Status"]}>
          {reconciliations.map((row) => (
            <tr key={row.id}>
              <td><strong>{row.reconciliation_number}</strong></td>
              <td>{row.cash_account?.account_name ?? "-"}</td>
              <td>{shortDate(row.statement_date)}</td>
              <td>{money(Number(row.statement_balance))}</td>
              <td>{money(Number(row.system_balance))}</td>
              <td>{money(Number(row.difference))}</td>
              <td><span className="status">{row.status}</span></td>
            </tr>
          ))}
        </ChartsTable>
      )}
    </>
  );
}

function RevenueSection({
  customers,
  invoices,
  creditNotes,
}: {
  customers: Customer[];
  invoices: RevenueInvoice[];
  creditNotes: RevenueCreditNote[];
}) {
  const totalRevenue = invoices.reduce((sum, invoice) => sum + Number(invoice.net_amount), 0);
  const creditTotal = creditNotes.reduce((sum, note) => sum + Number(note.amount), 0);
  const today = new Date(localDate());
  const outstanding = invoices
    .filter((invoice) => !["paid", "void"].includes(invoice.status))
    .reduce((sum, invoice) => sum + Number(invoice.total_amount), 0);
  const paid = invoices
    .filter((invoice) => invoice.status === "paid")
    .reduce((sum, invoice) => sum + Number(invoice.total_amount), 0);
  const overdue = invoices
    .filter((invoice) => invoice.due_date && invoice.status !== "paid" && invoice.status !== "void" && new Date(invoice.due_date) < today)
    .reduce((sum, invoice) => sum + Number(invoice.total_amount), 0);

  return (
    <>
      <section className="charts-summary-row">
        <MetricCard label="Total Revenue" value={money(totalRevenue)} tone={0} />
        <MetricCard label="Outstanding Invoices" value={money(outstanding)} tone={1} />
        <MetricCard label="Paid Invoices" value={money(paid)} tone={2} />
        <MetricCard label="Overdue Invoices" value={money(overdue)} tone={3} />
        <MetricCard label="Credit Notes Issued" value={money(creditTotal)} tone={2} />
        <MetricCard label="Net Revenue" value={money(totalRevenue - creditTotal)} tone={3} />
      </section>
      <section className="charts-two-column">
        <CustomerInvoiceForm customers={customers} />
        <CreditNoteForm customers={customers} invoices={invoices} />
      </section>
      <ExportableInvoices invoices={invoices} />
      <ChartsTable title="Credit notes" columns={["Number", "Linked invoice", "Customer", "Branch", "Reason", "Date", "Amount", "Status"]}>
        {creditNotes.map((note) => (
          <tr key={note.id}>
            <td><strong>{note.credit_note_number}</strong></td>
            <td>{note.invoice?.invoice_number ?? "-"}</td>
            <td>{note.customer?.name ?? "-"}</td>
            <td>{note.branch ?? "-"}</td>
            <td>{note.reason}</td>
            <td>{shortDate(note.date)}</td>
            <td>{money(Number(note.amount))}</td>
            <td><span className="status">{note.status}</span></td>
          </tr>
        ))}
      </ChartsTable>
    </>
  );
}

function CogsSection({
  entries,
  invoices,
  paymentAccounts,
}: {
  entries: CogsEntryRow[];
  invoices: RevenueInvoice[];
  paymentAccounts: ChartAccount[];
}) {
  const total = entries.reduce((sum, entry) => sum + Number(entry.total_amount), 0);
  const revenue = invoices
    .filter((invoice) => invoice.status !== "void")
    .reduce((sum, invoice) => sum + Number(invoice.net_amount), 0);
  const byBranch = groupSum(entries, (entry) => entry.branch ?? "Unassigned", (entry) => Number(entry.total_amount));
  const byProduct = groupSum(entries, (entry) => entry.product_service ?? "Unassigned", (entry) => Number(entry.total_amount));

  return (
    <>
      <section className="charts-summary-row">
        <MetricCard label="Total COGS" value={money(total)} tone={0} />
        <MetricCard label="COGS by branch" value={String(byBranch.length)} tone={1} />
        <MetricCard label="COGS by product/service" value={String(byProduct.length)} tone={2} />
        <MetricCard label="Gross Profit" value={money(revenue - total)} tone={3} />
      </section>
      <section className="charts-two-column">
        <CogsForm invoices={invoices} paymentAccounts={paymentAccounts} />
        <BreakdownPanel title="COGS by branch" rows={byBranch} />
        <BreakdownPanel title="COGS by product/service" rows={byProduct} />
      </section>
      <ExportableCogs entries={entries} />
    </>
  );
}

function ExpenseSection({
  title,
  group,
  categories,
  expenses,
  paymentAccounts,
  suppliers,
}: {
  title: string;
  group: "administrative" | "finance" | "other_operating";
  categories: string[];
  expenses: OperatingExpenseRow[];
  paymentAccounts: ChartAccount[];
  suppliers: Supplier[];
}) {
  const total = expenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
  const byCategory = groupSum(expenses, (expense) => expense.category, (expense) => Number(expense.amount));

  return (
    <>
      <section className="charts-summary-row">
        <MetricCard label={title} value={money(total)} tone={0} />
        <MetricCard label="Categories" value={String(byCategory.length)} tone={1} />
      </section>
      <section className="charts-two-column">
        <OperatingExpenseForm
          group={group}
          title={title}
          categories={categories}
          paymentAccounts={paymentAccounts}
          suppliers={suppliers}
        />
        <BreakdownPanel title="By category" rows={byCategory} />
      </section>
      <ExportableOperatingExpenses title={title} expenses={expenses} />
    </>
  );
}

function CashAccountForm({ kind }: { kind: "bank" | "cash" }) {
  const createAccount = useCreateCashBookAccount();
  const [accountName, setAccountName] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [branch, setBranch] = useState("");
  const [openingBalance, setOpeningBalance] = useState("0");
  const label = kind === "bank" ? "Bank Account" : "Cash in Hand Account";

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const result = await createAccount.mutateAsync({
        accountKind: kind,
        accountName,
        bankName,
        accountNumber,
        branch,
        openingBalance: parseAmount(openingBalance),
        status: "active",
      });
      toast.success(`Account ${result.code} created`);
      setAccountName("");
      setBankName("");
      setAccountNumber("");
      setBranch("");
      setOpeningBalance("0");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create cash book account");
    }
  };

  return (
    <FormCard title={`Add ${label}`} onSubmit={submit} pending={createAccount.isPending} submitLabel="Save account">
      <label>Account name<input value={accountName} onChange={(event) => setAccountName(event.target.value)} required /></label>
      {kind === "bank" && (
        <>
          <label>Bank name<input value={bankName} onChange={(event) => setBankName(event.target.value)} /></label>
          <label>Account number<input value={accountNumber} onChange={(event) => setAccountNumber(event.target.value)} /></label>
        </>
      )}
      <label>Branch<input value={branch} onChange={(event) => setBranch(event.target.value)} /></label>
      <label>Opening balance<input type="number" min="0" step="0.01" value={openingBalance} onChange={(event) => setOpeningBalance(event.target.value)} required /></label>
    </FormCard>
  );
}

function CashTransactionForm({
  kind,
  accounts,
  ledgerAccounts,
}: {
  kind: "bank" | "cash";
  accounts: CashBookAccount[];
  ledgerAccounts: ChartAccount[];
}) {
  const postTransaction = usePostCashBookTransaction();
  const actionOptions = kind === "bank"
    ? ["Receive Deposit", "Write Cheque", "Journal Entry - Debit Cash", "Journal Entry - Credit Cash"]
    : ["Receive Deposit", "Cash Payment", "Journal Entry - Debit Cash", "Journal Entry - Credit Cash"];
  const [cashAccountId, setCashAccountId] = useState("");
  const [date, setDate] = useState(localDate());
  const [action, setAction] = useState(actionOptions[0]);
  const [offsetAccountId, setOffsetAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [description, setDescription] = useState("");
  const label = kind === "bank" ? "Cash at Bank" : "Cash in Hand";

  const direction = action === "Receive Deposit" || action === "Journal Entry - Debit Cash" ? "debit_cash" : "credit_cash";
  const selected = accounts.find((account) => account.id === cashAccountId);
  const offsetOptions = ledgerAccounts.filter((account) => account.id !== selected?.chart_account_id);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const result = await postTransaction.mutateAsync({
        cashAccountId,
        date,
        transactionType: action,
        direction,
        amount: positiveAmount(amount),
        offsetAccountId,
        description,
        referenceNumber,
      });
      toast.success(`Posted ${result.transactionNumber}`);
      setAmount("");
      setReferenceNumber("");
      setDescription("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not post cash book transaction");
    }
  };

  return (
    <FormCard title={`${label} Transaction`} onSubmit={submit} pending={postTransaction.isPending} submitLabel="Post transaction">
      <label>Account<SelectCashAccount value={cashAccountId} setValue={setCashAccountId} accounts={accounts} /></label>
      <label>Date<input type="date" value={date} onChange={(event) => setDate(event.target.value)} required /></label>
      <label>Transaction type
        <select value={action} onChange={(event) => setAction(event.target.value)}>
          {actionOptions.map((option) => <option key={option}>{option}</option>)}
        </select>
      </label>
      <label>Offset account<SelectAccount value={offsetAccountId} setValue={setOffsetAccountId} accounts={offsetOptions} /></label>
      <label>Amount<input type="number" min="0" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} required /></label>
      <label>Reference number<input value={referenceNumber} onChange={(event) => setReferenceNumber(event.target.value)} /></label>
      <label className="charts-form-wide">Description<input value={description} onChange={(event) => setDescription(event.target.value)} /></label>
    </FormCard>
  );
}

function BankReconciliationForm({ accounts }: { accounts: CashBookAccount[] }) {
  const createReconciliation = useCreateBankReconciliation();
  const [cashAccountId, setCashAccountId] = useState("");
  const [statementDate, setStatementDate] = useState(localDate());
  const [statementBalance, setStatementBalance] = useState("");
  const [notes, setNotes] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const result = await createReconciliation.mutateAsync({
        cashAccountId,
        statementDate,
        statementBalance: parseAmount(statementBalance),
        notes,
      });
      toast.success(`Reconciliation ${result.reconciliation_number} saved`);
      setStatementBalance("");
      setNotes("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not reconcile bank account");
    }
  };

  return (
    <FormCard title="Bank Reconciliation" onSubmit={submit} pending={createReconciliation.isPending} submitLabel="Save reconciliation">
      <label>Bank account<SelectCashAccount value={cashAccountId} setValue={setCashAccountId} accounts={accounts} /></label>
      <label>Statement date<input type="date" value={statementDate} onChange={(event) => setStatementDate(event.target.value)} required /></label>
      <label>Statement balance<input type="number" step="0.01" value={statementBalance} onChange={(event) => setStatementBalance(event.target.value)} required /></label>
      <label className="charts-form-wide">Notes<input value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
    </FormCard>
  );
}

function CustomerInvoiceForm({ customers }: { customers: Customer[] }) {
  const postInvoice = usePostCustomerInvoice();
  const [customerId, setCustomerId] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(localDate());
  const [dueDate, setDueDate] = useState("");
  const [branch, setBranch] = useState("");
  const [salesPerson, setSalesPerson] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState([{ item: "", quantity: "1", unitPrice: "", discount: "0", tax: "16" }]);

  const updateLine = (index: number, patch: Partial<(typeof lines)[number]>) => {
    setLines((current) => current.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const result = await postInvoice.mutateAsync({
        customerId,
        invoiceDate,
        dueDate: dueDate || null,
        branch,
        salesPerson,
        paymentTerms,
        notes,
        lines: lines.map((line) => ({
          item: line.item,
          quantity: positiveAmount(line.quantity),
          unitPrice: parseAmount(line.unitPrice),
          discount: parseAmount(line.discount || "0"),
          tax: parseAmount(line.tax || "0"),
        })),
      });
      toast.success(`Posted invoice ${result.invoiceNumber}`);
      setNotes("");
      setLines([{ item: "", quantity: "1", unitPrice: "", discount: "0", tax: "16" }]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not post invoice");
    }
  };

  return (
    <FormCard title="Create Customer Invoice" onSubmit={submit} pending={postInvoice.isPending} submitLabel="Approve invoice">
      <label>Customer<SelectCustomer value={customerId} setValue={setCustomerId} customers={customers} /></label>
      <label>Invoice date<input type="date" value={invoiceDate} onChange={(event) => setInvoiceDate(event.target.value)} required /></label>
      <label>Due date<input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label>
      <label>Branch<input value={branch} onChange={(event) => setBranch(event.target.value)} /></label>
      <label>Sales person<input value={salesPerson} onChange={(event) => setSalesPerson(event.target.value)} /></label>
      <label>Payment terms<input value={paymentTerms} onChange={(event) => setPaymentTerms(event.target.value)} /></label>
      <div className="charts-lines charts-form-wide">
        {lines.map((line, index) => (
          <div className="charts-line-grid" key={index}>
            <label>Product / service<input value={line.item} onChange={(event) => updateLine(index, { item: event.target.value })} required /></label>
            <label>Qty<input type="number" min="0" step="0.01" value={line.quantity} onChange={(event) => updateLine(index, { quantity: event.target.value })} required /></label>
            <label>Unit price<input type="number" min="0" step="0.01" value={line.unitPrice} onChange={(event) => updateLine(index, { unitPrice: event.target.value })} required /></label>
            <label>Discount<input type="number" min="0" step="0.01" value={line.discount} onChange={(event) => updateLine(index, { discount: event.target.value })} /></label>
            <label>Tax %<input type="number" min="0" step="0.01" value={line.tax} onChange={(event) => updateLine(index, { tax: event.target.value })} /></label>
          </div>
        ))}
        <button type="button" className="button button-secondary" onClick={() => setLines((current) => [...current, { item: "", quantity: "1", unitPrice: "", discount: "0", tax: "16" }])}>
          <PlusIcon className="size-4" />Add line
        </button>
      </div>
      <label className="charts-form-wide">Notes<input value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
    </FormCard>
  );
}

function CreditNoteForm({ customers, invoices }: { customers: Customer[]; invoices: RevenueInvoice[] }) {
  const postCreditNote = usePostCreditNote();
  const [invoiceId, setInvoiceId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [branch, setBranch] = useState("");
  const [reason, setReason] = useState("");
  const [date, setDate] = useState(localDate());
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");

  const selectedInvoice = invoices.find((invoice) => invoice.id === invoiceId);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const result = await postCreditNote.mutateAsync({
        invoiceId: invoiceId || null,
        customerId: selectedInvoice?.customer_id ?? customerId,
        branch,
        reason,
        date,
        amount: positiveAmount(amount),
        notes,
      });
      toast.success(`Posted credit note ${result.creditNoteNumber}`);
      setAmount("");
      setReason("");
      setNotes("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not post credit note");
    }
  };

  return (
    <FormCard title="Create Credit Note" onSubmit={submit} pending={postCreditNote.isPending} submitLabel="Approve credit note">
      <label>Linked invoice
        <select value={invoiceId} onChange={(event) => setInvoiceId(event.target.value)}>
          <option value="">No linked invoice</option>
          {invoices.map((invoice) => <option key={invoice.id} value={invoice.id}>{invoice.invoice_number} - {invoice.customer?.name}</option>)}
        </select>
      </label>
      {!selectedInvoice && <label>Customer<SelectCustomer value={customerId} setValue={setCustomerId} customers={customers} /></label>}
      <label>Branch<input value={branch} onChange={(event) => setBranch(event.target.value)} /></label>
      <label>Date<input type="date" value={date} onChange={(event) => setDate(event.target.value)} required /></label>
      <label>Amount<input type="number" min="0" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} required /></label>
      <label>Reason<input value={reason} onChange={(event) => setReason(event.target.value)} required /></label>
      <label className="charts-form-wide">Notes<input value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
    </FormCard>
  );
}

function CogsForm({ invoices, paymentAccounts }: { invoices: RevenueInvoice[]; paymentAccounts: ChartAccount[] }) {
  const postCogs = usePostCogsEntry();
  const [date, setDate] = useState(localDate());
  const [branch, setBranch] = useState("");
  const [invoiceId, setInvoiceId] = useState("");
  const [productService, setProductService] = useState("");
  const [project, setProject] = useState("");
  const [material, setMaterial] = useState("0");
  const [labour, setLabour] = useState("0");
  const [production, setProduction] = useState("0");
  const [purchase, setPurchase] = useState("0");
  const [paymentAccountId, setPaymentAccountId] = useState("");
  const [notes, setNotes] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const result = await postCogs.mutateAsync({
        date,
        branch,
        invoiceId: invoiceId || null,
        productService,
        project,
        directMaterialCost: parseAmount(material),
        directLabourCost: parseAmount(labour),
        productionServiceCost: parseAmount(production),
        purchaseCost: parseAmount(purchase),
        paymentAccountId: paymentAccountId || null,
        notes,
      });
      toast.success(`Posted COGS ${result.cogsNumber}`);
      setMaterial("0");
      setLabour("0");
      setProduction("0");
      setPurchase("0");
      setNotes("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not post COGS entry");
    }
  };

  return (
    <FormCard title="Add COGS Entry" onSubmit={submit} pending={postCogs.isPending} submitLabel="Approve COGS">
      <label>Date<input type="date" value={date} onChange={(event) => setDate(event.target.value)} required /></label>
      <label>Branch<input value={branch} onChange={(event) => setBranch(event.target.value)} /></label>
      <label>Linked invoice
        <select value={invoiceId} onChange={(event) => setInvoiceId(event.target.value)}>
          <option value="">None</option>
          {invoices.map((invoice) => <option key={invoice.id} value={invoice.id}>{invoice.invoice_number} - {invoice.customer?.name}</option>)}
        </select>
      </label>
      <label>Product / service<input value={productService} onChange={(event) => setProductService(event.target.value)} /></label>
      <label>Project<input value={project} onChange={(event) => setProject(event.target.value)} /></label>
      <label>Direct material cost<input type="number" min="0" step="0.01" value={material} onChange={(event) => setMaterial(event.target.value)} /></label>
      <label>Direct labour cost<input type="number" min="0" step="0.01" value={labour} onChange={(event) => setLabour(event.target.value)} /></label>
      <label>Production / service cost<input type="number" min="0" step="0.01" value={production} onChange={(event) => setProduction(event.target.value)} /></label>
      <label>Purchase cost<input type="number" min="0" step="0.01" value={purchase} onChange={(event) => setPurchase(event.target.value)} /></label>
      <label>Payment account<SelectAccount value={paymentAccountId} setValue={setPaymentAccountId} accounts={paymentAccounts} placeholder="Default cash account" /></label>
      <label className="charts-form-wide">Notes<input value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
    </FormCard>
  );
}

function OperatingExpenseForm({
  group,
  title,
  categories,
  paymentAccounts,
  suppliers,
}: {
  group: "administrative" | "finance" | "other_operating";
  title: string;
  categories: string[];
  paymentAccounts: ChartAccount[];
  suppliers: Supplier[];
}) {
  const postExpense = usePostOperatingExpense();
  const [date, setDate] = useState(localDate());
  const [payee, setPayee] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [branch, setBranch] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(categories[0] ?? "");
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [paymentAccountId, setPaymentAccountId] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const selectedSupplier = suppliers.find((supplier) => supplier.id === supplierId);
    try {
      const result = await postExpense.mutateAsync({
        expenseGroup: group,
        date,
        payee: selectedSupplier?.name ?? payee,
        branch,
        description,
        category,
        amount: positiveAmount(amount),
        paymentMethod,
        referenceNumber,
        paymentAccountId: paymentAccountId || null,
      });
      toast.success(`Posted expense ${result.expenseNumber}`);
      setAmount("");
      setDescription("");
      setReferenceNumber("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not post expense");
    }
  };

  return (
    <FormCard title={`Add ${title}`} onSubmit={submit} pending={postExpense.isPending} submitLabel="Approve expense">
      <label>Date<input type="date" value={date} onChange={(event) => setDate(event.target.value)} required /></label>
      <label>Supplier
        <select value={supplierId} onChange={(event) => setSupplierId(event.target.value)}>
          <option value="">Manual payee</option>
          {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
        </select>
      </label>
      {!supplierId && <label>Payee<input value={payee} onChange={(event) => setPayee(event.target.value)} required /></label>}
      <label>Branch<input value={branch} onChange={(event) => setBranch(event.target.value)} /></label>
      <label>Category
        <select value={category} onChange={(event) => setCategory(event.target.value)} required>
          {categories.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </label>
      <label>Amount<input type="number" min="0" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} required /></label>
      <label>Payment method
        <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>
          <option value="cash">Cash</option>
          <option value="bank_transfer">Bank transfer</option>
          <option value="cheque">Cheque</option>
          <option value="mpesa">M-Pesa</option>
          <option value="card">Card</option>
        </select>
      </label>
      <label>Payment account<SelectAccount value={paymentAccountId} setValue={setPaymentAccountId} accounts={paymentAccounts} placeholder="Default cash account" /></label>
      <label>Reference number<input value={referenceNumber} onChange={(event) => setReferenceNumber(event.target.value)} /></label>
      <label className="charts-form-wide">Description<input value={description} onChange={(event) => setDescription(event.target.value)} /></label>
    </FormCard>
  );
}

function AccountList({ title, accounts }: { title: string; accounts: CashBookAccount[] }) {
  return (
    <div className="card charts-account-list">
      <div className="card-heading">
        <div>
          <p className="eyebrow">{title}</p>
          <h2>{accounts.length} accounts</h2>
        </div>
      </div>
      {accounts.length === 0 ? (
        <div className="accounting-home-empty">No accounts yet.</div>
      ) : (
        <div className="accounting-home-rows">
          {accounts.map((account) => (
            <div className="accounting-home-row" key={account.id}>
              <div>
                <strong><span>{account.chart_account?.code}</span>{account.account_name}</strong>
                <small>{[account.bank_name, account.account_number, account.branch, account.status].filter(Boolean).join(" - ")}</small>
              </div>
              <span>{money(account.currentBalance)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ExportableCashTransactions({
  title,
  filename,
  transactions,
}: {
  title?: string;
  filename?: string;
  transactions: CashBookTransactionRow[];
}) {
  return (
    <div className="charts-table-wrap">
      <TableActions
        title={title ?? "Transaction history"}
        onExcel={() => exportRows(filename ?? "cash-book-transactions", transactions.map((transaction) => ({
          Date: shortDate(transaction.date),
          Reference: transaction.referenceNumber,
          Account: transaction.accountName,
          Type: transaction.transactionType,
          Description: transaction.description,
          Debit: transaction.debit,
          Credit: transaction.credit,
          "Running Balance": transaction.runningBalance,
          User: transaction.user,
        })))}
      />
      <ChartsTable title="" columns={["Date", "Reference", "Description", "Type", "Debit", "Credit", "Running Balance", "User"]}>
        {transactions.map((transaction) => (
          <tr key={transaction.id}>
            <td>{shortDate(transaction.date)}</td>
            <td><strong>{transaction.referenceNumber}</strong><small>{transaction.accountName}</small></td>
            <td>{transaction.description}</td>
            <td>{transaction.transactionType}</td>
            <td>{money(transaction.debit)}</td>
            <td>{money(transaction.credit)}</td>
            <td>{money(transaction.runningBalance)}</td>
            <td>{transaction.user}</td>
          </tr>
        ))}
      </ChartsTable>
    </div>
  );
}

function ExportableInvoices({ invoices }: { invoices: RevenueInvoice[] }) {
  return (
    <div className="charts-table-wrap">
      <TableActions
        title="Invoices"
        onExcel={() => exportRows("revenue-invoices", invoices.map((invoice) => ({
          "Invoice Number": invoice.invoice_number,
          Customer: invoice.customer?.name,
          "Invoice Date": shortDate(invoice.date),
          "Due Date": shortDate(invoice.due_date),
          Branch: invoice.branch,
          "Sales Person": invoice.sales_person,
          Status: invoice.status,
          "Payment Terms": invoice.payment_terms,
          Total: invoice.total_amount,
        })))}
      />
      <ChartsTable title="" columns={["Invoice", "Customer", "Date", "Due", "Branch", "Sales Person", "Status", "Total", "Lines"]}>
        {invoices.map((invoice) => (
          <tr key={invoice.id}>
            <td><strong>{invoice.invoice_number}</strong></td>
            <td>{invoice.customer?.name ?? "-"}</td>
            <td>{shortDate(invoice.date)}</td>
            <td>{shortDate(invoice.due_date)}</td>
            <td>{invoice.branch ?? "-"}</td>
            <td>{invoice.sales_person ?? "-"}</td>
            <td><span className="status">{invoice.status}</span></td>
            <td>{money(Number(invoice.total_amount))}</td>
            <td>
              {(invoice.accounting_invoice_lines ?? []).slice(0, 2).map((line) => (
                <small key={line.id}>{line.item}: {line.quantity} x {money(Number(line.unit_price))}</small>
              ))}
            </td>
          </tr>
        ))}
      </ChartsTable>
    </div>
  );
}

function ExportableCogs({ entries }: { entries: CogsEntryRow[] }) {
  return (
    <div className="charts-table-wrap">
      <TableActions
        title="COGS entries"
        onExcel={() => exportRows("cogs-entries", entries.map((entry) => ({
          Date: shortDate(entry.date),
          Number: entry.cogs_number,
          Branch: entry.branch,
          Invoice: entry.invoice?.invoice_number,
          "Product / Service": entry.product_service,
          Project: entry.project,
          Material: entry.direct_material_cost,
          Labour: entry.direct_labour_cost,
          Production: entry.production_service_cost,
          Purchase: entry.purchase_cost,
          Total: entry.total_amount,
        })))}
      />
      <ChartsTable title="" columns={["Date", "Number", "Invoice", "Branch", "Product / Service", "Project", "Material", "Labour", "Production", "Purchase", "Total"]}>
        {entries.map((entry) => (
          <tr key={entry.id}>
            <td>{shortDate(entry.date)}</td>
            <td><strong>{entry.cogs_number}</strong></td>
            <td>{entry.invoice?.invoice_number ?? "-"}</td>
            <td>{entry.branch ?? "-"}</td>
            <td>{entry.product_service ?? "-"}</td>
            <td>{entry.project ?? "-"}</td>
            <td>{money(Number(entry.direct_material_cost))}</td>
            <td>{money(Number(entry.direct_labour_cost))}</td>
            <td>{money(Number(entry.production_service_cost))}</td>
            <td>{money(Number(entry.purchase_cost))}</td>
            <td>{money(Number(entry.total_amount))}</td>
          </tr>
        ))}
      </ChartsTable>
    </div>
  );
}

function ExportableOperatingExpenses({ title, expenses }: { title: string; expenses: OperatingExpenseRow[] }) {
  return (
    <div className="charts-table-wrap">
      <TableActions
        title={title}
        onExcel={() => exportRows(title.toLowerCase().replace(/\s+/g, "-"), expenses.map((expense) => ({
          Date: shortDate(expense.date),
          Number: expense.expense_number,
          Payee: expense.payee,
          Branch: expense.branch,
          Description: expense.description,
          Category: expense.category,
          Amount: expense.amount,
          "Payment Method": expense.payment_method,
          Reference: expense.reference_number,
          Status: expense.status,
        })))}
      />
      <ChartsTable title="" columns={["Date", "Number", "Payee", "Branch", "Description", "Category", "Amount", "Payment Method", "Reference", "Status"]}>
        {expenses.map((expense) => (
          <tr key={expense.id}>
            <td>{shortDate(expense.date)}</td>
            <td><strong>{expense.expense_number}</strong></td>
            <td>{expense.payee}</td>
            <td>{expense.branch ?? "-"}</td>
            <td>{expense.description ?? "-"}</td>
            <td>{expense.category}</td>
            <td>{money(Number(expense.amount))}</td>
            <td>{expense.payment_method}</td>
            <td>{expense.reference_number ?? "-"}</td>
            <td><span className="status">{expense.status}</span></td>
          </tr>
        ))}
      </ChartsTable>
    </div>
  );
}

function TableActions({ title, onExcel }: { title: string; onExcel: () => void }) {
  return (
    <div className="charts-table-actions">
      <h2>{title}</h2>
      <div>
        <button type="button" className="button button-secondary" onClick={printPdf}><PrinterIcon className="size-4" />PDF</button>
        <button type="button" className="button button-secondary" onClick={onExcel}><DownloadIcon className="size-4" />Excel</button>
      </div>
    </div>
  );
}

function MetricCard({ label, value, tone }: { label: string; value: string; tone: number }) {
  return (
    <div className={`metric charts-metric charts-metric-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>Posted ledger</small>
    </div>
  );
}

function FormCard({
  title,
  onSubmit,
  pending,
  submitLabel,
  children,
}: {
  title: string;
  onSubmit: (event: FormEvent) => void;
  pending: boolean;
  submitLabel: string;
  children: ReactNode;
}) {
  return (
    <form className="card create-form charts-form-card" onSubmit={onSubmit}>
      <div className="charts-form-heading">
        <p className="eyebrow">{title}</p>
        <span>General Ledger</span>
      </div>
      <div className="charts-form-grid">{children}</div>
      <div className="form-actions">
        <button type="submit" className="button button-primary" disabled={pending}>
          {pending ? "Posting..." : submitLabel}
        </button>
      </div>
    </form>
  );
}

function ChartsTable({ title, columns, children }: { title: string; columns: string[]; children: ReactNode }) {
  return (
    <div className="card table-card charts-table-card">
      {title && <div className="card-heading"><h2>{title}</h2></div>}
      <div className="table-scroll">
        <table>
          <thead>
            <tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </div>
  );
}

function SelectCustomer({ value, setValue, customers }: { value: string; setValue: (value: string) => void; customers: Customer[] }) {
  return (
    <select value={value} onChange={(event) => setValue(event.target.value)} required>
      <option value="">Select customer</option>
      {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
    </select>
  );
}

function SelectCashAccount({ value, setValue, accounts }: { value: string; setValue: (value: string) => void; accounts: CashBookAccount[] }) {
  return (
    <select value={value} onChange={(event) => setValue(event.target.value)} required>
      <option value="">Select account</option>
      {accounts.map((account) => <option key={account.id} value={account.id}>{account.account_name}</option>)}
    </select>
  );
}

function SelectAccount({
  value,
  setValue,
  accounts,
  placeholder = "Select account",
}: {
  value: string;
  setValue: (value: string) => void;
  accounts: ChartAccount[];
  placeholder?: string;
}) {
  return (
    <select value={value} onChange={(event) => setValue(event.target.value)} required={placeholder === "Select account"}>
      <option value="">{placeholder}</option>
      {accounts.map((account) => <option key={account.id} value={account.id}>{account.code} - {account.name}</option>)}
    </select>
  );
}

function BreakdownPanel({ title, rows }: { title: string; rows: { label: string; amount: number }[] }) {
  return (
    <div className="card charts-breakdown">
      <div className="card-heading"><h2>{title}</h2></div>
      <div className="accounting-home-rows">
        {rows.length === 0 ? (
          <div className="accounting-home-empty">No entries.</div>
        ) : rows.map((row) => (
          <div className="accounting-home-row" key={row.label}>
            <div><strong>{row.label}</strong></div>
            <span>{money(row.amount)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function groupSum<T>(rows: T[], label: (row: T) => string, amount: (row: T) => number) {
  const map = new Map<string, number>();
  rows.forEach((row) => {
    const key = label(row);
    map.set(key, (map.get(key) ?? 0) + amount(row));
  });
  return [...map.entries()]
    .map(([name, total]) => ({ label: name, amount: total }))
    .sort((a, b) => b.amount - a.amount);
}

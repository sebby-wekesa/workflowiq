// src/lib/api.ts
// Data-access layer for the Supabase backend. Mirrors every Convex query/mutation
// from the old convex/*.ts files so page components migrate with minimal edits.
//
// OLD (Convex):   const jobs = useQuery(api.jobs.list);
//                 const create = useMutation(api.jobs.create);
// NEW (here):     const { data: jobs } = useJobs();
//                 const create = useCreateJob();
//
// Simple CRUD goes straight through PostgREST (supabase.from(...)). Anything that
// must be transactional (stock deduction/reversal, job pipeline) calls a Postgres
// function via supabase.rpc(...) — the logic lives in 01_schema.sql.
import {
  useQuery, useMutation, useQueryClient,
} from "@tanstack/react-query";
import {
  supabase, type Customer, type Stock, type Job, type AppUser, type Organization,
  type JobCondition, type JobPriority, type StockCategory,
  type MovementType, type DeliveryCondition, type Material,
  type AccountingBankReconciliation, type AccountingBill, type AccountingCashAccount,
  type AccountingCashTransaction, type AccountingCogsEntry, type AccountingCreditNote,
  type AccountingExpense, type AccountingInvoice, type AccountingInvoiceLine,
  type AccountingJournalEntry, type AccountingJournalLine,
  type AccountingOperatingExpense, type AccountingPayment, type ChartAccount,
  type LoanRepayment, type Supplier,
} from "@/lib/supabase";
import {
  CLASSIFICATION_MAP,
  STATEMENT_GROUPS,
  type Classification,
  type StatementGroup,
} from "@/lib/accounting/classifications";

function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

// =====================================================================
// ORGANIZATION (the current workshop) — RLS already limits you to your own
// =====================================================================
export const orgApi = {
  getCurrent: () =>
    supabase.from("organizations").select("*").single().then(unwrap<Organization>),
};
// RLS restricts the organizations table to your own workshop, so we fetch it
// then update by id.
export async function renameWorkshop(name: string) {
  const org = await orgApi.getCurrent();
  return supabase.from("organizations").update({ name }).eq("id", org.id).then(unwrap);
}
export const useOrganization = () =>
  useQuery({ queryKey: ["organization"], queryFn: async () => orgApi.getCurrent() });
export const useRenameWorkshop = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: renameWorkshop,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["organization"] }),
  });
};

// =====================================================================
// CUSTOMERS  (was convex/customers.ts)
// =====================================================================
export const customersApi = {
  list: () =>
    supabase.from("customers").select("*").order("name").then(unwrap<Customer[]>),
  search: async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed)
      return supabase.from("customers").select("*").order("name").limit(20).then(unwrap<Customer[]>);
    return supabase
      .from("customers").select("*")
      .or(`name.ilike.%${trimmed}%,phone.ilike.%${trimmed}%`)
      .limit(20).then(unwrap<Customer[]>);
  },
  getById: (id: string) =>
    supabase.from("customers").select("*").eq("id", id).single().then(unwrap<Customer>),
  create: (input: { name: string; phone: string; location?: string; notes?: string }) =>
    supabase.from("customers").insert(input).select("id").single().then(unwrap<{ id: string }>),
  update: (input: { id: string; name: string; phone: string; location?: string; notes?: string }) =>
    supabase.from("customers")
      .update({ name: input.name, phone: input.phone, location: input.location, notes: input.notes })
      .eq("id", input.id).then(unwrap),
  remove: (id: string) =>
    supabase.from("customers").delete().eq("id", id).then(unwrap),
};

export const useCustomers = () =>
  useQuery({ queryKey: ["customers"], queryFn: async () => customersApi.list() });
export const useCustomerSearch = (q: string) =>
  useQuery({ queryKey: ["customers", "search", q], queryFn: () => customersApi.search(q) });
export const useCustomer = (id?: string) =>
  useQuery({ queryKey: ["customers", id], queryFn: async () => customersApi.getById(id!), enabled: !!id });

function customerMutation<TArgs>(fn: (a: TArgs) => PromiseLike<unknown>) {
  return () => {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: async (args: TArgs) => fn(args),
      onSuccess: () => qc.invalidateQueries({ queryKey: ["customers"] }),
    });
  };
}
export const useCreateCustomer = customerMutation(customersApi.create);
export const useUpdateCustomer = customerMutation(customersApi.update);
export const useDeleteCustomer = customerMutation(customersApi.remove);

// =====================================================================
// STAFF  (was convex/staff.ts)
// =====================================================================
export interface Staff {
  id: string; name: string; role_skill: string; phone: string;
  is_active: boolean; created_by: string | null; created_at: string;
}
export const staffApi = {
  list: () => supabase.from("staff").select("*").order("name").then(unwrap<Staff[]>),
  listActive: () =>
    supabase.from("staff").select("*").eq("is_active", true).order("name").then(unwrap<Staff[]>),
  create: (i: { name: string; roleSkill: string; phone: string }) =>
    supabase.from("staff")
      .insert({ name: i.name, role_skill: i.roleSkill, phone: i.phone })
      .select("id").single().then(unwrap<{ id: string }>),
  update: (i: { id: string; name: string; roleSkill: string; phone: string }) =>
    supabase.from("staff")
      .update({ name: i.name, role_skill: i.roleSkill, phone: i.phone })
      .eq("id", i.id).then(unwrap),
  remove: (id: string) => supabase.from("staff").delete().eq("id", id).then(unwrap),
  toggleActive: async (id: string) => {
    const cur = await supabase.from("staff").select("is_active").eq("id", id).single().then(unwrap<{ is_active: boolean }>);
    return supabase.from("staff").update({ is_active: !cur.is_active }).eq("id", id).then(unwrap);
  },
};
export const useStaff = () => useQuery({ queryKey: ["staff"], queryFn: async () => staffApi.list() });
export const useActiveStaff = () => useQuery({ queryKey: ["staff", "active"], queryFn: async () => staffApi.listActive() });
function staffMutation<T>(fn: (a: T) => PromiseLike<unknown>) {
  return () => {
    const qc = useQueryClient();
    return useMutation({ mutationFn: async (args: T) => fn(args), onSuccess: () => qc.invalidateQueries({ queryKey: ["staff"] }) });
  };
}
export const useCreateStaff = staffMutation(staffApi.create);
export const useUpdateStaff = staffMutation(staffApi.update);
export const useDeleteStaff = staffMutation(staffApi.remove);
export const useToggleStaff = staffMutation(staffApi.toggleActive);

// =====================================================================
// STOCK  (was convex/stock.ts) — create/adjust/remove are transactional (RPC)
// =====================================================================
export interface StockMovement {
  id: string; stock_id: string; type: MovementType; quantity: number;
  reason: string; performed_by: string | null; job_id: string | null;
  created_at: string; performedByName?: string;
}
export const stockApi = {
  list: () => supabase.from("stock").select("*").order("name").then(unwrap<Stock[]>),
  search: (q: string) =>
    supabase.from("stock").select("*").ilike("name", `%${q}%`).limit(20).then(unwrap<Stock[]>),
  getMovements: async (stockId: string): Promise<StockMovement[]> => {
    const rows = await supabase
      .from("stock_movements")
      .select("*, performer:app_users!stock_movements_performed_by_fkey(name)")
      .eq("stock_id", stockId)
      .order("created_at", { ascending: false })
      .limit(50)
      .then(unwrap<(StockMovement & { performer: { name: string } | null })[]>);
    return rows.map((m) => ({ ...m, performedByName: m.performer?.name ?? "Unknown" }));
  },
  create: (i: {
    name: string; category: StockCategory; unit: string; currentQty: number;
    minThreshold: number; supplier?: string; notes?: string;
  }) =>
    supabase.rpc("create_stock", {
      p_name: i.name, p_category: i.category, p_unit: i.unit,
      p_current_qty: i.currentQty, p_min_threshold: i.minThreshold,
      p_supplier: i.supplier ?? null, p_notes: i.notes ?? null,
    }).then(unwrap),
  update: (i: {
    id: string; name: string; category: StockCategory; unit: string;
    minThreshold: number; supplier?: string; notes?: string;
  }) =>
    supabase.from("stock").update({
      name: i.name, category: i.category, unit: i.unit,
      min_threshold: i.minThreshold, supplier: i.supplier, notes: i.notes,
    }).eq("id", i.id).then(unwrap),
  adjust: (i: { id: string; type: MovementType; quantity: number; reason: string }) =>
    supabase.rpc("adjust_stock", {
      p_id: i.id, p_type: i.type, p_quantity: i.quantity, p_reason: i.reason,
    }).then(unwrap),
  remove: (id: string) => supabase.rpc("delete_stock", { p_id: id }).then(unwrap),
};
export const useStock = () => useQuery({ queryKey: ["stock"], queryFn: async () => stockApi.list() });
export const useStockMovements = (stockId?: string) =>
  useQuery({ queryKey: ["stock", stockId, "movements"], queryFn: () => stockApi.getMovements(stockId!), enabled: !!stockId });
function stockMutation<T>(fn: (a: T) => PromiseLike<unknown>) {
  return () => {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: async (args: T) => fn(args),
      onSuccess: () => { qc.invalidateQueries({ queryKey: ["stock"] }); },
    });
  };
}
export const useCreateStock = stockMutation(stockApi.create);
export const useUpdateStock = stockMutation(stockApi.update);
export const useAdjustStock = stockMutation(stockApi.adjust);
export const useDeleteStock = stockMutation(stockApi.remove);

// =====================================================================
// JOBS  (was convex/jobs.ts) — pipeline + stock side-effects via RPC
// =====================================================================
export type JobWithCustomer = Job & { customerName: string; customerPhone: string };

export const jobsApi = {
  list: async (): Promise<JobWithCustomer[]> => {
    const rows = await supabase
      .from("jobs")
      .select("*, customer:customers(name, phone)")
      .order("created_at", { ascending: false })
      .then(unwrap<(Job & { customer: { name: string; phone: string } | null })[]>);
    return rows.map((j) => ({
      ...j,
      customerName: j.customer?.name ?? "Unknown",
      customerPhone: j.customer?.phone ?? "",
    }));
  },
  getByCustomer: (customerId: string) =>
    supabase.from("jobs").select("*").eq("customer_id", customerId)
      .order("created_at", { ascending: false }).then(unwrap<Job[]>),
  countByCustomer: async (customerId: string) => {
    const jobs = await supabase.from("jobs").select("status, created_at")
      .eq("customer_id", customerId)
      .then(unwrap<{ status: string; created_at: string }[]>);
    const active = jobs.filter((j) => j.status !== "collected").length;
    const last = jobs.map((j) => j.created_at).sort().at(-1) ?? null;
    return { total: jobs.length, active, lastJobTime: last };
  },
  create: (i: {
    customerId?: string; customerName: string; customerPhone: string;
    description: string; quantity: number; condition: JobCondition;
    intakeNotes?: string; dateReceived: string; priority: JobPriority;
    materials?: Material[];
  }) =>
    supabase.rpc("create_job", {
      p_customer_id: i.customerId ?? null,
      p_customer_name: i.customerName, p_customer_phone: i.customerPhone,
      p_description: i.description, p_quantity: i.quantity, p_condition: i.condition,
      p_intake_notes: i.intakeNotes ?? null, p_date_received: i.dateReceived,
      p_priority: i.priority, p_materials: i.materials ?? null,
    }).then(unwrap),
  update: (i: {
    id: string; description: string; quantity: number; condition: JobCondition;
    intakeNotes?: string; priority: JobPriority; materials?: Material[];
  }) =>
    supabase.rpc("update_job", {
      p_id: i.id, p_description: i.description, p_quantity: i.quantity,
      p_condition: i.condition, p_intake_notes: i.intakeNotes ?? null,
      p_priority: i.priority, p_materials: i.materials ?? null,
    }).then(unwrap),
  advance: (id: string) => supabase.rpc("advance_job", { p_id: id }).then(unwrap),
  markDone: (id: string) => supabase.rpc("mark_job_done", { p_id: id }).then(unwrap),
  undoMarkDone: (id: string) => supabase.rpc("undo_mark_done", { p_id: id }).then(unwrap),
  collect: (i: {
    id: string; collectionDate: string; collectedBy: string; whatDelivered: string;
    condition: DeliveryCondition; notes?: string; materials?: Material[];
  }) =>
    supabase.rpc("collect_job", {
      p_id: i.id, p_collection_date: i.collectionDate, p_collected_by: i.collectedBy,
      p_what_delivered: i.whatDelivered, p_condition: i.condition,
      p_notes: i.notes ?? null, p_materials: i.materials ?? null,
    }).then(unwrap),
  remove: (id: string) => supabase.rpc("delete_job", { p_id: id }).then(unwrap),
};
export const useJobs = () => useQuery({ queryKey: ["jobs"], queryFn: jobsApi.list });
export const useJobsByCustomer = (customerId?: string) =>
  useQuery({ queryKey: ["jobs", "customer", customerId], queryFn: async () => jobsApi.getByCustomer(customerId!), enabled: !!customerId });
function jobMutation<T>(fn: (a: T) => PromiseLike<unknown>) {
  return () => {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: async (args: T) => fn(args),
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["jobs"] });
        qc.invalidateQueries({ queryKey: ["stock"] }); // stock side-effects
        qc.invalidateQueries({ queryKey: ["customers"] }); // create_job can create a customer
      },
    });
  };
}
export const useCreateJob = jobMutation(jobsApi.create);
export const useUpdateJob = jobMutation(jobsApi.update);
export const useAdvanceJob = jobMutation(jobsApi.advance);
export const useMarkJobDone = jobMutation(jobsApi.markDone);
export const useUndoMarkDone = jobMutation(jobsApi.undoMarkDone);
export const useCollectJob = jobMutation(jobsApi.collect);
export const useDeleteJob = jobMutation(jobsApi.remove);

// =====================================================================
// USERS / TEAM  (was convex/users.ts)
// =====================================================================
export const usersApi = {
  getCurrent: (authId: string) =>
    supabase.from("app_users").select("*").eq("auth_id", authId).maybeSingle().then(unwrap<AppUser | null>),
  listAll: () =>
    supabase.from("app_users").select("*").order("created_at").then(unwrap<AppUser[]>),
  changeRole: (i: { userId: string; role: "admin" | "manager" }) =>
    supabase.from("app_users").update({ role: i.role }).eq("id", i.userId).then(unwrap),
  toggleActive: async (userId: string) => {
    const cur = await supabase.from("app_users").select("is_active").eq("id", userId).single().then(unwrap<{ is_active: boolean }>);
    const next = !cur.is_active;
    return supabase.from("app_users")
      .update({ is_active: next, status: next ? "active" : "inactive" })
      .eq("id", userId).then(unwrap);
  },
  // Creates a pending row; sending the actual invite email is a follow-up
  // (Supabase Edge Function or supabase.auth.admin.inviteUserByEmail). See guide.
  invite: (i: { name: string; email: string; role: "admin" | "manager" }) =>
    supabase.from("app_users")
      .insert({ name: i.name, email: i.email, role: i.role, is_active: false, status: "pending" })
      .select("id").single().then(unwrap<{ id: string }>),
  cancelInvite: (userId: string) =>
    supabase.from("app_users").delete().eq("id", userId).then(unwrap),
};
export const useAllUsers = () => useQuery({ queryKey: ["app_users"], queryFn: async () => usersApi.listAll() });
function userMutation<T>(fn: (a: T) => PromiseLike<unknown>) {
  return () => {
    const qc = useQueryClient();
    return useMutation({ mutationFn: async (args: T) => fn(args), onSuccess: () => qc.invalidateQueries({ queryKey: ["app_users"] }) });
  };
}
export const useChangeRole = userMutation(usersApi.changeRole);
export const useToggleUserActive = userMutation(usersApi.toggleActive);
export const useInviteUser = userMutation(usersApi.invite);
export const useCancelInvite = userMutation(usersApi.cancelInvite);

// =====================================================================
// ACCOUNTING
// =====================================================================
export type JournalLineInput = {
  accountId: string;
  debit?: number;
  credit?: number;
  description?: string;
};

export type TrialBalanceRow = {
  accountId: string;
  code: string;
  name: string;
  type: string;
  debit: number;
  credit: number;
};

export type LedgerReportLine = {
  date: string;
  entryNumber: string;
  memo: string | null;
  source: string;
  debit: number;
  credit: number;
  balance: number;
  description: string | null;
};

export type ProfitLossReport = {
  income: { code: string; name: string; amount: number }[];
  expenses: { code: string; name: string; amount: number }[];
  totalIncome: number;
  costOfSales: number;
  grossProfit: number;
  totalExpense: number;
  netProfit: number;
  grossMargin: number;
  netMargin: number;
};

export type BalanceSheetReport = {
  assets: { code: string; name: string; amount: number }[];
  liabilities: { code: string; name: string; amount: number }[];
  equity: { code: string; name: string; amount: number }[];
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  totalLiabAndEquity: number;
  balanced: boolean;
};

export type PartyLedgerRow = {
  id: string;
  name: string;
  phone?: string | null;
  billed: number;
  paid: number;
  outstanding: number;
};

export type AccountSummaryRow = {
  accountId: string;
  code: string;
  name: string;
  type: ChartAccount["type"];
  currency: string;
  balance: number;
};

export type AccountSummaryBucket = {
  rows: AccountSummaryRow[];
  total: number;
};

export type CashAndBankSummary = {
  bankRows: AccountSummaryRow[];
  bankTotal: number;
  cashRows: AccountSummaryRow[];
  cashTotal: number;
  grandTotal: number;
};

export type UpcomingLoanRepayment = LoanRepayment & {
  loan_account: Pick<ChartAccount, "id" | "code" | "name" | "currency"> | null;
};

export type AccountingHomeSummary = {
  cashbank: CashAndBankSummary;
  loans: AccountSummaryBucket;
  upcoming: UpcomingLoanRepayment[];
  debtors: AccountSummaryBucket;
  creditors: AccountSummaryBucket;
  accruals: AccountSummaryBucket;
};

export type CashBookAccount = AccountingCashAccount & {
  chart_account: Pick<ChartAccount, "id" | "code" | "name" | "type" | "normal_balance" | "currency" | "is_active"> | null;
  currentBalance: number;
};

export type CashBookTransactionRow = {
  id: string;
  cashAccountId: string;
  accountName: string;
  accountKind: "bank" | "cash";
  date: string;
  referenceNumber: string;
  description: string;
  transactionType: string;
  debit: number;
  credit: number;
  runningBalance: number;
  user: string;
  journalEntryId: string;
};

export type BankReconciliationRow = AccountingBankReconciliation & {
  cash_account?: Pick<AccountingCashAccount, "account_name" | "account_kind"> | null;
};

export type RevenueInvoice = AccountingInvoice & {
  customer: Pick<Customer, "id" | "name" | "phone"> | null;
  accounting_invoice_lines?: AccountingInvoiceLine[];
};

export type RevenueCreditNote = AccountingCreditNote & {
  customer: Pick<Customer, "id" | "name" | "phone"> | null;
  invoice?: Pick<AccountingInvoice, "id" | "invoice_number"> | null;
};

export type CogsEntryRow = AccountingCogsEntry & {
  invoice?: Pick<AccountingInvoice, "id" | "invoice_number"> | null;
};

export type OperatingExpenseRow = AccountingOperatingExpense & {
  payment_account?: Pick<ChartAccount, "id" | "code" | "name"> | null;
};

export type ChartsDashboardSummary = {
  totalCashBookBalance: number;
  totalRevenue: number;
  totalCostOfGoodsSold: number;
  grossProfit: number;
  totalAdministrativeExpenses: number;
  totalFinanceCharges: number;
  totalOtherOperatingExpenses: number;
  totalOperatingExpenses: number;
  netProfitLoss: number;
  outstandingInvoices: number;
  paidInvoices: number;
  overdueInvoices: number;
  creditNotesIssued: number;
  netRevenue: number;
};

export type AccountTreeAccount = {
  id: string;
  code: string;
  name: string;
  type: ChartAccount["type"];
  classification: Classification | null;
  classificationLabel: string;
  currency: string;
  vatApplicable: boolean;
  isPostable: boolean;
  parentId: string | null;
  balance: number;
};

export type SeedChartResult = {
  success: boolean;
  created: number;
  total: number;
  templateTotal?: number;
  taxCodes?: number;
};

export type AccountTreeGroup = {
  key: StatementGroup;
  label: string;
  statement: "BALANCE_SHEET" | "INCOME_STATEMENT";
  accounts: AccountTreeAccount[];
  total: number;
};

export type ParentAccountOption = {
  id: string;
  code: string;
  name: string;
};

type PostedEntry = AccountingJournalEntry & {
  accounting_journal_lines?: AccountingJournalLine[];
};

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const num = (n: unknown) => Number(n ?? 0);

function dateOnly(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function dateEnd(value: string) {
  return `${value}T23:59:59.999Z`;
}

function toDbLines(lines: JournalLineInput[]) {
  return lines.map((line) => ({
    account_id: line.accountId,
    debit: line.debit ?? 0,
    credit: line.credit ?? 0,
    description: line.description ?? null,
  }));
}

async function postedEntries(input?: { from?: string; to?: string }): Promise<PostedEntry[]> {
  let q = supabase
    .from("accounting_journal_entries")
    .select("*, accounting_journal_lines(*)")
    .eq("status", "POSTED")
    .order("date", { ascending: true });

  if (input?.from) q = q.gte("date", input.from);
  if (input?.to) q = q.lte("date", dateEnd(input.to));

  return q.then(unwrap<PostedEntry[]>);
}

function postedEntryLines(entry: PostedEntry) {
  return entry.accounting_journal_lines ?? [];
}

function postedLineAccountId(line: AccountingJournalLine) {
  return line.chart_account_id ?? line.account_id;
}

function aggregateLines(entries: PostedEntry[]) {
  const totals = new Map<string, { debit: number; credit: number }>();
  for (const entry of entries) {
    for (const line of postedEntryLines(entry)) {
      const accountId = postedLineAccountId(line);
      if (!accountId) continue;
      const cur = totals.get(accountId) ?? { debit: 0, credit: 0 };
      cur.debit += num(line.debit);
      cur.credit += num(line.credit);
      totals.set(accountId, cur);
    }
  }
  return totals;
}

function accountStatementGroup(account: ChartAccount): StatementGroup {
  if (account.statement_group) return account.statement_group;
  if (account.classification && CLASSIFICATION_MAP[account.classification]) {
    return CLASSIFICATION_MAP[account.classification].group;
  }

  const code = account.code || "";
  if (account.type === "ASSET") return code.startsWith("15") ? "NON_CURRENT_ASSETS" : "CURRENT_ASSETS";
  if (account.type === "LIABILITY") return code.startsWith("23") ? "NON_CURRENT_LIABILITIES" : "CURRENT_LIABILITIES";
  if (account.type === "EQUITY") return "EQUITY";
  if (account.type === "INCOME") return code === "4000" ? "REVENUE" : "OTHER_INCOME";
  if (account.type === "EXPENSE") {
    if (code === "5000") return "COST_OF_GOODS_SOLD";
    if (code === "5400") return "FINANCE_CHARGES";
    return "ADMINISTRATIVE_EXPENSES";
  }

  return "CURRENT_ASSETS";
}

function accountBalance(account: ChartAccount, totals: Map<string, { debit: number; credit: number }>) {
  const sum = totals.get(account.id) ?? { debit: 0, credit: 0 };
  const net = sum.debit - sum.credit;
  return r2(account.normal_balance === "DEBIT" ? net : -net);
}

function accountSummaryRow(account: ChartAccount, totals: Map<string, { debit: number; credit: number }>): AccountSummaryRow {
  return {
    accountId: account.id,
    code: account.code,
    name: account.name,
    type: account.type,
    currency: account.currency ?? "KES",
    balance: accountBalance(account, totals),
  };
}

function accountSummaryBucket(
  accounts: ChartAccount[],
  totals: Map<string, { debit: number; credit: number }>,
  predicate: (account: ChartAccount) => boolean,
): AccountSummaryBucket {
  const rows = accounts.filter(predicate).map((account) => accountSummaryRow(account, totals));
  return {
    rows,
    total: r2(rows.reduce((sum, row) => sum + row.balance, 0)),
  };
}

function isCashOrBankAccount(account: ChartAccount) {
  return account.classification === "BANK" || account.is_bank || account.description === "key:cash_on_hand";
}

function isPostableAccount(account: ChartAccount) {
  return account.is_postable !== false;
}

function isCashInHandAccount(account: ChartAccount) {
  const name = account.name.toLowerCase();
  return account.description === "key:cash_on_hand" || ((name.includes("cash") && !name.includes("bank")) || name.includes("petty"));
}

function isDebtorAccount(account: ChartAccount) {
  return account.classification === "ACCOUNTS_RECEIVABLE" || account.description === "key:accounts_receivable";
}

function isCreditorAccount(account: ChartAccount) {
  return account.classification === "ACCOUNTS_PAYABLE" || account.description === "key:accounts_payable";
}

function isAccrualAccount(account: ChartAccount) {
  return account.classification === "OTHER_CURRENT_LIABILITY";
}

function isLoanAccount(account: ChartAccount) {
  return account.classification === "LOAN" || account.classification === "LONG_TERM_LIABILITY" || (account.type === "LIABILITY" && account.code.startsWith("23"));
}

async function generalLedgerSource(input?: { from?: string; to?: string }) {
  const [accounts, entries] = await Promise.all([
    accountingApi.listActiveAccounts(),
    postedEntries(input),
  ]);
  return {
    accounts,
    entries,
    totals: aggregateLines(entries),
  };
}

export const accountingApi = {
  seedChart: () => supabase.rpc("seed_chart_of_accounts").then(unwrap<SeedChartResult>),
  listAccounts: () =>
    supabase.from("chart_account").select("*").order("code").then(unwrap<ChartAccount[]>),
  listActiveAccounts: () =>
    supabase.from("chart_account").select("*").eq("is_active", true).order("code").then(unwrap<ChartAccount[]>),
  createAccount: (input: {
    code: string;
    name: string;
    type: ChartAccount["type"];
    normalBalance?: ChartAccount["normal_balance"];
    isBank?: boolean;
  }) => {
    const normalBalance = input.normalBalance ?? (["ASSET", "EXPENSE"].includes(input.type) ? "DEBIT" : "CREDIT");
    return supabase
      .from("chart_account")
      .insert({
        code: input.code.trim(),
        name: input.name.trim(),
        type: input.type,
        normal_balance: normalBalance,
        is_bank: input.isBank ?? false,
        is_system: false,
      })
      .select("id")
      .single()
      .then(unwrap<{ id: string }>);
  },
  createClassifiedAccount: (input: {
    name: string;
    currency?: string;
    classification: Classification;
    statementGroup?: StatementGroup | null;
    parentId?: string | null;
    description?: string | null;
    note?: string | null;
    vatApplicable?: boolean;
  }) =>
    supabase
      .rpc("create_classified_account", {
        p_name: input.name,
        p_currency: input.currency ?? "KES",
        p_classification: input.classification,
        p_statement_group: input.statementGroup ?? null,
        p_parent_id: input.parentId ?? null,
        p_description: input.description ?? null,
        p_note: input.note ?? null,
        p_vat_applicable: input.vatApplicable ?? false,
      })
      .then(unwrap<{ success: boolean; account_id: string; accountId: string; code: string }>),
  updateAccount: (input: { id: string; name?: string; isActive?: boolean; isBank?: boolean }) =>
    supabase
      .from("chart_account")
      .update({
        ...(input.name != null ? { name: input.name.trim() } : {}),
        ...(input.isActive != null ? { is_active: input.isActive } : {}),
        ...(input.isBank != null ? { is_bank: input.isBank } : {}),
      })
      .eq("id", input.id)
      .then(unwrap),
  postJournal: (input: { date: string; memo?: string; lines: JournalLineInput[] }) =>
    supabase
      .rpc("post_journal_entry", {
        p_date: input.date,
        p_memo: input.memo ?? null,
        p_source: "MANUAL",
        p_source_type: "ManualJournal",
        p_source_id: null,
        p_lines: toDbLines(input.lines),
      })
      .then(unwrap<{ success?: boolean; entry_number: string; entryNumber: string }>),
  listJournalEntries: () => postedEntries(),
  getAccountTree: async (): Promise<AccountTreeGroup[]> => {
    const [accounts, entries] = await Promise.all([
      accountingApi.listActiveAccounts(),
      postedEntries(),
    ]);
    const totals = aggregateLines(entries);
    const byGroup = new Map<StatementGroup, AccountTreeAccount[]>();

    for (const account of accounts) {
      const group = accountStatementGroup(account);
      const sum = totals.get(account.id) ?? { debit: 0, credit: 0 };
      const net = sum.debit - sum.credit;
      const balance = account.normal_balance === "DEBIT" ? net : -net;
      const classificationLabel = account.classification
        ? CLASSIFICATION_MAP[account.classification]?.label ?? account.classification
        : account.type;
      const rows = byGroup.get(group) ?? [];

      rows.push({
        id: account.id,
        code: account.code,
        name: account.name,
        type: account.type,
        classification: account.classification,
        classificationLabel,
        currency: account.currency ?? "KES",
        vatApplicable: Boolean(account.tax_code_id ?? account.vat_applicable),
        isPostable: isPostableAccount(account),
        parentId: account.parent_id,
        balance: r2(balance),
      });
      byGroup.set(group, rows);
    }

    return STATEMENT_GROUPS.map((group) => {
      const accountsInGroup = byGroup.get(group.key) ?? [];
      return {
        ...group,
        accounts: accountsInGroup,
        total: r2(accountsInGroup.reduce((sum, account) => sum + account.balance, 0)),
      };
    });
  },
  getParentAccountOptions: async (): Promise<ParentAccountOption[]> => {
    const accounts = await accountingApi.listActiveAccounts();
    return accounts.map((account) => ({
      id: account.id,
      code: account.code,
      name: account.name,
    }));
  },
  listSuppliers: () =>
    supabase.from("suppliers").select("*").order("name").then(unwrap<Supplier[]>),
  listUpcomingLoanRepayments: async (withinDays = 30) => {
    const today = dateOnly(new Date());
    const horizon = dateOnly(addDays(new Date(), withinDays));
    const res = await supabase
      .from("loan_repayments")
      .select("*, loan_account:chart_account(id, code, name, currency)")
      .eq("is_paid", false)
      .gte("due_date", today)
      .lte("due_date", horizon)
      .order("due_date");

    if (res.error) {
      const message = res.error.message.toLowerCase();
      if (message.includes("loan_repayments") || message.includes("schema cache")) return [];
      throw new Error(res.error.message);
    }
    return res.data as UpcomingLoanRepayment[];
  },
  getAccountingHomeSummary: async (): Promise<AccountingHomeSummary> => {
    const [accounts, entries, upcoming] = await Promise.all([
      accountingApi.listActiveAccounts(),
      postedEntries(),
      accountingApi.listUpcomingLoanRepayments(30),
    ]);
    const totals = aggregateLines(entries);
    const bankRows: AccountSummaryRow[] = [];
    const cashRows: AccountSummaryRow[] = [];

    for (const account of accounts.filter((account) => isPostableAccount(account) && isCashOrBankAccount(account))) {
      const row = accountSummaryRow(account, totals);
      if (isCashInHandAccount(account)) cashRows.push(row);
      else bankRows.push(row);
    }

    const bankTotal = r2(bankRows.reduce((sum, row) => sum + row.balance, 0));
    const cashTotal = r2(cashRows.reduce((sum, row) => sum + row.balance, 0));

    return {
      cashbank: {
        bankRows,
        bankTotal,
        cashRows,
        cashTotal,
        grandTotal: r2(bankTotal + cashTotal),
      },
      loans: accountSummaryBucket(accounts, totals, (account) => isPostableAccount(account) && isLoanAccount(account)),
      upcoming,
      debtors: accountSummaryBucket(accounts, totals, (account) => isPostableAccount(account) && isDebtorAccount(account)),
      creditors: accountSummaryBucket(accounts, totals, (account) => isPostableAccount(account) && isCreditorAccount(account)),
      accruals: accountSummaryBucket(accounts, totals, (account) => isPostableAccount(account) && isAccrualAccount(account)),
    };
  },
  listCashBookAccounts: async (): Promise<CashBookAccount[]> => {
    const [rows, entries] = await Promise.all([
      supabase
        .from("accounting_cash_accounts")
        .select("*, chart_account:chart_account(id, code, name, type, normal_balance, currency, is_active)")
        .order("account_kind")
        .order("account_name")
        .then(unwrap<(AccountingCashAccount & {
          chart_account: Pick<ChartAccount, "id" | "code" | "name" | "type" | "normal_balance" | "currency" | "is_active"> | null;
        })[]>),
      postedEntries(),
    ]);
    const totals = aggregateLines(entries);

    return rows.map((row) => ({
      ...row,
      currentBalance: row.chart_account
        ? accountBalance(row.chart_account as ChartAccount, totals)
        : r2(num(row.current_balance)),
    }));
  },
  listCashBookTransactions: async (): Promise<CashBookTransactionRow[]> => {
    const [cashAccounts, entries, cashTransactions, users] = await Promise.all([
      accountingApi.listCashBookAccounts(),
      postedEntries(),
      supabase
        .from("accounting_cash_transactions")
        .select("*")
        .order("date", { ascending: true })
        .then(unwrap<AccountingCashTransaction[]>),
      supabase
        .from("app_users")
        .select("id, name")
        .then(unwrap<Pick<AppUser, "id" | "name">[]>),
    ]);
    const accountByChartId = new Map(
      cashAccounts
        .filter((account) => account.chart_account)
        .map((account) => [account.chart_account!.id, account]),
    );
    const transactionByEntryId = new Map(
      cashTransactions
        .filter((transaction) => transaction.journal_entry_id)
        .map((transaction) => [transaction.journal_entry_id!, transaction]),
    );
    const userById = new Map(users.map((user) => [user.id, user.name ?? "Unknown"]));
    const running = new Map(cashAccounts.map((account) => [account.id, num(account.opening_balance)]));
    const rows: CashBookTransactionRow[] = [];

    for (const entry of entries) {
      for (const line of postedEntryLines(entry)) {
        const accountId = postedLineAccountId(line);
        if (!accountId) continue;
        const cashAccount = accountByChartId.get(accountId);
        if (!cashAccount) continue;
        const debit = num(line.debit);
        const credit = num(line.credit);
        const nextBalance = r2((running.get(cashAccount.id) ?? num(cashAccount.opening_balance)) + debit - credit);
        running.set(cashAccount.id, nextBalance);
        const cashTransaction = transactionByEntryId.get(entry.id);
        rows.push({
          id: cashTransaction?.id ?? line.id,
          cashAccountId: cashAccount.id,
          accountName: cashAccount.account_name,
          accountKind: cashAccount.account_kind,
          date: entry.date,
          referenceNumber: cashTransaction?.reference_number ?? cashTransaction?.transaction_number ?? entry.entry_number,
          description: cashTransaction?.description ?? line.description ?? entry.memo ?? "-",
          transactionType: cashTransaction?.transaction_type ?? entry.source,
          debit,
          credit,
          runningBalance: nextBalance,
          user: userById.get(entry.posted_by ?? entry.created_by ?? "") ?? "Unknown",
          journalEntryId: entry.id,
        });
      }
    }

    return rows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  },
  listBankReconciliations: () =>
    supabase
      .from("accounting_bank_reconciliations")
      .select("*, cash_account:accounting_cash_accounts(account_name, account_kind)")
      .order("statement_date", { ascending: false })
      .then(unwrap<BankReconciliationRow[]>),
  listRevenueInvoices: () =>
    supabase
      .from("accounting_invoices")
      .select("*, customer:customers(id, name, phone), accounting_invoice_lines(*)")
      .order("date", { ascending: false })
      .then(unwrap<RevenueInvoice[]>),
  listCreditNotes: () =>
    supabase
      .from("accounting_credit_notes")
      .select("*, customer:customers(id, name, phone), invoice:accounting_invoices(id, invoice_number)")
      .order("date", { ascending: false })
      .then(unwrap<RevenueCreditNote[]>),
  listCogsEntries: () =>
    supabase
      .from("accounting_cogs_entries")
      .select("*, invoice:accounting_invoices(id, invoice_number)")
      .order("date", { ascending: false })
      .then(unwrap<CogsEntryRow[]>),
  listOperatingExpenses: (group?: AccountingOperatingExpense["expense_group"]) => {
    let q = supabase
      .from("accounting_expense_entries")
      .select("*, payment_account:chart_account(id, code, name)")
      .order("date", { ascending: false });
    if (group) q = q.eq("expense_group", group);
    return q.then(unwrap<OperatingExpenseRow[]>);
  },
  getChartsDashboardSummary: async (): Promise<ChartsDashboardSummary> => {
    const [cashAccounts, invoices, creditNotes, cogsEntries, operatingExpenses] = await Promise.all([
      accountingApi.listCashBookAccounts(),
      accountingApi.listRevenueInvoices(),
      accountingApi.listCreditNotes(),
      accountingApi.listCogsEntries(),
      accountingApi.listOperatingExpenses(),
    ]);
    const today = new Date(dateOnly(new Date()));
    const approvedInvoices = invoices.filter((invoice) => invoice.status !== "void");
    const totalRevenue = r2(approvedInvoices.reduce((sum, invoice) => sum + num(invoice.net_amount), 0));
    const creditNotesIssued = r2(creditNotes.filter((note) => note.status !== "void").reduce((sum, note) => sum + num(note.amount), 0));
    const totalCostOfGoodsSold = r2(cogsEntries.filter((entry) => entry.status !== "void").reduce((sum, entry) => sum + num(entry.total_amount), 0));
    const groupTotal = (group: AccountingOperatingExpense["expense_group"]) =>
      r2(operatingExpenses
        .filter((expense) => expense.status !== "void" && expense.expense_group === group)
        .reduce((sum, expense) => sum + num(expense.amount), 0));
    const totalAdministrativeExpenses = groupTotal("administrative");
    const totalFinanceCharges = groupTotal("finance");
    const totalOtherOperatingExpenses = groupTotal("other_operating");
    const totalOperatingExpenses = r2(totalAdministrativeExpenses + totalFinanceCharges + totalOtherOperatingExpenses);
    const netRevenue = r2(totalRevenue - creditNotesIssued);
    const grossProfit = r2(totalRevenue - totalCostOfGoodsSold);

    return {
      totalCashBookBalance: r2(cashAccounts.reduce((sum, account) => sum + account.currentBalance, 0)),
      totalRevenue,
      totalCostOfGoodsSold,
      grossProfit,
      totalAdministrativeExpenses,
      totalFinanceCharges,
      totalOtherOperatingExpenses,
      totalOperatingExpenses,
      netProfitLoss: r2(grossProfit - totalOperatingExpenses),
      outstandingInvoices: r2(approvedInvoices.filter((invoice) => !["paid", "void"].includes(invoice.status)).reduce((sum, invoice) => sum + num(invoice.total_amount), 0)),
      paidInvoices: r2(approvedInvoices.filter((invoice) => invoice.status === "paid").reduce((sum, invoice) => sum + num(invoice.total_amount), 0)),
      overdueInvoices: r2(approvedInvoices
        .filter((invoice) => invoice.due_date && invoice.status !== "paid" && new Date(invoice.due_date) < today)
        .reduce((sum, invoice) => sum + num(invoice.total_amount), 0)),
      creditNotesIssued,
      netRevenue,
    };
  },
  createCashBookAccount: (input: {
    accountKind: "bank" | "cash";
    accountName: string;
    bankName?: string;
    accountNumber?: string;
    branch?: string;
    openingBalance: number;
    status?: "active" | "inactive";
  }) =>
    supabase.rpc("create_cash_book_account", {
      p_account_kind: input.accountKind,
      p_account_name: input.accountName,
      p_bank_name: input.bankName ?? null,
      p_account_number: input.accountNumber ?? null,
      p_branch: input.branch ?? null,
      p_opening_balance: input.openingBalance,
      p_status: input.status ?? "active",
    }).then(unwrap<{ success: boolean; cash_account_id: string; chart_account_id: string; code: string }>),
  postCashBookTransaction: (input: {
    cashAccountId: string;
    date: string;
    transactionType: string;
    direction: "debit_cash" | "credit_cash";
    amount: number;
    offsetAccountId: string;
    description?: string;
    referenceNumber?: string;
  }) =>
    supabase.rpc("post_cash_book_transaction", {
      p_cash_account_id: input.cashAccountId,
      p_date: input.date,
      p_transaction_type: input.transactionType,
      p_direction: input.direction,
      p_amount: input.amount,
      p_offset_account_id: input.offsetAccountId,
      p_description: input.description ?? null,
      p_reference_number: input.referenceNumber ?? null,
    }).then(unwrap<{ success: boolean; transactionNumber: string; entryNumber: string }>),
  createBankReconciliation: (input: {
    cashAccountId: string;
    statementDate: string;
    statementBalance: number;
    notes?: string;
  }) =>
    supabase.rpc("create_bank_reconciliation", {
      p_cash_account_id: input.cashAccountId,
      p_statement_date: input.statementDate,
      p_statement_balance: input.statementBalance,
      p_notes: input.notes ?? null,
    }).then(unwrap<{ success: boolean; reconciliation_number: string }>),
  postCustomerInvoice: (input: {
    customerId: string;
    invoiceDate: string;
    dueDate?: string | null;
    branch?: string;
    salesPerson?: string;
    paymentTerms?: string;
    notes?: string;
    lines: { item: string; quantity: number; unitPrice: number; discount: number; tax: number }[];
  }) =>
    supabase.rpc("post_customer_invoice", {
      p_customer_id: input.customerId,
      p_invoice_date: input.invoiceDate,
      p_due_date: input.dueDate ?? null,
      p_branch: input.branch ?? null,
      p_sales_person: input.salesPerson ?? null,
      p_payment_terms: input.paymentTerms ?? null,
      p_notes: input.notes ?? null,
      p_lines: input.lines.map((line) => ({
        item: line.item,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        discount: line.discount,
        tax: line.tax,
      })),
    }).then(unwrap<{ success: boolean; invoiceNumber: string; entryNumber: string }>),
  postCreditNote: (input: {
    invoiceId?: string | null;
    customerId: string;
    branch?: string;
    reason: string;
    date: string;
    amount: number;
    notes?: string;
  }) =>
    supabase.rpc("post_credit_note", {
      p_invoice_id: input.invoiceId ?? null,
      p_customer_id: input.customerId,
      p_branch: input.branch ?? null,
      p_reason: input.reason,
      p_date: input.date,
      p_amount: input.amount,
      p_notes: input.notes ?? null,
    }).then(unwrap<{ success: boolean; creditNoteNumber: string; entryNumber: string }>),
  postCogsEntry: (input: {
    date: string;
    branch?: string;
    invoiceId?: string | null;
    productService?: string;
    project?: string;
    directMaterialCost: number;
    directLabourCost: number;
    productionServiceCost: number;
    purchaseCost: number;
    paymentAccountId?: string | null;
    notes?: string;
  }) =>
    supabase.rpc("post_cogs_entry", {
      p_date: input.date,
      p_branch: input.branch ?? null,
      p_invoice_id: input.invoiceId ?? null,
      p_product_service: input.productService ?? null,
      p_project: input.project ?? null,
      p_direct_material_cost: input.directMaterialCost,
      p_direct_labour_cost: input.directLabourCost,
      p_production_service_cost: input.productionServiceCost,
      p_purchase_cost: input.purchaseCost,
      p_payment_account_id: input.paymentAccountId ?? null,
      p_notes: input.notes ?? null,
    }).then(unwrap<{ success: boolean; cogsNumber: string; entryNumber: string }>),
  postOperatingExpense: (input: {
    expenseGroup: AccountingOperatingExpense["expense_group"];
    date: string;
    payee: string;
    branch?: string;
    description?: string;
    category: string;
    amount: number;
    paymentMethod: string;
    referenceNumber?: string;
    paymentAccountId?: string | null;
  }) =>
    supabase.rpc("post_operating_expense", {
      p_expense_group: input.expenseGroup,
      p_date: input.date,
      p_payee: input.payee,
      p_branch: input.branch ?? null,
      p_description: input.description ?? null,
      p_category: input.category,
      p_amount: input.amount,
      p_payment_method: input.paymentMethod,
      p_reference_number: input.referenceNumber ?? null,
      p_payment_account_id: input.paymentAccountId ?? null,
    }).then(unwrap<{ success: boolean; expenseNumber: string; entryNumber: string }>),
  createSupplier: (input: { name: string; phone?: string; email?: string; location?: string; notes?: string }) =>
    supabase
      .from("suppliers")
      .insert({
        name: input.name.trim(),
        phone: input.phone?.trim() ?? "",
        email: input.email?.trim() || null,
        location: input.location?.trim() || null,
        notes: input.notes?.trim() || null,
      })
      .select("id")
      .single()
      .then(unwrap<{ id: string }>),
  listInvoices: () =>
    supabase
      .from("accounting_invoices")
      .select("*, customer:customers(name, phone)")
      .order("date", { ascending: false })
      .then(unwrap<(AccountingInvoice & { customer: { name: string; phone: string } | null })[]>),
  listBills: () =>
    supabase
      .from("accounting_bills")
      .select("*, supplier:suppliers(name, phone)")
      .order("date", { ascending: false })
      .then(unwrap<(AccountingBill & { supplier: { name: string; phone: string } | null })[]>),
  listExpenses: () =>
    supabase
      .from("accounting_expenses")
      .select("*, supplier:suppliers(name)")
      .order("date", { ascending: false })
      .then(unwrap<(AccountingExpense & { supplier: { name: string } | null })[]>),
  listPayments: () =>
    supabase
      .from("accounting_payments")
      .select("*, customer:customers(name), supplier:suppliers(name)")
      .order("date", { ascending: false })
      .then(unwrap<(AccountingPayment & { customer: { name: string } | null; supplier: { name: string } | null })[]>),
  postInvoice: (input: {
    customerId: string;
    jobId?: string | null;
    date: string;
    dueDate?: string | null;
    amount: number;
    hasVat: boolean;
    memo?: string;
  }) =>
    supabase.rpc("post_accounting_invoice", {
      p_customer_id: input.customerId,
      p_job_id: input.jobId ?? null,
      p_date: input.date,
      p_due_date: input.dueDate ?? null,
      p_amount: input.amount,
      p_has_vat: input.hasVat,
      p_memo: input.memo ?? null,
    }).then(unwrap<{ success: boolean; invoiceNumber: string; entryNumber: string }>),
  postBill: (input: {
    supplierId: string;
    accountId: string;
    date: string;
    dueDate?: string | null;
    amount: number;
    hasVat: boolean;
    memo?: string;
  }) =>
    supabase.rpc("post_accounting_bill", {
      p_supplier_id: input.supplierId,
      p_account_id: input.accountId,
      p_date: input.date,
      p_due_date: input.dueDate ?? null,
      p_amount: input.amount,
      p_has_vat: input.hasVat,
      p_memo: input.memo ?? null,
    }).then(unwrap<{ success: boolean; billNumber: string; entryNumber: string }>),
  postExpense: (input: {
    expenseAccountId: string;
    bankAccountId?: string | null;
    supplierId?: string | null;
    vendorName?: string;
    date: string;
    amount: number;
    hasVat: boolean;
    memo?: string;
    reference?: string;
  }) =>
    supabase.rpc("post_accounting_expense", {
      p_expense_account_id: input.expenseAccountId,
      p_bank_account_id: input.bankAccountId ?? null,
      p_supplier_id: input.supplierId ?? null,
      p_vendor_name: input.vendorName ?? null,
      p_date: input.date,
      p_amount: input.amount,
      p_has_vat: input.hasVat,
      p_memo: input.memo ?? null,
      p_reference: input.reference ?? null,
    }).then(unwrap<{ success: boolean; expenseNumber: string; entryNumber: string }>),
  recordPayment: (input: {
    direction: "received" | "paid";
    customerId?: string | null;
    supplierId?: string | null;
    invoiceId?: string | null;
    billId?: string | null;
    bankAccountId?: string | null;
    date: string;
    amount: number;
    method?: string;
    reference?: string;
    notes?: string;
  }) =>
    supabase.rpc("record_accounting_payment", {
      p_direction: input.direction,
      p_customer_id: input.customerId ?? null,
      p_supplier_id: input.supplierId ?? null,
      p_invoice_id: input.invoiceId ?? null,
      p_bill_id: input.billId ?? null,
      p_bank_account_id: input.bankAccountId ?? null,
      p_date: input.date,
      p_amount: input.amount,
      p_method: input.method ?? "bank_transfer",
      p_reference: input.reference ?? null,
      p_notes: input.notes ?? null,
    }).then(unwrap<{ success: boolean; paymentNumber: string; entryNumber: string }>),
  getTrialBalance: async (asOf?: string) => {
    const { accounts, totals } = await generalLedgerSource(asOf ? { to: asOf } : undefined);
    let totalDebit = 0;
    let totalCredit = 0;
    const rows: TrialBalanceRow[] = [];

    for (const account of accounts) {
      const sum = totals.get(account.id) ?? { debit: 0, credit: 0 };
      const net = sum.debit - sum.credit;
      const debit = net > 0 ? r2(net) : 0;
      const credit = net < 0 ? r2(-net) : 0;
      if (debit === 0 && credit === 0) continue;
      totalDebit += debit;
      totalCredit += credit;
      rows.push({
        accountId: account.id,
        code: account.code,
        name: account.name,
        type: account.type,
        debit,
        credit,
      });
    }

    return {
      asOf: asOf ?? new Date().toISOString().slice(0, 10),
      rows,
      totalDebit: r2(totalDebit),
      totalCredit: r2(totalCredit),
      balanced: Math.abs(totalDebit - totalCredit) < 0.01,
    };
  },
  getGeneralLedger: async (input: { accountId?: string; from?: string; to?: string }) => {
    const { accounts, entries: allEntries } = await generalLedgerSource({ to: input.to });
    if (!input.accountId) {
      return { accounts, account: null, openingBalance: 0, lines: [] as LedgerReportLine[] };
    }

    const account = accounts.find((a) => a.id === input.accountId) ?? null;
    if (!account) return { accounts, account: null, openingBalance: 0, lines: [] as LedgerReportLine[] };

    let openingBalance = 0;
    const lines: LedgerReportLine[] = [];

    for (const entry of allEntries) {
      const entryDate = new Date(entry.date);
      const beforeFrom = input.from ? entryDate < new Date(input.from) : false;
      for (const line of postedEntryLines(entry)) {
        const accountId = postedLineAccountId(line);
        if (accountId !== input.accountId) continue;
        const debit = num(line.debit);
        const credit = num(line.credit);
        const movement = account.normal_balance === "DEBIT" ? debit - credit : credit - debit;
        if (beforeFrom) {
          openingBalance += movement;
          continue;
        }
        const nextBalance = (lines.at(-1)?.balance ?? openingBalance) + movement;
        lines.push({
          date: entry.date,
          entryNumber: entry.entry_number,
          memo: entry.memo,
          source: entry.source,
          debit,
          credit,
          balance: r2(nextBalance),
          description: line.description,
        });
      }
    }

    return { accounts, account, openingBalance: r2(openingBalance), lines };
  },
  getProfitAndLoss: async (input?: { from?: string; to?: string }): Promise<ProfitLossReport> => {
    const { accounts, totals } = await generalLedgerSource(input);
    const income: ProfitLossReport["income"] = [];
    const expenses: ProfitLossReport["expenses"] = [];
    let totalIncome = 0;
    let totalExpense = 0;
    let costOfSales = 0;

    for (const account of accounts) {
      const sum = totals.get(account.id) ?? { debit: 0, credit: 0 };
      if (account.type === "INCOME") {
        const amount = sum.credit - sum.debit;
        if (amount !== 0) {
          income.push({ code: account.code, name: account.name, amount: r2(amount) });
          totalIncome += amount;
        }
      } else if (account.type === "EXPENSE") {
        const amount = sum.debit - sum.credit;
        if (amount !== 0) {
          expenses.push({ code: account.code, name: account.name, amount: r2(amount) });
          totalExpense += amount;
          if (accountStatementGroup(account) === "COST_OF_GOODS_SOLD") costOfSales += amount;
        }
      }
    }

    const grossProfit = totalIncome - costOfSales;
    const netProfit = totalIncome - totalExpense;
    return {
      income,
      expenses,
      totalIncome: r2(totalIncome),
      costOfSales: r2(costOfSales),
      grossProfit: r2(grossProfit),
      totalExpense: r2(totalExpense),
      netProfit: r2(netProfit),
      grossMargin: totalIncome ? r2((grossProfit / totalIncome) * 100) : 0,
      netMargin: totalIncome ? r2((netProfit / totalIncome) * 100) : 0,
    };
  },
  getBalanceSheet: async (asOf?: string): Promise<BalanceSheetReport> => {
    const { accounts, totals } = await generalLedgerSource(asOf ? { to: asOf } : undefined);
    const assets: BalanceSheetReport["assets"] = [];
    const liabilities: BalanceSheetReport["liabilities"] = [];
    const equity: BalanceSheetReport["equity"] = [];
    let totalAssets = 0;
    let totalLiabilities = 0;
    let totalEquity = 0;
    let income = 0;
    let expenses = 0;

    for (const account of accounts) {
      const sum = totals.get(account.id) ?? { debit: 0, credit: 0 };
      if (account.type === "ASSET") {
        const amount = sum.debit - sum.credit;
        if (amount !== 0) {
          assets.push({ code: account.code, name: account.name, amount: r2(amount) });
          totalAssets += amount;
        }
      } else if (account.type === "LIABILITY") {
        const amount = sum.credit - sum.debit;
        if (amount !== 0) {
          liabilities.push({ code: account.code, name: account.name, amount: r2(amount) });
          totalLiabilities += amount;
        }
      } else if (account.type === "EQUITY") {
        const amount = sum.credit - sum.debit;
        if (amount !== 0) {
          equity.push({ code: account.code, name: account.name, amount: r2(amount) });
          totalEquity += amount;
        }
      } else if (account.type === "INCOME") {
        income += sum.credit - sum.debit;
      } else if (account.type === "EXPENSE") {
        expenses += sum.debit - sum.credit;
      }
    }

    const currentEarnings = income - expenses;
    if (currentEarnings !== 0) {
      equity.push({ code: "-", name: "Current Year Earnings", amount: r2(currentEarnings) });
      totalEquity += currentEarnings;
    }
    const totalLiabAndEquity = totalLiabilities + totalEquity;
    return {
      assets,
      liabilities,
      equity,
      totalAssets: r2(totalAssets),
      totalLiabilities: r2(totalLiabilities),
      totalEquity: r2(totalEquity),
      totalLiabAndEquity: r2(totalLiabAndEquity),
      balanced: Math.abs(totalAssets - totalLiabAndEquity) < 0.01,
    };
  },
  getCustomerLedger: async () => {
    const [customers, invoices, payments] = await Promise.all([
      customersApi.list(),
      supabase.from("accounting_invoices").select("*").neq("status", "void").then(unwrap<AccountingInvoice[]>),
      supabase.from("accounting_payments").select("*").eq("direction", "received").then(unwrap<AccountingPayment[]>),
    ]);
    const billed = new Map<string, number>();
    const paid = new Map<string, number>();
    for (const invoice of invoices) billed.set(invoice.customer_id, (billed.get(invoice.customer_id) ?? 0) + num(invoice.total_amount));
    for (const payment of payments) {
      if (payment.customer_id) paid.set(payment.customer_id, (paid.get(payment.customer_id) ?? 0) + num(payment.amount));
    }
    const rows = customers.map((customer) => {
      const b = billed.get(customer.id) ?? 0;
      const p = paid.get(customer.id) ?? 0;
      return { id: customer.id, name: customer.name, phone: customer.phone, billed: r2(b), paid: r2(p), outstanding: r2(b - p) };
    }).filter((row) => row.billed !== 0 || row.paid !== 0);
    return { rows, totalOutstanding: r2(rows.reduce((sum, row) => sum + row.outstanding, 0)) };
  },
  getSupplierLedger: async () => {
    const [suppliers, bills, payments] = await Promise.all([
      accountingApi.listSuppliers(),
      supabase.from("accounting_bills").select("*").neq("status", "void").then(unwrap<AccountingBill[]>),
      supabase.from("accounting_payments").select("*").eq("direction", "paid").then(unwrap<AccountingPayment[]>),
    ]);
    const billed = new Map<string, number>();
    const paid = new Map<string, number>();
    for (const bill of bills) billed.set(bill.supplier_id, (billed.get(bill.supplier_id) ?? 0) + num(bill.total_amount));
    for (const payment of payments) {
      if (payment.supplier_id) paid.set(payment.supplier_id, (paid.get(payment.supplier_id) ?? 0) + num(payment.amount));
    }
    const rows = suppliers.map((supplier) => {
      const b = billed.get(supplier.id) ?? 0;
      const p = paid.get(supplier.id) ?? 0;
      return { id: supplier.id, name: supplier.name, phone: supplier.phone, billed: r2(b), paid: r2(p), outstanding: r2(b - p) };
    }).filter((row) => row.billed !== 0 || row.paid !== 0);
    return { rows, totalOutstanding: r2(rows.reduce((sum, row) => sum + row.outstanding, 0)) };
  },
};

function accountingMutation<TArgs, TResult>(fn: (a: TArgs) => PromiseLike<TResult>) {
  return () => {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: async (args: TArgs) => fn(args),
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["accounting"] });
        qc.invalidateQueries({ queryKey: ["customers"] });
      },
    });
  };
}

export const useAccountingAccounts = () =>
  useQuery({ queryKey: ["accounting", "accounts"], queryFn: async () => accountingApi.listAccounts() });
export const useAccountingEntries = () =>
  useQuery({ queryKey: ["accounting", "entries"], queryFn: async () => accountingApi.listJournalEntries() });
export const useAccountingSuppliers = () =>
  useQuery({ queryKey: ["accounting", "suppliers"], queryFn: async () => accountingApi.listSuppliers() });
export const useAccountingInvoices = () =>
  useQuery({ queryKey: ["accounting", "invoices"], queryFn: async () => accountingApi.listInvoices() });
export const useAccountingBills = () =>
  useQuery({ queryKey: ["accounting", "bills"], queryFn: async () => accountingApi.listBills() });
export const useAccountingExpenses = () =>
  useQuery({ queryKey: ["accounting", "expenses"], queryFn: async () => accountingApi.listExpenses() });
export const useAccountingPayments = () =>
  useQuery({ queryKey: ["accounting", "payments"], queryFn: async () => accountingApi.listPayments() });
export const useAccountTree = (enabled = true) =>
  useQuery({ queryKey: ["accounting", "account-tree"], queryFn: async () => accountingApi.getAccountTree(), enabled });
export const useParentAccountOptions = (enabled = true) =>
  useQuery({ queryKey: ["accounting", "parent-account-options"], queryFn: async () => accountingApi.getParentAccountOptions(), enabled });
export const useTrialBalance = (asOf?: string, enabled = true) =>
  useQuery({ queryKey: ["accounting", "trial-balance", asOf], queryFn: () => accountingApi.getTrialBalance(asOf), enabled });
export const useGeneralLedger = (input: { accountId?: string; from?: string; to?: string }) =>
  useQuery({ queryKey: ["accounting", "ledger", input], queryFn: () => accountingApi.getGeneralLedger(input) });
export const useProfitAndLoss = (input?: { from?: string; to?: string }, enabled = true) =>
  useQuery({ queryKey: ["accounting", "profit-loss", input], queryFn: () => accountingApi.getProfitAndLoss(input), enabled });
export const useBalanceSheet = (asOf?: string, enabled = true) =>
  useQuery({ queryKey: ["accounting", "balance-sheet", asOf], queryFn: () => accountingApi.getBalanceSheet(asOf), enabled });
export const useCustomerLedger = (enabled = true) =>
  useQuery({ queryKey: ["accounting", "customer-ledger"], queryFn: async () => accountingApi.getCustomerLedger(), enabled });
export const useSupplierLedger = (enabled = true) =>
  useQuery({ queryKey: ["accounting", "supplier-ledger"], queryFn: async () => accountingApi.getSupplierLedger(), enabled });
export const useAccountingHomeSummary = (enabled = true) =>
  useQuery({ queryKey: ["accounting", "home-summary"], queryFn: async () => accountingApi.getAccountingHomeSummary(), enabled });
export const useChartsDashboardSummary = () =>
  useQuery({ queryKey: ["accounting", "charts", "summary"], queryFn: async () => accountingApi.getChartsDashboardSummary() });
export const useCashBookAccounts = () =>
  useQuery({ queryKey: ["accounting", "charts", "cash-accounts"], queryFn: async () => accountingApi.listCashBookAccounts() });
export const useCashBookTransactions = () =>
  useQuery({ queryKey: ["accounting", "charts", "cash-transactions"], queryFn: async () => accountingApi.listCashBookTransactions() });
export const useBankReconciliations = () =>
  useQuery({ queryKey: ["accounting", "charts", "bank-reconciliations"], queryFn: async () => accountingApi.listBankReconciliations() });
export const useRevenueInvoices = () =>
  useQuery({ queryKey: ["accounting", "charts", "revenue-invoices"], queryFn: async () => accountingApi.listRevenueInvoices() });
export const useCreditNotes = () =>
  useQuery({ queryKey: ["accounting", "charts", "credit-notes"], queryFn: async () => accountingApi.listCreditNotes() });
export const useCogsEntries = () =>
  useQuery({ queryKey: ["accounting", "charts", "cogs"], queryFn: async () => accountingApi.listCogsEntries() });
export const useOperatingExpenses = (group?: AccountingOperatingExpense["expense_group"]) =>
  useQuery({ queryKey: ["accounting", "charts", "operating-expenses", group ?? "all"], queryFn: async () => accountingApi.listOperatingExpenses(group) });

export const useSeedChartOfAccounts = accountingMutation<void, SeedChartResult>(() => accountingApi.seedChart());
export const useCreateAccountingAccount = accountingMutation(accountingApi.createAccount);
export const useCreateClassifiedAccount = accountingMutation(accountingApi.createClassifiedAccount);
export const useUpdateAccountingAccount = accountingMutation(accountingApi.updateAccount);
export const usePostJournal = accountingMutation(accountingApi.postJournal);
export const useCreateSupplier = accountingMutation(accountingApi.createSupplier);
export const usePostInvoice = accountingMutation(accountingApi.postInvoice);
export const usePostBill = accountingMutation(accountingApi.postBill);
export const usePostExpense = accountingMutation(accountingApi.postExpense);
export const useRecordAccountingPayment = accountingMutation(accountingApi.recordPayment);
export const useCreateCashBookAccount = accountingMutation(accountingApi.createCashBookAccount);
export const usePostCashBookTransaction = accountingMutation(accountingApi.postCashBookTransaction);
export const useCreateBankReconciliation = accountingMutation(accountingApi.createBankReconciliation);
export const usePostCustomerInvoice = accountingMutation(accountingApi.postCustomerInvoice);
export const usePostCreditNote = accountingMutation(accountingApi.postCreditNote);
export const usePostCogsEntry = accountingMutation(accountingApi.postCogsEntry);
export const usePostOperatingExpense = accountingMutation(accountingApi.postOperatingExpense);

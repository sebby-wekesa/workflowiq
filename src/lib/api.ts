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
  type AccountingBill, type AccountingExpense, type AccountingInvoice,
  type AccountingPayment, type ChartAccount, type JournalEntry, type LedgerLine,
  type Supplier,
} from "@/lib/supabase";

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

type PostedEntry = JournalEntry & {
  ledger_line?: LedgerLine[];
};

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const num = (n: unknown) => Number(n ?? 0);

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
    .from("journal_entry")
    .select("*, ledger_line(*)")
    .eq("status", "POSTED")
    .order("date", { ascending: true });

  if (input?.from) q = q.gte("date", input.from);
  if (input?.to) q = q.lte("date", dateEnd(input.to));

  return q.then(unwrap<PostedEntry[]>);
}

function aggregateLines(entries: PostedEntry[]) {
  const totals = new Map<string, { debit: number; credit: number }>();
  for (const entry of entries) {
    for (const line of entry.ledger_line ?? []) {
      const cur = totals.get(line.account_id) ?? { debit: 0, credit: 0 };
      cur.debit += num(line.debit);
      cur.credit += num(line.credit);
      totals.set(line.account_id, cur);
    }
  }
  return totals;
}

export const accountingApi = {
  seedChart: () => supabase.rpc("seed_chart_of_accounts").then(unwrap<{ success: boolean; created: number; total: number }>),
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
  listSuppliers: () =>
    supabase.from("suppliers").select("*").order("name").then(unwrap<Supplier[]>),
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
    const [accounts, entries] = await Promise.all([
      accountingApi.listActiveAccounts(),
      postedEntries(asOf ? { to: asOf } : undefined),
    ]);
    const totals = aggregateLines(entries);
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
    const accounts = await accountingApi.listActiveAccounts();
    if (!input.accountId) {
      return { accounts, account: null, openingBalance: 0, lines: [] as LedgerReportLine[] };
    }

    const account = accounts.find((a) => a.id === input.accountId) ?? null;
    if (!account) return { accounts, account: null, openingBalance: 0, lines: [] as LedgerReportLine[] };

    const allEntries = await postedEntries({ to: input.to });
    let openingBalance = 0;
    const lines: LedgerReportLine[] = [];

    for (const entry of allEntries) {
      const entryDate = new Date(entry.date);
      const beforeFrom = input.from ? entryDate < new Date(input.from) : false;
      for (const line of entry.ledger_line ?? []) {
        if (line.account_id !== input.accountId) continue;
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
    const [accounts, entries] = await Promise.all([
      accountingApi.listActiveAccounts(),
      postedEntries(input),
    ]);
    const totals = aggregateLines(entries);
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
          if (account.code === "5000") costOfSales += amount;
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
    const [accounts, entries] = await Promise.all([
      accountingApi.listActiveAccounts(),
      postedEntries(asOf ? { to: asOf } : undefined),
    ]);
    const totals = aggregateLines(entries);
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
export const useTrialBalance = (asOf?: string) =>
  useQuery({ queryKey: ["accounting", "trial-balance", asOf], queryFn: () => accountingApi.getTrialBalance(asOf) });
export const useGeneralLedger = (input: { accountId?: string; from?: string; to?: string }) =>
  useQuery({ queryKey: ["accounting", "ledger", input], queryFn: () => accountingApi.getGeneralLedger(input) });
export const useProfitAndLoss = (input?: { from?: string; to?: string }) =>
  useQuery({ queryKey: ["accounting", "profit-loss", input], queryFn: () => accountingApi.getProfitAndLoss(input) });
export const useBalanceSheet = (asOf?: string) =>
  useQuery({ queryKey: ["accounting", "balance-sheet", asOf], queryFn: () => accountingApi.getBalanceSheet(asOf) });
export const useCustomerLedger = () =>
  useQuery({ queryKey: ["accounting", "customer-ledger"], queryFn: async () => accountingApi.getCustomerLedger() });
export const useSupplierLedger = () =>
  useQuery({ queryKey: ["accounting", "supplier-ledger"], queryFn: async () => accountingApi.getSupplierLedger() });

export const useSeedChartOfAccounts = accountingMutation<void, { success: boolean; created: number; total: number }>(() => accountingApi.seedChart());
export const useCreateAccountingAccount = accountingMutation(accountingApi.createAccount);
export const useUpdateAccountingAccount = accountingMutation(accountingApi.updateAccount);
export const usePostJournal = accountingMutation(accountingApi.postJournal);
export const useCreateSupplier = accountingMutation(accountingApi.createSupplier);
export const usePostInvoice = accountingMutation(accountingApi.postInvoice);
export const usePostBill = accountingMutation(accountingApi.postBill);
export const usePostExpense = accountingMutation(accountingApi.postExpense);
export const useRecordAccountingPayment = accountingMutation(accountingApi.recordPayment);

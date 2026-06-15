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

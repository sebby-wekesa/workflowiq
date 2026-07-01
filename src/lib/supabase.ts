// src/lib/supabase.ts
// Single Supabase client for the whole app. Reads keys from Vite env vars.
import { createClient } from "@supabase/supabase-js";
import type { Classification, StatementGroup } from "@/lib/accounting/classifications";

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();

export const isSupabaseConfigured = Boolean(
  url && anonKey && !url.includes("YOUR-PROJECT-REF") && anonKey !== "your-anon-public-key",
);

export const supabase = createClient(
  url || "https://placeholder.supabase.co",
  anonKey || "placeholder-anon-key",
  {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  },
);

// ---- Shared types (mirror the Postgres enums / tables) ----
export type UserRole = "admin" | "manager";
export type UserStatus = "active" | "pending" | "inactive";
export type JobCondition = "good" | "worn" | "heavily_worn" | "damaged";
export type JobPriority = "normal" | "urgent";
export type JobStatus =
  | "received" | "workshop" | "relining" | "qc" | "done" | "collected";
export type StockCategory =
  | "lining_material" | "rivets" | "adhesive" | "hardware" | "consumable" | "other";
export type MovementType = "in" | "out" | "adjustment";
export type DeliveryCondition =
  | "good_ready" | "good_minor_remarks" | "requires_followup";

export type Material = { stockId: string; quantity: number };
export type StatusHistoryEntry = { status: string; timestamp: string };

export interface AppUser {
  id: string;
  auth_id: string | null;
  org_id: string | null;
  name: string | null;
  email: string | null;
  avatar: string | null;
  role: UserRole;
  is_active: boolean;
  status: UserStatus;
  invited_by: string | null;
  created_at: string;
}

export interface Organization {
  id: string;
  name: string;
  created_at: string;
}

export interface Customer {
  id: string;
  org_id: string;
  name: string;
  phone: string;
  location: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Stock {
  id: string;
  org_id: string;
  name: string;
  category: StockCategory;
  unit: string;
  current_qty: number;
  min_threshold: number;
  supplier: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Job {
  id: string;
  org_id: string;
  job_number: string;
  customer_id: string;
  description: string;
  quantity: number;
  condition: JobCondition;
  intake_notes: string | null;
  date_received: string;
  priority: JobPriority;
  status: JobStatus;
  materials: Material[] | null;
  status_history: StatusHistoryEntry[];
  invoice_data: unknown | null;
  delivery_record: unknown | null;
  created_by: string | null;
  created_at: string;
}

export type AccountType = "ASSET" | "LIABILITY" | "EQUITY" | "INCOME" | "EXPENSE";
export type NormalBalance = "DEBIT" | "CREDIT";

export interface ChartAccount {
  id: string;
  org_id: string;
  code: string;
  name: string;
  type: AccountType;
  normal_balance: NormalBalance;
  classification: Classification | null;
  statement_group: StatementGroup | null;
  currency: string;
  parent_id: string | null;
  note: string | null;
  vat_applicable: boolean;
  tax_code_id: string | null;
  is_postable: boolean;
  is_bank: boolean;
  is_system: boolean;
  is_active: boolean;
  description: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface JournalEntry {
  id: string;
  org_id: string;
  entry_number: string;
  date: string;
  memo: string | null;
  status: string;
  source: string;
  source_type: string | null;
  source_id: string | null;
  total_debit: number;
  total_credit: number;
  posted_at: string | null;
  posted_by: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface LedgerLine {
  id: string;
  org_id: string;
  journal_entry_id: string;
  account_id: string;
  debit: number;
  credit: number;
  description: string | null;
  created_at: string;
}

export interface AccountingJournalEntry {
  id: string;
  org_id: string;
  journal_number: string;
  entry_number: string;
  date: string;
  description: string | null;
  memo: string | null;
  reference_number: string | null;
  branch: string | null;
  status: string;
  source: string;
  source_type: string | null;
  source_id: string | null;
  total_debit: number;
  total_credit: number;
  posted_at: string | null;
  posted_by: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AccountingJournalLine {
  id: string;
  org_id: string;
  journal_entry_id: string;
  chart_account_id: string;
  account_id: string | null;
  debit: number;
  credit: number;
  description: string | null;
  created_at: string;
}

export interface Supplier {
  id: string;
  org_id: string;
  name: string;
  phone: string;
  email: string | null;
  location: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface AccountingInvoice {
  id: string;
  org_id: string;
  invoice_number: string;
  customer_id: string;
  job_id: string | null;
  date: string;
  due_date: string | null;
  status: string;
  has_vat: boolean;
  net_amount: number;
  vat_amount: number;
  total_amount: number;
  memo: string | null;
  branch: string | null;
  sales_person: string | null;
  payment_terms: string | null;
  notes: string | null;
  journal_entry_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AccountingInvoiceLine {
  id: string;
  org_id: string;
  invoice_id: string;
  item: string;
  quantity: number;
  unit_price: number;
  discount: number;
  tax_rate: number;
  tax_amount: number;
  line_total: number;
  created_at: string;
}

export interface AccountingCreditNote {
  id: string;
  org_id: string;
  credit_note_number: string;
  invoice_id: string | null;
  customer_id: string;
  branch: string | null;
  reason: string;
  date: string;
  amount: number;
  notes: string | null;
  status: string;
  journal_entry_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AccountingBill {
  id: string;
  org_id: string;
  bill_number: string;
  supplier_id: string;
  account_id: string;
  date: string;
  due_date: string | null;
  status: string;
  has_vat: boolean;
  net_amount: number;
  vat_amount: number;
  total_amount: number;
  memo: string | null;
  journal_entry_id: string | null;
  created_by: string | null;
  created_at: string;
}

export interface AccountingExpense {
  id: string;
  org_id: string;
  expense_number: string;
  supplier_id: string | null;
  vendor_name: string | null;
  expense_account_id: string;
  bank_account_id: string;
  date: string;
  has_vat: boolean;
  net_amount: number;
  vat_amount: number;
  total_amount: number;
  memo: string | null;
  reference: string | null;
  journal_entry_id: string | null;
  created_by: string | null;
  created_at: string;
}

export interface AccountingPayment {
  id: string;
  org_id: string;
  payment_number: string;
  direction: "received" | "paid";
  customer_id: string | null;
  supplier_id: string | null;
  invoice_id: string | null;
  bill_id: string | null;
  bank_account_id: string;
  method: string;
  date: string;
  amount: number;
  reference: string | null;
  notes: string | null;
  journal_entry_id: string | null;
  created_by: string | null;
  created_at: string;
}

export interface AccountingCashAccount {
  id: string;
  org_id: string;
  chart_account_id: string;
  account_kind: "bank" | "cash";
  account_name: string;
  bank_name: string | null;
  account_number: string | null;
  branch: string | null;
  opening_balance: number;
  current_balance: number;
  status: "active" | "inactive";
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AccountingCashTransaction {
  id: string;
  org_id: string;
  cash_account_id: string;
  transaction_number: string;
  transaction_type: string;
  date: string;
  reference_number: string | null;
  description: string | null;
  offset_account_id: string | null;
  debit: number;
  credit: number;
  running_balance: number;
  journal_entry_id: string | null;
  created_by: string | null;
  created_at: string;
}

export interface AccountingBankReconciliation {
  id: string;
  org_id: string;
  cash_account_id: string;
  reconciliation_number: string;
  statement_date: string;
  statement_balance: number;
  system_balance: number;
  difference: number;
  status: "open" | "reconciled";
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AccountingCogsEntry {
  id: string;
  org_id: string;
  cogs_number: string;
  date: string;
  branch: string | null;
  invoice_id: string | null;
  product_service: string | null;
  project: string | null;
  direct_material_cost: number;
  direct_labour_cost: number;
  production_service_cost: number;
  purchase_cost: number;
  total_amount: number;
  payment_account_id: string | null;
  status: string;
  notes: string | null;
  journal_entry_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AccountingOperatingExpense {
  id: string;
  org_id: string;
  expense_number: string;
  expense_group: "administrative" | "finance" | "other_operating";
  date: string;
  payee: string;
  branch: string | null;
  description: string | null;
  category: string;
  amount: number;
  payment_method: string;
  reference_number: string | null;
  payment_account_id: string | null;
  status: string;
  journal_entry_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface LoanRepayment {
  id: string;
  org_id: string;
  loan_account_id: string;
  due_date: string;
  amount: number;
  is_paid: boolean;
  note: string | null;
  created_by: string | null;
  created_at: string;
}

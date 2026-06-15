// src/lib/supabase.ts
// Single Supabase client for the whole app. Reads keys from Vite env vars.
import { createClient } from "@supabase/supabase-js";

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

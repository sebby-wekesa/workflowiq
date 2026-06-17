// Standard Kenyan SME chart of accounts. Codes follow the common 1000-5999
// convention: 1xxx assets, 2xxx liabilities, 3xxx equity, 4xxx income, 5xxx
// expenses. `system` accounts are referenced by the auto-posting engine, so
// their `key` must stay stable even if the user renames/recodes them.

export type AccountType = "ASSET" | "LIABILITY" | "EQUITY" | "INCOME" | "EXPENSE";
export type NormalBalance = "DEBIT" | "CREDIT";

export type SeedAccount = {
  code: string;
  name: string;
  type: AccountType;
  normalBalance: NormalBalance;
  isBank?: boolean;
  // Stable key for system accounts the posting engine looks up by role.
  key?: string;
};

// Keys the auto-posting engine relies on. Keep these in sync with usage in
// lib/accounting.ts.
export const SYSTEM_ACCOUNT_KEYS = {
  ACCOUNTS_RECEIVABLE: "accounts_receivable",
  ACCOUNTS_PAYABLE: "accounts_payable",
  SALES_REVENUE: "sales_revenue",
  COST_OF_SALES: "cost_of_sales",
  INVENTORY: "inventory",
  RAW_MATERIALS: "raw_materials_inventory",
  VAT_OUTPUT: "vat_output",
  VAT_INPUT: "vat_input",
  CASH: "cash_on_hand",
  RETAINED_EARNINGS: "retained_earnings",
} as const;

const K = SYSTEM_ACCOUNT_KEYS;

export const KENYA_SME_CHART: SeedAccount[] = [
  // ── 1000 ASSETS (debit-normal) ──────────────────────────────────────────
  { code: "1000", name: "Cash on Hand", type: "ASSET", normalBalance: "DEBIT", key: K.CASH },
  { code: "1010", name: "Petty Cash", type: "ASSET", normalBalance: "DEBIT" },
  { code: "1100", name: "Bank — Current Account", type: "ASSET", normalBalance: "DEBIT", isBank: true },
  { code: "1110", name: "M-Pesa Paybill / Till", type: "ASSET", normalBalance: "DEBIT", isBank: true },
  { code: "1200", name: "Accounts Receivable (Debtors)", type: "ASSET", normalBalance: "DEBIT", key: K.ACCOUNTS_RECEIVABLE },
  { code: "1300", name: "Inventory — Finished Goods", type: "ASSET", normalBalance: "DEBIT", key: K.INVENTORY },
  { code: "1310", name: "Inventory — Raw Materials", type: "ASSET", normalBalance: "DEBIT", key: K.RAW_MATERIALS },
  { code: "1400", name: "VAT Input (Receivable)", type: "ASSET", normalBalance: "DEBIT", key: K.VAT_INPUT },
  { code: "1500", name: "Property, Plant & Equipment", type: "ASSET", normalBalance: "DEBIT" },
  { code: "1510", name: "Accumulated Depreciation", type: "ASSET", normalBalance: "CREDIT" },

  // ── 2000 LIABILITIES (credit-normal) ────────────────────────────────────
  { code: "2000", name: "Accounts Payable (Creditors)", type: "LIABILITY", normalBalance: "CREDIT", key: K.ACCOUNTS_PAYABLE },
  { code: "2100", name: "VAT Output (Payable)", type: "LIABILITY", normalBalance: "CREDIT", key: K.VAT_OUTPUT },
  { code: "2110", name: "PAYE Payable", type: "LIABILITY", normalBalance: "CREDIT" },
  { code: "2120", name: "NHIF Payable", type: "LIABILITY", normalBalance: "CREDIT" },
  { code: "2130", name: "NSSF Payable", type: "LIABILITY", normalBalance: "CREDIT" },
  { code: "2200", name: "Accrued Expenses", type: "LIABILITY", normalBalance: "CREDIT" },
  { code: "2300", name: "Loans Payable", type: "LIABILITY", normalBalance: "CREDIT" },

  // ── 3000 EQUITY (credit-normal) ─────────────────────────────────────────
  { code: "3000", name: "Owner's Capital", type: "EQUITY", normalBalance: "CREDIT" },
  { code: "3100", name: "Drawings", type: "EQUITY", normalBalance: "DEBIT" },
  { code: "3200", name: "Retained Earnings", type: "EQUITY", normalBalance: "CREDIT", key: K.RETAINED_EARNINGS },

  // ── 4000 INCOME (credit-normal) ─────────────────────────────────────────
  { code: "4000", name: "Sales Revenue", type: "INCOME", normalBalance: "CREDIT", key: K.SALES_REVENUE },
  { code: "4100", name: "Other Income", type: "INCOME", normalBalance: "CREDIT" },
  { code: "4200", name: "Interest Income", type: "INCOME", normalBalance: "CREDIT" },

  // ── 5000 EXPENSES (debit-normal) ────────────────────────────────────────
  { code: "5000", name: "Cost of Sales", type: "EXPENSE", normalBalance: "DEBIT", key: K.COST_OF_SALES },
  { code: "5100", name: "Salaries & Wages", type: "EXPENSE", normalBalance: "DEBIT" },
  { code: "5200", name: "Rent", type: "EXPENSE", normalBalance: "DEBIT" },
  { code: "5210", name: "Electricity & Water", type: "EXPENSE", normalBalance: "DEBIT" },
  { code: "5220", name: "Fuel & Transport", type: "EXPENSE", normalBalance: "DEBIT" },
  { code: "5300", name: "Repairs & Maintenance", type: "EXPENSE", normalBalance: "DEBIT" },
  { code: "5400", name: "Bank Charges", type: "EXPENSE", normalBalance: "DEBIT" },
  { code: "5500", name: "Telephone & Internet", type: "EXPENSE", normalBalance: "DEBIT" },
  { code: "5600", name: "Office & Administrative", type: "EXPENSE", normalBalance: "DEBIT" },
  { code: "5700", name: "Depreciation Expense", type: "EXPENSE", normalBalance: "DEBIT" },
  { code: "5800", name: "Professional Fees", type: "EXPENSE", normalBalance: "DEBIT" },
];

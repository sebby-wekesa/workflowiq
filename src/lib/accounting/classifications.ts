import type { AccountType, NormalBalance } from "@/lib/supabase";

export type Classification =
  | "INCOME"
  | "EXPENSE"
  | "FIXED_ASSETS"
  | "BANK"
  | "LOAN"
  | "EQUITY"
  | "ACCOUNTS_RECEIVABLE"
  | "OTHER_CURRENT_ASSETS"
  | "OTHER_ASSETS"
  | "ACCOUNTS_PAYABLE"
  | "OTHER_CURRENT_LIABILITY"
  | "LONG_TERM_LIABILITY"
  | "COST_OF_GOODS_SOLD"
  | "OTHER_INCOME"
  | "OTHER_EXPENSE";

export type StatementGroup =
  | "NON_CURRENT_ASSETS"
  | "CURRENT_ASSETS"
  | "NON_CURRENT_LIABILITIES"
  | "CURRENT_LIABILITIES"
  | "EQUITY"
  | "REVENUE"
  | "OTHER_INCOME"
  | "COST_OF_GOODS_SOLD"
  | "ADMINISTRATIVE_EXPENSES"
  | "OTHER_OPERATING_EXPENSES"
  | "FINANCE_CHARGES";

export const CLASSIFICATION_MAP: Record<
  Classification,
  { label: string; type: AccountType; normalBalance: NormalBalance; group: StatementGroup }
> = {
  FIXED_ASSETS: { label: "Fixed Assets", type: "ASSET", normalBalance: "DEBIT", group: "NON_CURRENT_ASSETS" },
  OTHER_ASSETS: { label: "Other Assets", type: "ASSET", normalBalance: "DEBIT", group: "NON_CURRENT_ASSETS" },
  BANK: { label: "Bank", type: "ASSET", normalBalance: "DEBIT", group: "CURRENT_ASSETS" },
  ACCOUNTS_RECEIVABLE: { label: "Accounts Receivable", type: "ASSET", normalBalance: "DEBIT", group: "CURRENT_ASSETS" },
  OTHER_CURRENT_ASSETS: { label: "Other Current Assets", type: "ASSET", normalBalance: "DEBIT", group: "CURRENT_ASSETS" },
  LONG_TERM_LIABILITY: { label: "Long Term Liability", type: "LIABILITY", normalBalance: "CREDIT", group: "NON_CURRENT_LIABILITIES" },
  LOAN: { label: "Loan", type: "LIABILITY", normalBalance: "CREDIT", group: "NON_CURRENT_LIABILITIES" },
  ACCOUNTS_PAYABLE: { label: "Accounts Payable", type: "LIABILITY", normalBalance: "CREDIT", group: "CURRENT_LIABILITIES" },
  OTHER_CURRENT_LIABILITY: { label: "Other Current Liability", type: "LIABILITY", normalBalance: "CREDIT", group: "CURRENT_LIABILITIES" },
  EQUITY: { label: "Equity", type: "EQUITY", normalBalance: "CREDIT", group: "EQUITY" },
  INCOME: { label: "Income", type: "INCOME", normalBalance: "CREDIT", group: "REVENUE" },
  OTHER_INCOME: { label: "Other Income", type: "INCOME", normalBalance: "CREDIT", group: "OTHER_INCOME" },
  COST_OF_GOODS_SOLD: { label: "Cost of Goods Sold", type: "EXPENSE", normalBalance: "DEBIT", group: "COST_OF_GOODS_SOLD" },
  EXPENSE: { label: "Expense", type: "EXPENSE", normalBalance: "DEBIT", group: "ADMINISTRATIVE_EXPENSES" },
  OTHER_EXPENSE: { label: "Other Expense", type: "EXPENSE", normalBalance: "DEBIT", group: "OTHER_OPERATING_EXPENSES" },
};

export const STATEMENT_GROUPS: {
  key: StatementGroup;
  label: string;
  statement: "BALANCE_SHEET" | "INCOME_STATEMENT";
}[] = [
  { key: "NON_CURRENT_ASSETS", label: "Non-Current Assets", statement: "BALANCE_SHEET" },
  { key: "CURRENT_ASSETS", label: "Current Assets", statement: "BALANCE_SHEET" },
  { key: "NON_CURRENT_LIABILITIES", label: "Non-Current Liabilities", statement: "BALANCE_SHEET" },
  { key: "CURRENT_LIABILITIES", label: "Current Liabilities", statement: "BALANCE_SHEET" },
  { key: "EQUITY", label: "Equity", statement: "BALANCE_SHEET" },
  { key: "REVENUE", label: "Revenue", statement: "INCOME_STATEMENT" },
  { key: "OTHER_INCOME", label: "Other Income", statement: "INCOME_STATEMENT" },
  { key: "COST_OF_GOODS_SOLD", label: "Cost of Goods Sold", statement: "INCOME_STATEMENT" },
  { key: "ADMINISTRATIVE_EXPENSES", label: "Administrative Expenses", statement: "INCOME_STATEMENT" },
  { key: "OTHER_OPERATING_EXPENSES", label: "Other Operating Expenses", statement: "INCOME_STATEMENT" },
  { key: "FINANCE_CHARGES", label: "Finance Charges", statement: "INCOME_STATEMENT" },
];

const CLASSIFICATIONS: Classification[] = [
  "INCOME",
  "EXPENSE",
  "FIXED_ASSETS",
  "BANK",
  "LOAN",
  "EQUITY",
  "ACCOUNTS_RECEIVABLE",
  "OTHER_CURRENT_ASSETS",
  "OTHER_ASSETS",
  "ACCOUNTS_PAYABLE",
  "OTHER_CURRENT_LIABILITY",
  "LONG_TERM_LIABILITY",
  "COST_OF_GOODS_SOLD",
  "OTHER_INCOME",
  "OTHER_EXPENSE",
];

export const CLASSIFICATION_OPTIONS: { value: Classification; label: string }[] = CLASSIFICATIONS.map((value) => ({
  value,
  label: CLASSIFICATION_MAP[value].label,
}));

export function resolveClassification(classification: Classification) {
  return CLASSIFICATION_MAP[classification];
}

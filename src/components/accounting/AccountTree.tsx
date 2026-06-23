import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronDownIcon, ChevronRightIcon, PlusIcon } from "lucide-react";
import { AddAccountForm } from "@/components/accounting/AddAccountForm";
import type { AccountTreeGroup, ParentAccountOption } from "@/lib/api";

function money(value: number, currency = "KES") {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value || 0);
}

export function AccountTree({
  groups,
  parents,
}: {
  groups: AccountTreeGroup[];
  parents: ParentAccountOption[];
}) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [adding, setAdding] = useState<string | null>(null);

  const balanceSheet = groups.filter((group) => group.statement === "BALANCE_SHEET");
  const incomeStatement = groups.filter((group) => group.statement === "INCOME_STATEMENT");

  const toggle = (key: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const startAdding = (key: string) => {
    setAdding((current) => (current === key ? null : key));
    setExpanded((current) => {
      if (current.has(key)) return current;
      const next = new Set(current);
      next.add(key);
      return next;
    });
  };

  const renderGroup = (group: AccountTreeGroup) => {
    const isOpen = expanded.has(group.key);
    const isAdding = adding === group.key;

    return (
      <div key={group.key} className="card account-tree-group">
        <div className="account-tree-row">
          <button
            type="button"
            className="account-tree-toggle"
            onClick={() => toggle(group.key)}
            aria-label={isOpen ? `Collapse ${group.label}` : `Expand ${group.label}`}
          >
            {isOpen ? <ChevronDownIcon className="size-5" /> : <ChevronRightIcon className="size-5" />}
          </button>
          <button type="button" className="account-tree-title" onClick={() => toggle(group.key)}>
            <strong>{group.label}</strong>
            <span>
              {group.accounts.length} {group.accounts.length === 1 ? "account" : "accounts"}
            </span>
          </button>
          <span className="account-tree-total">{money(group.total)}</span>
          <button type="button" className="button button-secondary account-tree-add" onClick={() => startAdding(group.key)}>
            <PlusIcon className="size-4" />
            Add Account
          </button>
        </div>

        {isOpen && (
          <div className="account-tree-panel">
            {group.accounts.length === 0 && !isAdding && (
              <div className="account-tree-empty">No accounts yet. Use Add Account to create one here.</div>
            )}

            {group.accounts.length > 0 && (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Type</th>
                      <th>Balance</th>
                      <th>Report</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.accounts.map((account) => (
                      <tr key={account.id}>
                        <td>
                          <strong>
                            <span className="account-code">{account.code}</span>
                            {account.name}
                          </strong>
                          <small>
                            {account.vatApplicable ? "VAT applies" : "No VAT flag"}
                            {account.parentId ? " - sub-account" : ""}
                          </small>
                        </td>
                        <td>{account.classificationLabel}</td>
                        <td className="account-balance">{money(account.balance, account.currency)}</td>
                        <td>
                          <Link to={`/accounting/ledger?account=${account.id}`} className="button button-secondary account-report-link">
                            Report
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {isAdding && (
              <AddAccountForm
                statementGroup={group.key}
                groupLabel={group.label}
                parents={parents}
                onDone={() => setAdding(null)}
              />
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="account-tree">
      <SectionLabel>Balance Sheet</SectionLabel>
      {balanceSheet.map(renderGroup)}
      <SectionLabel>Income Statement</SectionLabel>
      {incomeStatement.map(renderGroup)}
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <div className="account-tree-section">{children}</div>;
}

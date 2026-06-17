"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  postExpense, postIncome, postBill, postInvoice, postTransfer, postEquityMovement,
} from "@/actions/accounting-transactions";

type Acc = { id: string; code: string; name: string };
type Data = {
  all: (Acc & { type: string })[];
  expense: Acc[];
  income: Acc[];
  asset: Acc[];
  equity: Acc[];
  banks: { id: string; name: string }[];
};

const TABS = [
  { key: "expense", label: "Expense", hint: "Money paid out now" },
  { key: "income", label: "Income", hint: "Money received now (not a customer sale)" },
  { key: "invoice", label: "Sales Invoice", hint: "Customer owes you (on credit)" },
  { key: "bill", label: "Bill / Purchase", hint: "You owe a supplier (on credit)" },
  { key: "transfer", label: "Bank Transfer", hint: "Move money between your accounts" },
  { key: "equity", label: "Capital / Drawings", hint: "Owner money in or out" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const VAT_RATE = 0.16;

export function TransactionsHub({ data }: { data: Data }) {
  const [tab, setTab] = useState<TabKey>("expense");

  return (
    <div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            style={{
              padding: "8px 14px", fontSize: 13, fontWeight: 700, borderRadius: "var(--radius-sm)",
              cursor: "pointer", border: "1px solid var(--border2)",
              background: tab === t.key ? "var(--accent)" : "var(--surface2)",
              color: tab === t.key ? "#fff" : "var(--muted)",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 14 }}>
        {TABS.find((t) => t.key === tab)!.hint} — posted automatically as a balanced double-entry.
      </p>

      {tab === "expense" && <ExpenseForm data={data} />}
      {tab === "income" && <IncomeForm data={data} />}
      {tab === "invoice" && <InvoiceForm />}
      {tab === "bill" && <BillForm data={data} />}
      {tab === "transfer" && <TransferForm data={data} />}
      {tab === "equity" && <EquityForm data={data} />}
    </div>
  );
}

// ── shared bits ───────────────────────────────────────────────────────────────
function useSubmit() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  function run(fn: () => Promise<{ success: boolean; error?: string; entryNumber?: string }>, onOk?: () => void) {
    setMsg(null);
    start(async () => {
      const res = await fn();
      if (res.success) { setMsg({ ok: true, text: `Posted ${res.entryNumber}` }); onOk?.(); router.refresh(); }
      else setMsg({ ok: false, text: res.error || "Could not post" });
    });
  }
  return { pending, msg, run };
}

function Msg({ msg }: { msg: { ok: boolean; text: string } | null }) {
  if (!msg) return null;
  return (
    <div style={{
      padding: "8px 12px", borderRadius: "var(--radius-sm)", marginBottom: 12, fontSize: 13,
      background: msg.ok ? "rgba(46,125,50,0.12)" : "rgba(239,68,68,0.1)",
      color: msg.ok ? "#2E7D32" : "#fca5a5",
    }}>{msg.text}</div>
  );
}

function VatPreview({ amount, hasVat }: { amount: string; hasVat: boolean }) {
  const a = parseFloat(amount) || 0;
  if (!hasVat || a <= 0) return null;
  const net = a / (1 + VAT_RATE);
  const vat = a - net;
  return (
    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>
      Net {net.toFixed(2)} · VAT (16%) {vat.toFixed(2)} · Gross {a.toFixed(2)}
    </div>
  );
}

const card: React.CSSProperties = { padding: 20 };
const grid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 };
const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4, display: "block" };
const inp: React.CSSProperties = { width: "100%", padding: "8px 10px", background: "var(--surface2)", border: "1px solid var(--border2)", borderRadius: "var(--radius-sm)", color: "var(--text)", fontSize: 14 };
const today = () => new Date().toISOString().slice(0, 10);

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label style={lbl}>{label}</label>{children}</div>;
}
function Submit({ pending, label }: { pending: boolean; label?: string }) {
  return (
    <div style={{ marginTop: 14, textAlign: "right" }}>
      <button type="button" className="btn btn-primary" disabled={pending} form="">{pending ? "Posting…" : (label ?? "Post entry")}</button>
    </div>
  );
}
function AccountPicker({ accounts, value, onChange, placeholder }: { accounts: Acc[]; value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <select style={inp} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {accounts.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
    </select>
  );
}
function BankPicker({ banks, value, onChange }: { banks: { id: string; name: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <select style={inp} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Cash on hand</option>
      {banks.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
    </select>
  );
}
function VatToggle({ on, set }: { on: boolean; set: (v: boolean) => void }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer", marginTop: 22 }}>
      <input type="checkbox" checked={on} onChange={(e) => set(e.target.checked)} /> Includes 16% VAT
    </label>
  );
}

// ── Expense ───────────────────────────────────────────────────────────────────
function ExpenseForm({ data }: { data: Data }) {
  const { pending, msg, run } = useSubmit();
  const [date, setDate] = useState(today());
  const [amount, setAmount] = useState("");
  const [acc, setAcc] = useState("");
  const [bank, setBank] = useState("");
  const [vat, setVat] = useState(false);
  const [memo, setMemo] = useState("");
  return (
    <div className="card" style={card}>
      <Msg msg={msg} />
      <div style={grid}>
        <Field label="Date"><input type="date" style={inp} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Amount (KES)"><input type="number" min={0} step="0.01" style={inp} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" /></Field>
        <Field label="Expense account"><AccountPicker accounts={data.expense} value={acc} onChange={setAcc} placeholder="Select expense…" /></Field>
        <Field label="Paid from"><BankPicker banks={data.banks} value={bank} onChange={setBank} /></Field>
        <VatToggle on={vat} set={setVat} />
        <Field label="Memo"><input style={inp} value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="What for?" /></Field>
      </div>
      <VatPreview amount={amount} hasVat={vat} />
      <div style={{ marginTop: 14, textAlign: "right" }}>
        <button type="button" className="btn btn-primary" disabled={pending}
          onClick={() => run(() => postExpense({ date, amount: parseFloat(amount), expenseAccountId: acc, bankAccountId: bank || null, hasVat: vat, memo }),
            () => { setAmount(""); setMemo(""); })}>
          {pending ? "Posting…" : "Record expense"}
        </button>
      </div>
    </div>
  );
}

// ── Income ────────────────────────────────────────────────────────────────────
function IncomeForm({ data }: { data: Data }) {
  const { pending, msg, run } = useSubmit();
  const [date, setDate] = useState(today());
  const [amount, setAmount] = useState("");
  const [acc, setAcc] = useState("");
  const [bank, setBank] = useState("");
  const [vat, setVat] = useState(false);
  const [memo, setMemo] = useState("");
  return (
    <div className="card" style={card}>
      <Msg msg={msg} />
      <div style={grid}>
        <Field label="Date"><input type="date" style={inp} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Amount (KES)"><input type="number" min={0} step="0.01" style={inp} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" /></Field>
        <Field label="Income account"><AccountPicker accounts={data.income} value={acc} onChange={setAcc} placeholder="Select income…" /></Field>
        <Field label="Received into"><BankPicker banks={data.banks} value={bank} onChange={setBank} /></Field>
        <VatToggle on={vat} set={setVat} />
        <Field label="Memo"><input style={inp} value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="Source" /></Field>
      </div>
      <VatPreview amount={amount} hasVat={vat} />
      <div style={{ marginTop: 14, textAlign: "right" }}>
        <button type="button" className="btn btn-primary" disabled={pending}
          onClick={() => run(() => postIncome({ date, amount: parseFloat(amount), incomeAccountId: acc, bankAccountId: bank || null, hasVat: vat, memo }),
            () => { setAmount(""); setMemo(""); })}>
          {pending ? "Posting…" : "Record income"}
        </button>
      </div>
    </div>
  );
}

// ── Sales invoice (credit) ────────────────────────────────────────────────────
function InvoiceForm() {
  const { pending, msg, run } = useSubmit();
  const [date, setDate] = useState(today());
  const [amount, setAmount] = useState("");
  const [customer, setCustomer] = useState("");
  const [vat, setVat] = useState(true);
  const [memo, setMemo] = useState("");
  return (
    <div className="card" style={card}>
      <Msg msg={msg} />
      <div style={grid}>
        <Field label="Date"><input type="date" style={inp} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Amount (KES)"><input type="number" min={0} step="0.01" style={inp} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" /></Field>
        <Field label="Customer"><input style={inp} value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="Customer name" /></Field>
        <VatToggle on={vat} set={setVat} />
        <Field label="Memo / invoice no."><input style={inp} value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="INV-001" /></Field>
      </div>
      <VatPreview amount={amount} hasVat={vat} />
      <div style={{ marginTop: 14, textAlign: "right" }}>
        <button type="button" className="btn btn-primary" disabled={pending}
          onClick={() => run(() => postInvoice({ date, amount: parseFloat(amount), customerName: customer, hasVat: vat, memo, reference: memo }),
            () => { setAmount(""); setMemo(""); setCustomer(""); })}>
          {pending ? "Posting…" : "Post invoice"}
        </button>
      </div>
    </div>
  );
}

// ── Bill / purchase (credit) ──────────────────────────────────────────────────
function BillForm({ data }: { data: Data }) {
  const { pending, msg, run } = useSubmit();
  const [date, setDate] = useState(today());
  const [amount, setAmount] = useState("");
  const [acc, setAcc] = useState("");
  const [supplier, setSupplier] = useState("");
  const [vat, setVat] = useState(true);
  const [memo, setMemo] = useState("");
  // bills can hit expense OR asset (e.g. buying equipment / inventory)
  const accounts = [...data.expense, ...data.asset];
  return (
    <div className="card" style={card}>
      <Msg msg={msg} />
      <div style={grid}>
        <Field label="Date"><input type="date" style={inp} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Amount (KES)"><input type="number" min={0} step="0.01" style={inp} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" /></Field>
        <Field label="For account"><AccountPicker accounts={accounts} value={acc} onChange={setAcc} placeholder="Expense or asset…" /></Field>
        <Field label="Supplier"><input style={inp} value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="Supplier name" /></Field>
        <VatToggle on={vat} set={setVat} />
        <Field label="Memo / bill no."><input style={inp} value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="Bill ref" /></Field>
      </div>
      <VatPreview amount={amount} hasVat={vat} />
      <div style={{ marginTop: 14, textAlign: "right" }}>
        <button type="button" className="btn btn-primary" disabled={pending}
          onClick={() => run(() => postBill({ date, amount: parseFloat(amount), expenseAccountId: acc, supplierName: supplier, hasVat: vat, memo, reference: memo }),
            () => { setAmount(""); setMemo(""); setSupplier(""); })}>
          {pending ? "Posting…" : "Post bill"}
        </button>
      </div>
    </div>
  );
}

// ── Bank transfer ─────────────────────────────────────────────────────────────
function TransferForm({ data }: { data: Data }) {
  const { pending, msg, run } = useSubmit();
  const [date, setDate] = useState(today());
  const [amount, setAmount] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [memo, setMemo] = useState("");
  // transfers move between asset (cash/bank) accounts
  return (
    <div className="card" style={card}>
      <Msg msg={msg} />
      <div style={grid}>
        <Field label="Date"><input type="date" style={inp} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Amount (KES)"><input type="number" min={0} step="0.01" style={inp} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" /></Field>
        <Field label="From account"><AccountPicker accounts={data.asset} value={from} onChange={setFrom} placeholder="Source…" /></Field>
        <Field label="To account"><AccountPicker accounts={data.asset} value={to} onChange={setTo} placeholder="Destination…" /></Field>
        <Field label="Memo"><input style={inp} value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="Reason" /></Field>
      </div>
      <div style={{ marginTop: 14, textAlign: "right" }}>
        <button type="button" className="btn btn-primary" disabled={pending}
          onClick={() => run(() => postTransfer({ date, amount: parseFloat(amount), fromAccountId: from, toAccountId: to, memo }),
            () => { setAmount(""); setMemo(""); })}>
          {pending ? "Posting…" : "Post transfer"}
        </button>
      </div>
    </div>
  );
}

// ── Capital / drawings ────────────────────────────────────────────────────────
function EquityForm({ data }: { data: Data }) {
  const { pending, msg, run } = useSubmit();
  const [kind, setKind] = useState<"CAPITAL" | "DRAWINGS">("CAPITAL");
  const [date, setDate] = useState(today());
  const [amount, setAmount] = useState("");
  const [acc, setAcc] = useState("");
  const [bank, setBank] = useState("");
  const [memo, setMemo] = useState("");
  return (
    <div className="card" style={card}>
      <Msg msg={msg} />
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {(["CAPITAL", "DRAWINGS"] as const).map((k) => (
          <button key={k} type="button" onClick={() => setKind(k)}
            style={{ padding: "6px 14px", fontSize: 13, fontWeight: 700, borderRadius: "var(--radius-sm)", cursor: "pointer",
              border: "1px solid var(--border2)", background: kind === k ? "var(--accent)" : "var(--surface2)", color: kind === k ? "#fff" : "var(--muted)" }}>
            {k === "CAPITAL" ? "Capital in" : "Drawings (out)"}
          </button>
        ))}
      </div>
      <div style={grid}>
        <Field label="Date"><input type="date" style={inp} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Amount (KES)"><input type="number" min={0} step="0.01" style={inp} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" /></Field>
        <Field label="Equity account"><AccountPicker accounts={data.equity} value={acc} onChange={setAcc} placeholder="Capital or Drawings…" /></Field>
        <Field label={kind === "CAPITAL" ? "Received into" : "Paid from"}><BankPicker banks={data.banks} value={bank} onChange={setBank} /></Field>
        <Field label="Memo"><input style={inp} value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="Note" /></Field>
      </div>
      <div style={{ marginTop: 14, textAlign: "right" }}>
        <button type="button" className="btn btn-primary" disabled={pending}
          onClick={() => run(() => postEquityMovement({ kind, date, amount: parseFloat(amount), equityAccountId: acc, bankAccountId: bank || null, memo }),
            () => { setAmount(""); setMemo(""); })}>
          {pending ? "Posting…" : kind === "CAPITAL" ? "Record capital" : "Record drawings"}
        </button>
      </div>
    </div>
  );
}

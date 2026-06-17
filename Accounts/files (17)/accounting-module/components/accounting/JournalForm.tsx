"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createManualJournal } from "@/actions/accounting";
import { Plus, Trash2 } from "lucide-react";

type Account = { id: string; code: string; name: string };
type Line = { accountId: string; debit: string; credit: string; description: string };

const emptyLine = (): Line => ({ accountId: "", debit: "", credit: "", description: "" });

export function JournalForm({ accounts }: { accounts: Account[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [memo, setMemo] = useState("");
  const [lines, setLines] = useState<Line[]>([emptyLine(), emptyLine()]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const totalDebit = lines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
  const balanced = Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0;

  function update(i: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  function submit() {
    setMsg(null);
    const payload = lines
      .filter((l) => l.accountId && (parseFloat(l.debit) > 0 || parseFloat(l.credit) > 0))
      .map((l) => ({
        accountId: l.accountId,
        debit: parseFloat(l.debit) || 0,
        credit: parseFloat(l.credit) || 0,
        description: l.description || undefined,
      }));
    if (payload.length < 2) return setMsg({ ok: false, text: "Add at least two lines" });
    if (!balanced) return setMsg({ ok: false, text: "Debits must equal credits" });

    startTransition(async () => {
      const res = await createManualJournal({ date, memo: memo || undefined, lines: payload });
      if (res.success) {
        setMsg({ ok: true, text: `Posted ${res.entryNumber}` });
        setLines([emptyLine(), emptyLine()]); setMemo("");
        router.refresh();
      } else {
        setMsg({ ok: false, text: res.error || "Could not post" });
      }
    });
  }

  return (
    <div className="card" style={{ padding: 20 }}>
      {msg && (
        <div style={{
          padding: "8px 12px", borderRadius: "var(--radius-sm)", marginBottom: 12, fontSize: 13,
          background: msg.ok ? "rgba(46,125,50,0.12)" : "rgba(239,68,68,0.1)",
          color: msg.ok ? "#2E7D32" : "#fca5a5",
        }}>{msg.text}</div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 12, marginBottom: 16 }}>
        <div>
          <label style={lbl}>Date</label>
          <input type="date" style={inp} value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <label style={lbl}>Memo</label>
          <input style={inp} value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="What is this entry for?" />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2.5fr 1fr 1fr 32px", gap: 10, marginBottom: 6 }}>
        <span style={lbl}>Account</span><span style={lbl}>Debit</span><span style={lbl}>Credit</span><span />
      </div>
      {lines.map((line, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "2.5fr 1fr 1fr 32px", gap: 10, marginBottom: 8, alignItems: "center" }}>
          <select style={inp} value={line.accountId} onChange={(e) => update(i, { accountId: e.target.value })}>
            <option value="">Select account…</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
          </select>
          <input style={inp} type="number" min={0} step="0.01" value={line.debit}
            onChange={(e) => update(i, { debit: e.target.value, credit: e.target.value ? "" : line.credit })} placeholder="0.00" />
          <input style={inp} type="number" min={0} step="0.01" value={line.credit}
            onChange={(e) => update(i, { credit: e.target.value, debit: e.target.value ? "" : line.debit })} placeholder="0.00" />
          <button type="button" onClick={() => setLines((p) => p.length <= 2 ? p : p.filter((_, idx) => idx !== i))}
            className="btn btn-ghost btn-sm" style={{ color: "#ef4444", padding: 6 }}><Trash2 size={14} /></button>
        </div>
      ))}

      <button type="button" onClick={() => setLines((p) => [...p, emptyLine()])} className="btn btn-ghost btn-sm" style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
        <Plus size={14} /> Add line
      </button>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--border2)" }}>
        <div style={{ fontSize: 13, fontFamily: "monospace" }}>
          Debits <strong>{totalDebit.toFixed(2)}</strong> · Credits <strong>{totalCredit.toFixed(2)}</strong>{" "}
          <span style={{ color: balanced ? "#2E7D32" : "#b91c1c", fontWeight: 700 }}>
            {balanced ? "Balanced ✓" : "Not balanced"}
          </span>
        </div>
        <button type="button" className="btn btn-primary" disabled={pending || !balanced} onClick={submit}>
          {pending ? "Posting…" : "Post entry"}
        </button>
      </div>
    </div>
  );
}

const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4, display: "block" };
const inp: React.CSSProperties = { width: "100%", padding: "8px 10px", background: "var(--surface2)", border: "1px solid var(--border2)", borderRadius: "var(--radius-sm)", color: "var(--text)", fontSize: 14 };

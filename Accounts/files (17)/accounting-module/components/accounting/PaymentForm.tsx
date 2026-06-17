"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { recordPayment } from "@/actions/accounting-ar-ap";

type Opt = { id: string; name: string };

export function PaymentForm({
  banks,
  customers,
  suppliers,
}: {
  banks: Opt[];
  customers: Opt[];
  suppliers: Opt[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [direction, setDirection] = useState<"RECEIVED" | "PAID">("RECEIVED");
  const [partyId, setPartyId] = useState("");
  const [bankId, setBankId] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState<"CASH" | "BANK_TRANSFER" | "MPESA" | "CHEQUE" | "CARD" | "OTHER">("BANK_TRANSFER");
  const [reference, setReference] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const parties = direction === "RECEIVED" ? customers : suppliers;

  function submit() {
    setMsg(null);
    const amt = parseFloat(amount);
    if (!Number.isFinite(amt) || amt <= 0) return setMsg({ ok: false, text: "Enter a valid amount" });
    if (!partyId) return setMsg({ ok: false, text: direction === "RECEIVED" ? "Select a customer" : "Select a supplier" });

    startTransition(async () => {
      const res = await recordPayment({
        direction,
        amount: amt,
        date,
        method,
        customerId: direction === "RECEIVED" ? partyId : null,
        supplierId: direction === "PAID" ? partyId : null,
        bankAccountId: bankId || null,
        reference: reference || undefined,
      });
      if (res.success) {
        setMsg({ ok: true, text: `Recorded ${res.paymentNumber} · journal ${res.entryNumber}` });
        setAmount(""); setReference(""); setPartyId("");
        router.refresh();
      } else {
        setMsg({ ok: false, text: res.error || "Could not record payment" });
      }
    });
  }

  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{ fontWeight: 700, marginBottom: 12 }}>Record a payment</div>

      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {(["RECEIVED", "PAID"] as const).map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => { setDirection(d); setPartyId(""); }}
            style={{
              padding: "8px 16px", fontSize: 13, fontWeight: 700, borderRadius: "var(--radius-sm)",
              cursor: "pointer", border: "1px solid var(--border2)",
              background: direction === d ? "var(--accent)" : "var(--surface2)",
              color: direction === d ? "#fff" : "var(--muted)",
            }}
          >
            {d === "RECEIVED" ? "Money in (from customer)" : "Money out (to supplier)"}
          </button>
        ))}
      </div>

      {msg && (
        <div style={{
          padding: "8px 12px", borderRadius: "var(--radius-sm)", marginBottom: 12, fontSize: 13,
          background: msg.ok ? "rgba(46,125,50,0.12)" : "rgba(239,68,68,0.1)",
          color: msg.ok ? "#2E7D32" : "#fca5a5",
        }}>{msg.text}</div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
        <Field label={direction === "RECEIVED" ? "Customer" : "Supplier"}>
          <select style={inp} value={partyId} onChange={(e) => setPartyId(e.target.value)}>
            <option value="">Select…</option>
            {parties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
        <Field label="Amount (KES)">
          <input style={inp} type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
        </Field>
        <Field label="Date">
          <input style={inp} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Into / from account">
          <select style={inp} value={bankId} onChange={(e) => setBankId(e.target.value)}>
            <option value="">Cash on hand</option>
            {banks.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </Field>
        <Field label="Method">
          <select style={inp} value={method} onChange={(e) => setMethod(e.target.value as any)}>
            <option value="BANK_TRANSFER">Bank transfer</option>
            <option value="MPESA">M-Pesa</option>
            <option value="CASH">Cash</option>
            <option value="CHEQUE">Cheque</option>
            <option value="CARD">Card</option>
            <option value="OTHER">Other</option>
          </select>
        </Field>
        <Field label="Reference (optional)">
          <input style={inp} value={reference} onChange={(e) => setReference(e.target.value)} placeholder="M-Pesa code, cheque no…" />
        </Field>
      </div>

      <div style={{ marginTop: 14, textAlign: "right" }}>
        <button type="button" className="btn btn-primary" disabled={pending} onClick={submit}>
          {pending ? "Recording…" : "Record payment"}
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4, display: "block" }}>
        {label}
      </label>
      {children}
    </div>
  );
}

const inp: React.CSSProperties = {
  width: "100%", padding: "8px 10px", background: "var(--surface2)",
  border: "1px solid var(--border2)", borderRadius: "var(--radius-sm)", color: "var(--text)", fontSize: 14,
};

import { useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";
import {
  CLASSIFICATION_OPTIONS,
  type Classification,
  type StatementGroup,
} from "@/lib/accounting/classifications";
import { useCreateClassifiedAccount, type ParentAccountOption } from "@/lib/api";

export function AddAccountForm({
  statementGroup,
  groupLabel,
  parents,
  onDone,
}: {
  statementGroup: StatementGroup;
  groupLabel: string;
  parents: ParentAccountOption[];
  onDone: () => void;
}) {
  const createAccount = useCreateClassifiedAccount();
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("KES");
  const [classification, setClassification] = useState<Classification | "">("");
  const [parentId, setParentId] = useState("");
  const [description, setDescription] = useState("");
  const [note, setNote] = useState("");
  const [vatApplicable, setVatApplicable] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      toast.error("Account name is required");
      return;
    }
    if (!classification) {
      toast.error("Pick a classification");
      return;
    }

    try {
      const result = await createAccount.mutateAsync({
        name,
        currency,
        classification,
        statementGroup,
        parentId: parentId || null,
        description: description || null,
        note: note || null,
        vatApplicable,
      });
      toast.success(`Account ${result.code} created`);
      setName("");
      setCurrency("KES");
      setClassification("");
      setParentId("");
      setDescription("");
      setNote("");
      setVatApplicable(false);
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create account");
    }
  };

  return (
    <form className="account-add-form create-form" onSubmit={submit}>
      <div className="account-add-form-heading">
        Add account under <strong>{groupLabel}</strong>
      </div>

      <div className="form-grid">
        <Field label="Account name *">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Diesel fuel" required />
        </Field>
        <Field label="Currency">
          <input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} />
        </Field>
        <Field label="Classification *">
          <select value={classification} onChange={(e) => setClassification(e.target.value as Classification | "")} required>
            <option value="">Select classification</option>
            {CLASSIFICATION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Sub-account of">
          <select value={parentId} onChange={(e) => setParentId(e.target.value)}>
            <option value="">None - main account</option>
            {parents.map((parent) => (
              <option key={parent.id} value={parent.id}>
                {parent.code} - {parent.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Description">
          <input value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <Field label="Note">
          <input value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>

      <label className="account-checkbox">
        <input
          type="checkbox"
          checked={vatApplicable}
          onChange={(e) => setVatApplicable(e.target.checked)}
        />
        VAT applies to this account
      </label>

      <div className="form-actions">
        <button type="button" className="button button-secondary" onClick={onDone} disabled={createAccount.isPending}>
          Cancel
        </button>
        <button type="submit" className="button button-primary" disabled={createAccount.isPending}>
          {createAccount.isPending ? "Saving..." : "Save account"}
        </button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label>
      {label}
      {children}
    </label>
  );
}

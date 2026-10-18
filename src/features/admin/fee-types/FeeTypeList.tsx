import { useState } from "react";
import { Plus, X } from "@phosphor-icons/react";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { EmptyState } from "../../../components/ui/EmptyState";
import { Field, inputClass } from "../../../components/ui/Field";
import { Modal } from "../../../components/ui/Modal";
import { useFees } from "../../../data/feeStore";
import { MASTER, type FeeType } from "../../../data/fees";
import { useRegistry } from "../../../data/registryStore";
import { LEVELS, type Level } from "../../../data/students";
import { formatSGD } from "../../../lib/format";
import { TODAY, feeDraftOk, nextFeeTypeId, validateFeeType, type FeeDraft } from "../../../lib/fees";
import { selectClass } from "./parts";

const FORM_ID = "fee-type-form";
const BLANK: FeeDraft = { name: "", level: "", components: [{ name: "", amount: "", on: true }] };
const total = (f: FeeType) => f.components.reduce((t, c) => t + c.amount, 0);
const scopeOf = (f: FeeType) => f.scope ?? f.level ?? "All levels";

/** Fee catalogue. School user: this school's own fees (US-013). HQ (`school` = MASTER): the MOE-wide master catalogue. */
export default function FeeTypeList({ school, onAssign }: { school: string; onAssign?: (id: string) => void }) {
  const master = school === MASTER;
  const { state, dispatch } = useFees();
  const mine = state.types.filter((f) => f.school === school);
  const [filter, setFilter] = useState("");
  const [editing, setEditing] = useState<{ id: string; draft: FeeDraft } | null>(null);
  const [notice, setNotice] = useState("");
  const { state: reg } = useRegistry();
  const schoolName = reg.schools.find((s) => s.code === school)?.name ?? school;
  const scopes = master ? ["Primary", "Secondary"] : [...new Set(mine.map((f) => f.level).filter(Boolean))] as string[];
  const shown = mine.filter((f) => !filter || (master ? !f.scope || f.scope === filter : !f.level || f.level === filter));
  const noun = master ? "MOE Bill" : "School Bill";
  const openNew = () => setEditing({ id: "", draft: BLANK });
  const openEdit = (f: FeeType) => setEditing({ id: f.id, draft: { name: f.name, level: (master ? f.scope : f.level) ?? "", components: f.components.map((c) => ({ name: c.name, amount: String(c.amount), on: true })) } });

  return (
    <div className="space-y-4">
      <Button icon={<Plus size={18} weight="bold" aria-hidden="true" />} onClick={openNew}>New {noun}</Button>
      <div className="flex flex-wrap items-center gap-3">
        <select aria-label="Filter by level" className={selectClass} value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">{master ? "All fee types: all level scopes" : "All levels"}</option>
          {scopes.map((l) => <option key={l} value={l}>{master ? `${l} schools` : l}</option>)}
        </select>
        <span className="text-[13px] text-on-surface-variant">{shown.length} fee types shown{master ? ". All-levels types appear under both filters" : ". Fees without a level apply to every level"}</span>
        <p role="status" className="text-sm font-medium text-success empty:hidden">{notice}</p>
      </div>
      {shown.length === 0 && <Card><EmptyState title="No fee types yet" hint="Create a fee type, then assign it to a class." /></Card>}
      {shown.map((f) => (
        <Card key={f.id} className="!p-0">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
            <div>
              <h2 className="flex flex-wrap items-center gap-2 text-[15px] font-semibold">
                {f.name} <Badge tone={master ? "primary" : "alert"}>{master ? scopeOf(f) : schoolName}</Badge>
              </h2>
              {!master && (
                <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[13px] text-on-surface-variant">
                  <b>School Bill</b> · <code>{f.id}</code> · updated {f.updated} · <Badge tone="neutral">{scopeOf(f)}</Badge>
                </p>
              )}
            </div>
            <div className="flex items-center gap-4">
              {!master && <span className="text-base font-bold tabular-nums">{formatSGD(total(f))}</span>}
              <Button size="sm" variant="secondary" onClick={() => openEdit(f)}>{master ? "Edit" : "Edit fee"}<span className="sr-only"> {f.name}</span></Button>
              {!master && onAssign && <Button size="sm" variant="ghost" onClick={() => onAssign(f.id)}>Assign</Button>}
            </div>
          </div>
          <div className="px-5 pb-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-container-low text-left text-[13px] uppercase tracking-wide text-on-surface-variant">
                  <th className="px-3 py-2 font-semibold">Component</th>
                  <th className="px-3 text-right font-semibold">{master ? "Default amount" : "Amount"}</th>
                </tr>
              </thead>
              <tbody>
                {f.components.map((c) => (
                  <tr key={c.name} className="border-b border-line">
                    <td className="px-3 py-2.5">{c.name}</td>
                    <td className="px-3 text-right tabular-nums">{formatSGD(c.amount)}</td>
                  </tr>
                ))}
                <tr className="bg-surface-container-low font-semibold">
                  <td className="px-3 py-2.5">{master ? "Total (all components)" : "Total (sum of components)"}</td>
                  <td className="px-3 text-right tabular-nums text-primary">{formatSGD(total(f))}</td>
                </tr>
              </tbody>
            </table>
            {!master && <p className="mt-3 text-[13px] text-on-surface-variant">Charges already issued from this fee keep their original amounts. Editing applies to future generations only (billing snapshot).</p>}
          </div>
        </Card>
      ))}

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id ? `Edit ${noun} — ${editing.id}` : `New ${noun}`}
        footer={<><Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button><Button type="submit" form={FORM_ID}>Save {noun}</Button></>}
      >
        {editing && (
          <FeeTypeForm
            key={editing.id || "new"}
            school={school}
            master={master}
            initial={editing.draft}
            others={mine.filter((f) => f.id !== editing.id)}
            id={editing.id || (master ? `M${nextFeeTypeId(state.types)}` : nextFeeTypeId(state.types))}
            onSave={(fee) => {
              dispatch({ type: "saveType", fee });
              setNotice(editing.id ? "Fee type updated. Issued charges keep their original amounts." : "Fee type created.");
              setEditing(null);
            }}
          />
        )}
      </Modal>
    </div>
  );
}

function FeeTypeForm({ school, master, initial, others, id, onSave }: { school: string; master: boolean; initial: FeeDraft; others: FeeType[]; id: string; onSave: (f: FeeType) => void }) {
  const [d, setD] = useState(initial);
  const [tried, setTried] = useState(false);
  const { errors, components } = validateFeeType(d, others);
  const { state: reg } = useRegistry();
  const kind = reg.schools.find((s) => s.code === school)?.level;
  const levels = kind ? LEVELS.filter((l) => (kind === "Primary") === l.startsWith("P")) : [];
  const setRow = (i: number, p: Partial<FeeDraft["components"][number]>) => setD((x) => ({ ...x, components: x.components.map((c, j) => (j === i ? { ...c, ...p } : c)) }));
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (!feeDraftOk(errors)) return;
    const name = d.name.trim().replace(/\s+/g, " ");
    onSave(master
      ? { id, school, name, scope: (d.level || undefined) as FeeType["scope"], components, updated: TODAY }
      : { id, school, name, level: (d.level || undefined) as Level | undefined, components, updated: TODAY });
  };
  const sum = components.reduce((t, c) => t + c.amount, 0);

  return (
    <form id={FORM_ID} onSubmit={submit} noValidate className="grid gap-4">
      <Field required label="Fee name" error={tried ? errors.name : ""}>
        <input className={inputClass} placeholder="e.g. School Fees (Secondary)" value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} />
      </Field>
      <Field label={master ? "Level scope" : "Level / cohort (optional)"}>
        <select className={inputClass} value={d.level} onChange={(e) => setD({ ...d, level: e.target.value })}>
          <option value="">All levels</option>
          {master ? ["Primary", "Secondary"].map((l) => <option key={l}>{l}</option>) : levels.map((l) => <option key={l}>{l}</option>)}
        </select>
      </Field>
      <fieldset>
        <legend className="mb-1.5 text-[13px] font-semibold">Components <span aria-hidden className="text-alert">*</span></legend>
        <div className="grid gap-2">
          {d.components.map((c, i) => (
            <div key={i} className="flex items-center gap-2">
              <input className={inputClass} aria-label={`Component ${i + 1} name`} placeholder="Component name" value={c.name} onChange={(e) => setRow(i, { name: e.target.value })} aria-invalid={tried && !!errors.rows[i]} />
              <input className={inputClass.replace("w-full", "w-28 shrink-0")} aria-label={`Component ${i + 1} amount`} inputMode="decimal" placeholder="Amount" value={c.amount} onChange={(e) => setRow(i, { amount: e.target.value })} aria-invalid={tried && !!errors.rows[i]} />
              <Button size="sm" variant="ghost" aria-label={`Remove component ${i + 1}`} onClick={() => setD((x) => ({ ...x, components: x.components.length > 1 ? x.components.filter((_, j) => j !== i) : [{ name: "", amount: "", on: true }] }))}><X size={16} className="text-alert" aria-hidden="true" /></Button>
            </div>
          ))}
        </div>
        <div className="mt-2 flex justify-end">
          <Button size="sm" variant="secondary" icon={<Plus size={14} aria-hidden="true" />} onClick={() => setD((x) => ({ ...x, components: [...x.components, { name: "", amount: "", on: true }] }))}>Add component</Button>
        </div>
        <p className="mt-1.5 text-[13px] text-on-surface-variant">{components.length} component{components.length === 1 ? "" : "s"} · total {formatSGD(sum)}</p>
        {tried && errors.components && <p role="alert" className="mt-1 text-[13px] font-medium text-alert">{errors.components}</p>}
        {tried && Object.keys(errors.rows).length > 0 && <p role="alert" className="mt-1 text-[13px] font-medium text-alert">Each component needs a name and an amount above 0 (max 2 decimals).</p>}
      </fieldset>
    </form>
  );
}

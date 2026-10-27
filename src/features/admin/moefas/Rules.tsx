import { Fragment, useState } from "react";
import { ArrowLeft, Plus } from "@phosphor-icons/react";
import { Badge, type BadgeTone } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { DataTable, RowAction, type Column } from "../../../components/ui/DataTable";
import { EmptyState } from "../../../components/ui/EmptyState";
import { Field, inputClass } from "../../../components/ui/Field";
import { Modal } from "../../../components/ui/Modal";
import {
  activateRule, allowedIds, sgToday, blankRule, CATALOGUE, componentName, FEE_KINDS, nextRuleId, ruleProblem,
  type Basis, type FeeKind, type Rule, type RuleStatus, type TierConfig, type TierKind,
} from "../../../data/moefas";
import { formatSGD } from "../../../lib/format";

const TONE: Record<RuleStatus, BadgeTone> = { Active: "success", Draft: "neutral", Inactive: "neutral", Pending: "warning", Canceled: "alert" };
const th = "whitespace-nowrap border-b border-line bg-surface-container-low px-3 py-3 text-left text-[13px] font-medium text-on-surface-variant";
const td = "border-b border-line px-3 py-2 align-top";
const cell = "min-h-10 rounded-control border border-outline bg-surface-container-lowest px-2 text-sm disabled:opacity-70";

type Notify = (m: string, bad?: boolean) => void;
type Props = { rules: Rule[]; setRules: (r: Rule[]) => void; tiers: TierConfig; notify: Notify };

function Editor({ initial, isNew, readOnly, tiers, onBack, onSave, notify }: { initial: Rule; isNew: boolean; readOnly: boolean; tiers: TierConfig; onBack: () => void; onSave: (r: Rule, activate: boolean) => void; notify: Notify }) {
  const [d, setD] = useState<Rule>(() => structuredClone(initial));
  const [picker, setPicker] = useState(isNew);
  const [picked, setPicked] = useState<FeeKind[]>([]);
  const [kind, setKind] = useState("");
  const patch = (p: Partial<Rule>) => setD((x) => ({ ...x, ...p }));
  const setCond = (i: number, k: TierKind, v: number) => patch({ conditions: d.conditions.map((c, j) => (j === i ? { ...c, [k]: v } : c)) });
  const setRow = (i: number, p: Partial<Rule["components"][number]>) => patch({ components: d.components.map((c, j) => (j === i ? { ...c, ...p } : c)) });
  const addRow = (type: FeeKind) => ({ id: "", type, basis: "percent" as Basis, amounts: d.conditions.map(() => 0) });
  const hasFree = (type: FeeKind) => CATALOGUE.filter((c) => c.type === type).length > d.components.filter((c) => c.type === type).length;
  const addCondition = () => {
    const free = (k: TierKind) => allowedIds(tiers, k).find((id) => !d.conditions.some((c) => c[k] === id));
    const ghi = free("ghi"), pci = free("pci");
    if (ghi === undefined || pci === undefined) return notify("All available MOEFAS tiers are already used. Each tier can only be used in one condition.", true);
    patch({ conditions: [...d.conditions, { ghi, pci }], components: d.components.map((c) => ({ ...c, amounts: [...c.amounts, 0] })) });
  };
  const removeCondition = () => {
    if (d.conditions.length <= 1 || !window.confirm("Remove the last condition and its subsidy values?")) return;
    patch({ conditions: d.conditions.slice(0, -1), components: d.components.map((c) => ({ ...c, amounts: c.amounts.slice(0, -1) })) });
  };
  const tierOptions = (k: TierKind, i: number) => {
    const used = new Map(d.conditions.flatMap((c, j) => (j !== i && c[k] >= 0 ? [[c[k], j + 1] as const] : [])));
    return allowedIds(tiers, k).map((id) => {
      const [lo, hi] = tiers[k].ranges[id], u = used.get(id);
      return <option key={id} value={id} disabled={u !== undefined}>Tier {id + 1} · {formatSGD(lo)} – {formatSGD(hi)}{u !== undefined ? ` · used in Condition ${u}` : ""}</option>;
    });
  };
  const kinds = [...new Set(d.components.map((c) => c.type))];

  return (
    <form noValidate onSubmit={(e) => e.preventDefault()} className="space-y-4">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 rounded text-sm font-semibold text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
        <ArrowLeft size={16} weight="bold" aria-hidden="true" /> FAS Rules
      </button>
      <h2 className="text-2xl font-bold tracking-tight">{readOnly ? "View rule" : isNew ? "Create rule" : "Edit rule"}</h2>
      <Card title="MOEFAS · Assessment rules" action={<Badge tone={TONE[d.status]}>{d.status === "Draft" && !readOnly ? "Editable draft" : d.status}</Badge>}>
        <p className="text-sm text-on-surface-variant">Select MOE fee types, choose income conditions, then set subsidies for each component.</p>
        <fieldset disabled={readOnly} className="mt-5 min-w-0 space-y-6 disabled:opacity-90">
          <section>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold">1. Select fee types</h3>
                <p className="mt-1 text-[13px] text-on-surface-variant">Select MOE fee types. Choose their components in the subsidy table below.</p>
              </div>
              <Button variant="secondary" icon={<Plus size={16} weight="bold" aria-hidden="true" />} onClick={() => setPicker((o) => !o)}>Add fee types</Button>
            </div>
            {picker && (
              <div className="mt-4 rounded-control bg-surface-container-low p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <b className="text-sm">Fee types</b>
                  <div className="flex items-center gap-2">
                    <select className={`${cell} min-h-9`} aria-label="Filter fee type" value={kind} onChange={(e) => setKind(e.target.value)}>
                      <option value="">All fee types</option>
                      {FEE_KINDS.map((k) => <option key={k}>{k}</option>)}
                    </select>
                    <Button size="sm" variant="secondary" onClick={() => setPicker(false)}>Close</Button>
                  </div>
                </div>
                <div className="mt-2">
                  {FEE_KINDS.filter((k) => !kind || k === kind).map((k) => {
                    const exists = d.components.some((c) => c.type === k);
                    return (
                      <label key={k} className="flex items-center gap-3 border-b border-line py-3 text-sm last:border-0">
                        <input type="checkbox" className="size-4 accent-primary" checked={exists || picked.includes(k)} disabled={exists}
                          onChange={(e) => setPicked(e.target.checked ? [...picked, k] : picked.filter((x) => x !== k))} />
                        <span><b>{k}</b>{exists && <span className="block text-[13px] text-on-surface-variant">Already selected</span>}</span>
                      </label>
                    );
                  })}
                </div>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <p className="text-[13px] text-on-surface-variant">School-created components are not available for selection.</p>
                  <Button size="sm" disabled={!picked.length} onClick={() => { patch({ components: [...d.components, ...picked.map(addRow)] }); setPicked([]); setPicker(false); }}>Add selected fee types</Button>
                </div>
              </div>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              {kinds.length ? kinds.map((k) => <span key={k} className="rounded-full bg-track px-3 py-1 text-xs font-semibold text-on-surface-variant">{k}</span>) : <span className="text-[13px] text-on-surface-variant">No fee types selected. Choose one or more MOE fee types above.</span>}
            </div>
          </section>

          <section className="border-t border-line pt-6">
            <h3 className="text-sm font-bold">2. Configure conditions</h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Rule name" required><input className={inputClass} value={d.name} onChange={(e) => patch({ name: e.target.value })} /></Field>
              <Field label="Effective from" required hint="A future date schedules the rule: it shows as Pending and becomes Active on this date."><input type="date" className={inputClass} value={d.effectiveFrom ?? ""} onChange={(e) => patch({ effectiveFrom: e.target.value })} /></Field>
            </div>
            <p className="mt-4 rounded-control bg-surface-container-low p-3 text-sm">Select existing MOEFAS tiers. Income ranges are maintained in Income tiers.</p>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[620px] border-collapse text-sm">
                <thead><tr><th className={th}>Condition</th><th className={th}>GHI tier</th><th className={th}>Logic</th><th className={th}>PCI tier</th></tr></thead>
                <tbody>
                  {d.conditions.map((c, i) => (
                    <tr key={i}>
                      <td className={`${td} font-semibold`}>Condition {i + 1}</td>
                      {(["ghi", "pci"] as const).map((k, n) => (
                        <Fragment key={k}>
                          {n === 1 && <td className={`${td} font-bold`}>OR</td>}
                          <td className={td}>
                            <select required className={`${cell} w-full`} aria-label={`Condition ${i + 1} ${k.toUpperCase()} tier`} value={c[k] < 0 ? "" : c[k]} onChange={(e) => setCond(i, k, e.target.value === "" ? -1 : Number(e.target.value))}>
                              <option value="">Select tier</option>
                              {tierOptions(k, i)}
                            </select>
                          </td>
                        </Fragment>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-[13px] text-on-surface-variant">A child matches a condition when either GHI or PCI falls in the selected tier — one is enough. A tier can only be used in one condition, so conditions never overlap. Each condition has its own subsidy values below.</p>
            <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
              <span className="mr-auto text-[13px] text-on-surface-variant">{d.conditions.length} {d.conditions.length === 1 ? "condition" : "conditions"}</span>
              <Button size="sm" variant="secondary" icon={<Plus size={16} weight="bold" aria-hidden="true" />} onClick={addCondition}>Add condition</Button>
              <Button size="sm" variant="secondary" disabled={d.conditions.length <= 1} onClick={removeCondition}>Remove last condition</Button>
            </div>
          </section>

          <section className="border-t border-line pt-6">
            <h3 className="text-sm font-bold">3. Subsidy by condition and fee component</h3>
            <p className="mt-1 text-[13px] text-on-surface-variant">Set the subsidy for each condition. Choose a MOE fee component and percentage or fixed amount.</p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-sm">
                <thead><tr><th className={th}>Fee type</th><th className={th}>Fee component</th><th className={th}>Basis</th>{d.conditions.map((_, i) => <th key={i} className={th}>Condition {i + 1}</th>)}<th className={th}>Action</th></tr></thead>
                <tbody>
                  {d.components.map((c, i) => (
                    <tr key={i}>
                      <td className={td}>
                        <b>{c.type}</b>
                        <Button size="sm" variant="secondary" className="mt-2" disabled={!hasFree(c.type)} onClick={() => patch({ components: [...d.components, addRow(c.type)] })}>+ Component</Button>
                      </td>
                      <td className={td}>
                        <select required className={`${cell} min-w-40`} aria-label={`${c.type} component`} value={c.id} onChange={(e) => setRow(i, { id: e.target.value })}>
                          <option value="">Select component</option>
                          {CATALOGUE.filter((m) => m.type === c.type).map((m) => <option key={m.id} value={m.id} disabled={d.components.some((z, j) => j !== i && z.id === m.id)}>{m.name}</option>)}
                        </select>
                        {c.id && <span className="mt-1 block text-[13px] text-on-surface-variant">{c.id}</span>}
                      </td>
                      <td className={td}>
                        <select className={cell} aria-label={`${c.type} subsidy basis`} value={c.basis} onChange={(e) => setRow(i, { basis: e.target.value as Basis })}>
                          <option value="percent">Percentage (%)</option>
                          <option value="fixed">Fixed amount (SGD)</option>
                        </select>
                      </td>
                      {d.conditions.map((_, t) => (
                        <td key={t} className={td}>
                          <input type="number" required min={0} max={c.basis === "percent" ? 100 : undefined} step="0.01" className={`${cell} w-24`} aria-label={`${c.id ? componentName(c.id) : c.type} Condition ${t + 1}`}
                            value={c.amounts[t]} onChange={(e) => setRow(i, { amounts: c.amounts.map((a, j) => (j === t ? (e.target.value === "" ? "" : Number(e.target.value)) : a)) })} />
                        </td>
                      ))}
                      <td className={td}><Button size="sm" variant="ghost" onClick={() => patch({ components: d.components.filter((_, j) => j !== i) })}>Remove</Button></td>
                    </tr>
                  ))}
                  {!d.components.length && <tr><td colSpan={d.conditions.length + 4} className="px-3 py-8 text-center text-on-surface-variant">No components selected. Add MOE fee components to configure subsidies.</td></tr>}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-[13px] text-on-surface-variant">Only selected components receive a subsidy. A charge must reference the matching MOE master component.</p>
          </section>
        </fieldset>
        {!readOnly && (
          <div className="mt-6 flex justify-end gap-3">
            <Button variant="secondary" onClick={onBack}>Cancel</Button>
            <Button variant="secondary" onClick={() => onSave(d, false)}>Save draft</Button>
            <Button onClick={() => onSave(d, true)}>Activate</Button>
          </div>
        )}
      </Card>
    </form>
  );
}

export default function Rules({ rules, setRules, tiers, notify }: Props) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [editing, setEditing] = useState<{ rule: Rule; isNew: boolean; readOnly: boolean } | null>(null);
  const [activating, setActivating] = useState<Rule | null>(null);
  const [cancelling, setCancelling] = useState<Rule | null>(null);
  const cancel = () => {
    if (!cancelling) return;
    setRules(rules.map((x) => (x.id === cancelling.id ? { ...x, status: "Canceled" } : x)));
    setCancelling(null);
    notify(`Scheduled rule ${cancelling.id} cancelled. It is now Canceled and will not become Active.`);
  };

  const requestActivation = (r: Rule) => {
    const problem = ruleProblem(r, tiers);
    if (problem) return notify(problem, true);
    setActivating(r);
  };
  const activate = () => {
    if (!activating) return;
    const later = !!activating.effectiveFrom && activating.effectiveFrom > sgToday();
    const r: Rule = { ...activating, status: later ? "Pending" : "Active" };
    const next = rules.some((x) => x.id === r.id) ? rules.map((x) => (x.id === r.id ? r : x)) : [...rules, r];
    setRules(later ? next : activateRule(next, r.id));
    setActivating(null); setEditing(null); setQ(""); setStatus("");
    notify(later ? `Rule scheduled. It is Pending and becomes Active on ${r.effectiveFrom}. You can cancel it before then.` : "Rule activated. The previous active rule is now Inactive. Previous application outcomes remain unchanged.");
  };
  const duplicate = (r: Rule) => {
    let id: string;
    try { id = nextRuleId(rules); } catch (e) { return notify((e as Error).message, true); }
    notify(""); setEditing({ rule: { ...structuredClone(r), id, name: `${r.name} (copy)`, status: "Draft" }, isNew: true, readOnly: false });
  };
  const save = (r: Rule, wantActive: boolean) => {
    if (!editing) return;
    let id: string;
    try { id = editing.rule.status === "Inactive" ? nextRuleId(rules) : editing.rule.id; } catch (e) { return notify((e as Error).message, true); }
    const record: Rule = { ...r, id, name: r.name.trim(), status: "Draft" };
    if (!record.effectiveFrom) return notify("Effective from date is required.", true);
    if (wantActive) return requestActivation(record);
    const problem = ruleProblem(record, tiers, true);
    if (problem) return notify(problem, true);
    setRules(rules.some((x) => x.id === id) ? rules.map((x) => (x.id === id ? record : x)) : [...rules, record]);
    setEditing(null); setQ(""); setStatus("");
    notify("Draft saved.");
  };

  if (editing) {
    return (
      <>
        <Editor key={editing.rule.id} initial={editing.rule} isNew={editing.isNew} readOnly={editing.readOnly} tiers={tiers} notify={notify} onBack={() => setEditing(null)} onSave={save} />
        <ActivateModal rule={activating} current={rules.find((r) => r.status === "Active")} onClose={() => setActivating(null)} onConfirm={activate} />
      </>
    );
  }

  const current = rules.find((r) => r.status === "Active");
  const list = rules.filter((r) => `${r.id} ${r.name}`.toLowerCase().includes(q.trim().toLowerCase()) && (!status || r.status === status));
  const columns: Column<Rule>[] = [
    { key: "id", header: "Rule ID", sortable: true, render: (r) => <span className="font-semibold">{r.id}</span> },
    { key: "name", header: "Rule name", sortable: true, render: (r) => r.name },
    { key: "effectiveFrom", header: "Effective date", render: (r) => r.effectiveFrom ?? "—" },
    { key: "components", header: "Fee components", render: (r) => r.components.filter((c) => c.id).length },
    { key: "conditions", header: "Ranks", render: (r) => r.conditions.length },
    { key: "status", header: "Status", render: (r) => <Badge tone={TONE[r.status]}>{r.status}</Badge> },
  ];

  return (
    <>
      <Card
        title="FAS Rules"
        action={<Button icon={<Plus size={16} weight="bold" aria-hidden="true" />} onClick={() => { notify(""); setEditing({ rule: blankRule(nextRuleId(rules)), isNew: true, readOnly: false }); }}>Create rule</Button>}
      >
        <p className="mb-4 text-sm text-on-surface-variant">Configure MOEFAS eligibility and subsidies for MOE fee components.</p>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <input className={`${inputClass} max-w-sm`} aria-label="Search rules" placeholder="Search rule name or ID" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className={`${inputClass} max-w-48`} aria-label="Filter rule status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option><option>Active</option><option>Inactive</option><option>Draft</option><option>Pending</option><option>Canceled</option>
          </select>
        </div>
        <DataTable
          columns={columns}
          rows={list}
          rowKey={(r) => r.id}
          large
          rowActions={(r) => (
            <>
              <RowAction onClick={() => { notify(""); setEditing({ rule: r, isNew: false, readOnly: true }); }}>View</RowAction>
              <RowAction onClick={() => duplicate(r)}>Duplicate</RowAction>
              {r.status !== "Active" && r.status !== "Pending" && r.status !== "Canceled" && <RowAction onClick={() => requestActivation(r)}>Activate</RowAction>}
              {r.status === "Pending" && <RowAction onClick={() => setCancelling(r)}>Cancel</RowAction>}
            </>
          )}
          empty={<EmptyState title="No matching rules" hint="Try another search or status." action={<Button variant="secondary" onClick={() => { setQ(""); setStatus(""); }}>Reset</Button>} />}
        />
        <p className="mt-3 text-[13px] text-on-surface-variant">Only one rule can be Active at a time. Activating a rule makes the previous Active rule Inactive. Future rules remain Pending until their effective date; cancelling changes the status to Canceled.</p>
      </Card>
      <Modal open={!!cancelling} onClose={() => setCancelling(null)} title="Cancel scheduled rule?"
        footer={<><Button variant="secondary" onClick={() => setCancelling(null)}>Keep schedule</Button><Button onClick={cancel}>Cancel rule</Button></>}>
        <p>Cancel <b>{cancelling?.name}</b>? It was set to become Active on {cancelling?.effectiveFrom}. Its status changes to Canceled, and the current active rule stays Active.</p>
      </Modal>
      <ActivateModal rule={activating} current={current} onClose={() => setActivating(null)} onConfirm={activate} />
    </>
  );
}

function ActivateModal({ rule, current, onClose, onConfirm }: { rule: Rule | null; current?: Rule; onClose: () => void; onConfirm: () => void }) {
  const later = !!rule?.effectiveFrom && rule.effectiveFrom > sgToday();
  return (
    <Modal open={!!rule} onClose={onClose} title={later ? "Schedule rule?" : "Activate rule?"}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={onConfirm}>{later ? "Schedule" : "Activate"}</Button></>}>
      {later
        ? <p>Schedule <b>{rule?.name}</b>? It shows as Pending and becomes Active on {rule?.effectiveFrom}.{current ? <> Until then {current.id} ({current.name}) stays Active.</> : ""} You can cancel it before that date.</p>
        : <p>Activate <b>{rule?.name}</b>?{current ? <> The currently active rule {current.id} ({current.name}) will become Inactive.</> : " This will become the active MOEFAS rule."} Existing application outcomes stay unchanged.</p>}
    </Modal>
  );
}

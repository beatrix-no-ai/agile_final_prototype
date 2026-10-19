import { useState, type FormEvent } from "react";
import { ArrowLeft, Plus } from "@phosphor-icons/react";
import { Badge, type BadgeTone } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { DataTable, RowAction, type Column } from "../../../components/ui/DataTable";
import { EmptyState } from "../../../components/ui/EmptyState";
import { Field, inputClass } from "../../../components/ui/Field";
import { Modal } from "../../../components/ui/Modal";
import {
  activateRule, blankRule, CATALOGUE, componentName, FEE_KINDS, HH_BANDS, nextRuleId, PC_BANDS, ruleProblem, todaySg,
  type Basis, type FeeKind, type Rule, type RuleStatus,
} from "../../../data/moefas";

const TONE: Record<RuleStatus, BadgeTone> = { Active: "success", Draft: "warning", Inactive: "neutral" };
const th = "whitespace-nowrap border-b border-line bg-surface-container-low px-3 py-3 text-left text-[13px] font-medium text-on-surface-variant";
const td = "border-b border-line px-3 py-2 align-top";
const cell = "min-h-10 rounded-control border border-outline bg-surface-container-lowest px-2 text-sm disabled:opacity-70";

type Props = { rules: Rule[]; setRules: (r: Rule[]) => void; notify: (m: string, bad?: boolean) => void };

function Editor({ initial, isNew, readOnly, onBack, onSave, notify }: { initial: Rule; isNew: boolean; readOnly: boolean; onBack: () => void; onSave: (r: Rule) => void; notify: (m: string, bad?: boolean) => void }) {
  const [d, setD] = useState<Rule>(() => structuredClone(initial));
  const [picker, setPicker] = useState(isNew);
  const [picked, setPicked] = useState<FeeKind[]>([]);
  const [kind, setKind] = useState("");
  const patch = (p: Partial<Rule>) => setD((x) => ({ ...x, ...p }));
  const setTier = (i: number, k: "hh" | "pc", v: number) => patch({ tiers: d.tiers.map((t, j) => (j === i ? { ...t, [k]: v } : t)) });
  const setRow = (i: number, p: Partial<Rule["components"][number]>) => patch({ components: d.components.map((c, j) => (j === i ? { ...c, ...p } : c)) });
  const addRow = (type: FeeKind) => ({ id: "", type, basis: "percent" as Basis, amounts: d.tiers.map(() => 0) });
  const hasFree = (type: FeeKind) => CATALOGUE.filter((c) => c.type === type).length > d.components.filter((c) => c.type === type).length;
  const addTier = () => patch({ tiers: [...d.tiers, { hh: 0, pc: 0 }], components: d.components.map((c) => ({ ...c, amounts: [...c.amounts, 0] })) });
  const removeTier = () => patch({ tiers: d.tiers.slice(0, -1), components: d.components.map((c) => ({ ...c, amounts: c.amounts.slice(0, -1) })) });
  const kinds = [...new Set(d.components.map((c) => c.type))];

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const problem = ruleProblem(d);
    if (problem) return notify(problem, true);
    onSave({ ...d, name: d.name.trim() });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 rounded text-sm font-semibold text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
        <ArrowLeft size={16} weight="bold" aria-hidden="true" /> FAS Rules
      </button>
      <h2 className="text-2xl font-bold tracking-tight">{readOnly ? "View rule" : isNew ? "Create rule" : "Edit rule"}</h2>
      <Card title="MOEFAS · Assessment rules" action={<Badge tone={TONE[d.status]}>{d.status === "Draft" && !readOnly ? "Editable draft" : d.status}</Badge>}>
        <p className="text-sm text-on-surface-variant">Select MOE fee components, define eligibility rules, then set subsidies for each tier.</p>
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
                  <b className="text-sm">MOE master fee types</b>
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
                        <span><b>{k}</b><span className="block text-[13px] text-on-surface-variant">MOE master fee type{exists ? " · Already selected" : ""}</span></span>
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
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-bold">2. Configure eligibility & tiers</h3>
              <Button variant="secondary" icon={<Plus size={16} weight="bold" aria-hidden="true" />} onClick={addTier}>Add tier</Button>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Rule name" required><input className={inputClass} value={d.name} onChange={(e) => patch({ name: e.target.value })} /></Field>
              <Field label="Effective from" required><input type="date" className={inputClass} value={d.from} onChange={(e) => patch({ from: e.target.value })} /></Field>
              <Field label="Effective to" required><input type="date" className={inputClass} value={d.to} onChange={(e) => patch({ to: e.target.value })} /></Field>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[520px] border-collapse text-sm">
                <thead><tr><th className={th}>Assigned tier</th><th className={th}>Highest accepted household band</th><th className={th}>Highest accepted per-capita band</th></tr></thead>
                <tbody>
                  {d.tiers.map((t, i) => (
                    <tr key={i}>
                      <td className={`${td} font-semibold`}>Tier {i + 1}</td>
                      <td className={td}><select className={`${cell} w-full`} aria-label={`Tier ${i + 1} household`} value={t.hh} onChange={(e) => setTier(i, "hh", Number(e.target.value))}>{HH_BANDS.map((b, j) => <option key={b} value={j}>{b}</option>)}</select></td>
                      <td className={td}><select className={`${cell} w-full`} aria-label={`Tier ${i + 1} per-capita`} value={t.pc} onChange={(e) => setTier(i, "pc", Number(e.target.value))}>{PC_BANDS.map((b, j) => <option key={b} value={j}>{b}</option>)}</select></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-[13px] text-on-surface-variant">Each tier accepts its selected band and all lower bands.</p>
            <div className="mt-3 flex justify-end gap-2">
              <Button size="sm" variant="secondary" disabled={d.tiers.length <= 1} onClick={removeTier}>Remove last tier</Button>
            </div>
          </section>

          <section className="border-t border-line pt-6">
            <h3 className="text-sm font-bold">3. Subsidy by tier and fee component</h3>
            <p className="mt-1 text-[13px] text-on-surface-variant">The subsidy columns refer to the eligibility tiers configured above. Only selected components receive a subsidy.</p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-sm">
                <thead><tr><th className={th}>Fee type</th><th className={th}>Fee component</th><th className={th}>Basis</th>{d.tiers.map((_, i) => <th key={i} className={th}>Tier {i + 1} subsidy</th>)}<th className={th}>Action</th></tr></thead>
                <tbody>
                  {d.components.map((c, i) => (
                    <tr key={i}>
                      <td className={td}>
                        <b>{c.type}</b><span className="block text-[13px] text-on-surface-variant">MOE master</span>
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
                      {d.tiers.map((_, t) => (
                        <td key={t} className={td}>
                          <input type="number" required min={0} max={c.basis === "percent" ? 100 : undefined} step="0.01" className={`${cell} w-24`} aria-label={`${c.id ? componentName(c.id) : c.type} Tier ${t + 1}`}
                            value={c.amounts[t]} onChange={(e) => setRow(i, { amounts: c.amounts.map((a, j) => (j === t ? (e.target.value === "" ? "" : Number(e.target.value)) : a)) })} />
                        </td>
                      ))}
                      <td className={td}><Button size="sm" variant="ghost" onClick={() => patch({ components: d.components.filter((_, j) => j !== i) })}>Remove</Button></td>
                    </tr>
                  ))}
                  {!d.components.length && <tr><td colSpan={d.tiers.length + 4} className="px-3 py-8 text-center text-on-surface-variant">No components selected. Add MOE master components to configure subsidies.</td></tr>}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-[13px] text-on-surface-variant">A charge must reference the matching MOE master component.</p>
          </section>
        </fieldset>
        {!readOnly && (
          <div className="mt-6 flex justify-end gap-3">
            <Button variant="secondary" onClick={onBack}>Cancel</Button>
            <Button type="submit">Save rule</Button>
          </div>
        )}
      </Card>
    </form>
  );
}

export default function Rules({ rules, setRules, notify }: Props) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [editing, setEditing] = useState<{ rule: Rule; isNew: boolean; readOnly: boolean } | null>(null);
  const [activating, setActivating] = useState<Rule | null>(null);

  if (editing) {
    return <Editor key={editing.rule.id} initial={editing.rule} isNew={editing.isNew} readOnly={editing.readOnly} notify={notify} onBack={() => setEditing(null)}
      onSave={(r) => {
        setRules(editing.isNew ? [...rules, r] : rules.map((x) => (x.id === r.id ? r : x)));
        setEditing(null); setQ(""); setStatus("");
        notify(`Rule saved as ${r.status}.`);
      }} />;
  }

  const activate = () => {
    if (!activating) return;
    const r = activating;
    setActivating(null);
    if (todaySg() < r.from || todaySg() > r.to) return notify("Activation requires today to be within the effective period. Edit the dates first.", true);
    setRules(activateRule(rules, r.id));
    notify("Rule activated. Previous application outcomes remain unchanged.");
  };
  const current = rules.find((r) => r.status === "Active");
  const list = rules.filter((r) => `${r.id} ${r.name}`.toLowerCase().includes(q.trim().toLowerCase()) && (!status || r.status === status));
  const columns: Column<Rule>[] = [
    { key: "name", header: "Rule ID / name", sortable: true, render: (r) => <><span className="font-semibold">{r.name}</span><span className="block text-[13px] text-on-surface-variant">{r.id}</span></> },
    { key: "components", header: "Fee components", render: (r) => r.components.map((c) => componentName(c.id)).join(", ") },
    { key: "tiers", header: "Tiers", render: (r) => `${r.tiers.length} tiers` },
    { key: "from", header: "Effective period", sortable: true, render: (r) => <>{r.from}<span className="block text-[13px] text-on-surface-variant">to {r.to}</span></> },
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
            <option value="">All statuses</option><option>Active</option><option>Inactive</option><option>Draft</option>
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
              {r.status !== "Active" && <RowAction onClick={() => { notify(""); setEditing({ rule: r, isNew: false, readOnly: false }); }}>Edit</RowAction>}
              {r.status !== "Active" && <RowAction onClick={() => setActivating(r)}>Activate</RowAction>}
            </>
          )}
          empty={<EmptyState title="No matching rules" hint="Try another search or status." action={<Button variant="secondary" onClick={() => { setQ(""); setStatus(""); }}>Reset</Button>} />}
        />
        <p className="mt-3 text-[13px] text-on-surface-variant">Only one rule can be Active at a time. Activating a rule makes the previous Active rule Inactive. Draft rules have never been activated.</p>
      </Card>
      <Modal open={!!activating} onClose={() => setActivating(null)} title="Activate rule?"
        footer={<><Button variant="secondary" onClick={() => setActivating(null)}>Cancel</Button><Button onClick={activate}>Activate</Button></>}>
        <p>Activate <b>{activating?.name}</b>?{current && <> {current.name} will become Inactive.</>} Existing application outcomes stay unchanged.</p>
      </Modal>
    </>
  );
}

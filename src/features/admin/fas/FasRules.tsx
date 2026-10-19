import { useState } from "react";
import { Badge, type BadgeTone } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { DataTable, RowAction, type Column } from "../../../components/ui/DataTable";
import { EmptyState } from "../../../components/ui/EmptyState";
import { Field, inputClass } from "../../../components/ui/Field";
import { Modal } from "../../../components/ui/Modal";
import {
  HOUSEHOLD_BANDS, PER_CAPITA_BANDS, activateRule, draftOf, feeTypeOf, masterFeeTypes, nextRuleId, ruleOk,
  toRule, validateRule, type FasRule, type IncomeLogic, type RuleDraft, type RuleErrors, type RuleLineDraft,
  type RuleStatus, type SubsidyBasis,
} from "../../../data/moefasRules";
import { useMoefas } from "../../../data/moefasStore";
import { formatDate } from "../../../lib/format";
import { Chips } from "../fee-types/parts";

const STATUS_TONE: Record<RuleStatus, BadgeTone> = { Active: "success", Inactive: "neutral", Draft: "warning" };

function RuleList({ note, onCreate, onOpen }: { note: string; onCreate: () => void; onOpen: (r: FasRule, view: boolean) => void }) {
  const { state, dispatch } = useMoefas();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | RuleStatus>("all");
  const [error, setError] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const target = state.rules.find((r) => r.id === confirmId) ?? null;
  const current = state.rules.find((r) => r.status === "Active");

  const rows = state.rules.filter(
    (r) => `${r.id} ${r.name}`.toLowerCase().includes(q.trim().toLowerCase()) && (status === "all" || r.status === status),
  );

  const doActivate = () => {
    if (!target) return;
    const res = activateRule(state.rules, target.id);
    setConfirmId(null);
    if (!res.ok) return setError(res.error);
    dispatch({ type: "activate-rule", id: target.id });
    setError("");
  };

  const columns: Column<FasRule>[] = [
    {
      key: "name", header: "Rule", sortable: true, render: (r) => (
        <>
          <span className="font-semibold">{r.name}</span>
          <span className="block text-[13px] text-on-surface-variant">{r.id}</span>
        </>
      ),
    },
    {
      key: "components", header: "Fee components", render: (r) => (
        <span className="block text-[13px] text-on-surface-variant">{[...new Set(r.lines.map((l) => `${l.component} (${feeTypeOf(l.ftId)?.name ?? l.ftId})`))].join(" · ")}</span>
      ),
    },
    { key: "tiers", header: "Tiers", sortable: true, render: (r) => `${r.tiers.length} tiers · ${r.logic}` },
    {
      key: "from", header: "Effective period", sortable: true, render: (r) => (
        <>
          {formatDate(r.from)}
          <span className="block text-[13px] text-on-surface-variant">to {formatDate(r.to)}</span>
        </>
      ),
    },
    { key: "status", header: "Status", render: (r) => <Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge> },
  ];

  return (
    <Card
      title="FAS rules"
      action={<Button onClick={onCreate}>+ Create rule</Button>}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Chips
            label="Filter rule status"
            value={status}
            onChange={setStatus}
            options={[
              { value: "all", label: "All", count: state.rules.length },
              ...(["Active", "Inactive", "Draft"] as const).map((s) => ({
                value: s,
                label: s,
                count: state.rules.filter((r) => r.status === s).length,
              })),
            ]}
          />
          <input
            className={`${inputClass} sm:w-64`}
            type="search"
            placeholder="Search rule name or ID"
            aria-label="Search rules"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        {note && <p role="status" className="text-[13px] font-medium text-success">{note}</p>}
        {error && <p role="alert" className="text-[13px] font-medium text-alert">{error}</p>}
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(r) => r.id}
          rowActions={(r) => (
            <>
              <RowAction onClick={() => onOpen(r, true)}>View</RowAction>
              {r.status !== "Active" && (
                <>
                  <RowAction onClick={() => onOpen(r, false)}>Edit</RowAction>
                  <RowAction onClick={() => { setError(""); setConfirmId(r.id); }}>Activate</RowAction>
                </>
              )}
            </>
          )}
          empty={<EmptyState title="No matching rules" hint="Create a rule or clear the filters." />}
        />
        <p className="text-[13px] text-on-surface-variant">
          Only one rule can be Active at a time — activating a rule makes the previous Active rule Inactive. Draft rules have never been activated.
        </p>
      </div>
      <Modal
        open={!!target}
        onClose={() => setConfirmId(null)}
        title="Activate rule"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmId(null)}>Cancel</Button>
            <Button onClick={doActivate}>Activate</Button>
          </>
        }
      >
        {target && (
          <p>
            Activate <strong>{target.name}</strong>?{current && current.id !== target.id ? ` ${current.name} will become Inactive.` : ""} Previous application outcomes stay unchanged.
          </p>
        )}
      </Modal>
    </Card>
  );
}

function RuleEditor({ editing, forceView = false, onDone }: { editing: FasRule | null; forceView?: boolean; onDone: (note: string) => void }) {
  const { state, dispatch } = useMoefas();
  // Read-only when opened via View, and always for the Active rule: activate another rule to change the policy in force.
  const view = forceView || editing?.status === "Active";
  const [d, setD] = useState<RuleDraft>(() => draftOf(editing));
  const [errors, setErrors] = useState<RuleErrors>({ rows: {} });
  const [dirty, setDirty] = useState(false);
  const masters = masterFeeTypes();

  const upd = (fn: (cur: RuleDraft) => RuleDraft) => {
    setD(fn);
    setDirty(true);
  };
  const updLine = (i: number, patch: Partial<RuleLineDraft>) => upd((cur) => ({ ...cur, lines: cur.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)) }));

  const addType = (ftId: string) =>
    upd((cur) =>
      cur.lines.some((l) => l.ftId === ftId)
        ? cur
        : { ...cur, lines: [...cur.lines, { ftId, component: "", basis: "percent", amounts: cur.tiers.map(() => "0") }] },
    );
  const removeType = (ftId: string) => upd((cur) => ({ ...cur, lines: cur.lines.filter((l) => l.ftId !== ftId) }));

  const addTier = () =>
    upd((cur) => ({
      ...cur,
      tiers: [...cur.tiers, { household: 0, perCapita: 0 }],
      lines: cur.lines.map((l) => ({ ...l, amounts: [...l.amounts, "0"] })),
    }));
  const removeTier = () =>
    upd((cur) => ({
      ...cur,
      tiers: cur.tiers.slice(0, -1),
      lines: cur.lines.map((l) => ({ ...l, amounts: l.amounts.slice(0, -1) })),
    }));

  const save = () => {
    const e = validateRule(d);
    setErrors(e);
    if (!ruleOk(e)) return;
    const status = editing?.status ?? "Draft";
    const id = editing?.id ?? nextRuleId(state.rules);
    dispatch({ type: "save-rule", rule: toRule(d, id, status) });
    onDone(`${d.name.trim()} saved as ${status}.`);
  };

  return (    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Button variant="secondary" size="sm" onClick={() => onDone("")}>← FAS rules</Button>
          <h2 className="mt-3 text-xl font-bold text-on-surface">{editing ? (view ? "View rule" : "Edit rule") : "Create rule"}</h2>
        </div>
        {editing && <Badge tone={STATUS_TONE[editing.status]}>{editing.status}</Badge>}
      </div>

      <Card title="MOEFAS · assessment rule">
        <fieldset disabled={view} className="min-w-0 space-y-8">
          <section>
            <h3 className="text-sm font-semibold text-on-surface">1. Select fee types</h3>
            <p className="mt-1 text-[13px] text-on-surface-variant">Only MOE master fee types can be subsidised; school-created fee types are never available.</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {masters.map((ft) => {
                const has = d.lines.some((l) => l.ftId === ft.id);
                return (
                  <label key={ft.id} className="flex items-start gap-3 rounded-control border border-line p-3">
                    <input
                      type="checkbox"
                      className="mt-1 size-4 accent-primary"
                      checked={has}
                      onChange={(e) => (e.target.checked ? addType(ft.id) : removeType(ft.id))}
                    />
                    <span className="text-sm">
                      <span className="block font-semibold text-on-surface">{ft.name} <span className="font-normal text-on-surface-variant">{ft.id}</span></span>
                      <span className="block text-[13px] text-on-surface-variant">{ft.components.map((c) => c.name).join(" · ")}</span>
                    </span>
                  </label>
                );
              })}
            </div>
            {errors.lines && <p role="alert" className="mt-2 text-[13px] font-medium text-alert">{errors.lines}</p>}
          </section>

          <section>
            <h3 className="text-sm font-semibold text-on-surface">2. Configure eligibility & tiers</h3>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <Field label="Rule name" required error={errors.name}>
                <input className={inputClass} value={d.name} onChange={(e) => upd((cur) => ({ ...cur, name: e.target.value }))} />
              </Field>
              <Field label="Income eligibility requirement">
                <select className={inputClass} value={d.logic} onChange={(e) => upd((cur) => ({ ...cur, logic: e.target.value as IncomeLogic }))}>
                  <option value="AND">Both income conditions must be met (AND)</option>
                  <option value="OR">Either income condition may be met (OR)</option>
                </select>
              </Field>
              <Field label="Effective from" required error={errors.period}>
                <input type="date" className={inputClass} value={d.from} onChange={(e) => upd((cur) => ({ ...cur, from: e.target.value }))} />
              </Field>
              <Field label="Effective to" required>
                <input type="date" className={inputClass} value={d.to} onChange={(e) => upd((cur) => ({ ...cur, to: e.target.value }))} />
              </Field>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-line">
                    <th scope="col" className="px-3 py-2.5 font-medium text-on-surface-variant">Assigned tier</th>
                    <th scope="col" className="px-3 py-2.5 font-medium text-on-surface-variant">Highest accepted household band</th>
                    <th scope="col" className="px-3 py-2.5 font-medium text-on-surface-variant">Highest accepted per-capita band</th>
                  </tr>
                </thead>
                <tbody>
                  {d.tiers.map((t, i) => (
                    <tr key={i} className="border-b border-line last:border-0">
                      <td className="px-3 py-3 font-semibold">Tier {i + 1}</td>
                      <td className="px-3 py-3">
                        <select
                          className={inputClass}
                          aria-label={`Tier ${i + 1} household band`}
                          value={t.household}
                          onChange={(e) => upd((cur) => ({ ...cur, tiers: cur.tiers.map((x, j) => (j === i ? { ...x, household: Number(e.target.value) } : x)) }))}
                        >
                          {HOUSEHOLD_BANDS.map((b, bi) => <option key={b} value={bi}>{b}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-3">
                        <select
                          className={inputClass}
                          aria-label={`Tier ${i + 1} per-capita band`}
                          value={t.perCapita}
                          onChange={(e) => upd((cur) => ({ ...cur, tiers: cur.tiers.map((x, j) => (j === i ? { ...x, perCapita: Number(e.target.value) } : x)) }))}
                        >
                          {PER_CAPITA_BANDS.map((b, bi) => <option key={b} value={bi}>{b}</option>)}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex gap-2">
              <Button size="sm" variant="secondary" onClick={addTier}>+ Add tier</Button>
              <Button size="sm" variant="secondary" onClick={removeTier} disabled={d.tiers.length <= 1}>Remove last tier</Button>
            </div>
            <p className="mt-2 text-[13px] text-on-surface-variant">
              Each tier accepts its selected band and all lower bands. {d.logic === "AND" ? "AND requires both income conditions; OR requires either." : "OR requires either income condition; AND would require both."}
            </p>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-on-surface">3. Subsidy by tier and fee component</h3>
            <p className="mt-1 text-[13px] text-on-surface-variant">Set each component's benefit for the eligibility tiers above; these columns are not new tiers.</p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[42rem] text-left text-sm">
                <thead>
                  <tr className="border-b border-line">
                    <th scope="col" className="px-3 py-2.5 font-medium text-on-surface-variant">Fee type</th>
                    <th scope="col" className="px-3 py-2.5 font-medium text-on-surface-variant">Fee component</th>
                    <th scope="col" className="px-3 py-2.5 font-medium text-on-surface-variant">Basis</th>
                    {d.tiers.map((_, i) => (
                      <th key={i} scope="col" className="px-3 py-2.5 text-right font-medium text-on-surface-variant">Tier {i + 1}</th>
                    ))}
                    <th scope="col" className="px-3 py-2.5 font-medium text-on-surface-variant">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {d.lines.map((l, i) => {
                    const ft = feeTypeOf(l.ftId);
                    const usedElsewhere = (name: string) => d.lines.some((x, j) => j !== i && x.ftId === l.ftId && x.component === name);
                    const moreLeft = ft ? ft.components.some((c) => !usedElsewhere(c.name) && c.name !== l.component) : false;
                    return (
                      <tr key={i} className="border-b border-line last:border-0 align-top">
                        <td className="px-3 py-3">
                          <span className="font-semibold">{ft?.name ?? l.ftId}</span>
                          <span className="block text-[13px] text-on-surface-variant">MOE master</span>
                          <Button size="sm" variant="ghost" className="mt-1 px-0" disabled={!moreLeft} onClick={() => addType(l.ftId)}>+ Component</Button>
                        </td>
                        <td className="px-3 py-3">
                          <select
                            className={inputClass}
                            aria-label={`${ft?.name ?? l.ftId} component`}
                            value={l.component}
                            onChange={(e) => updLine(i, { component: e.target.value })}
                          >
                            <option value="">Select component</option>
                            {ft?.components.map((c) => (
                              <option key={c.name} value={c.name} disabled={usedElsewhere(c.name)}>{c.name}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-3">
                          <select
                            className={inputClass}
                            aria-label="Subsidy basis"
                            value={l.basis}
                            onChange={(e) => updLine(i, { basis: e.target.value as SubsidyBasis })}
                          >
                            <option value="percent">Percentage (%)</option>
                            <option value="fixed">Fixed amount (SGD)</option>
                          </select>
                        </td>
                        {d.tiers.map((_, t) => (
                          <td key={t} className="px-3 py-3">
                            <input
                              type="number"
                              min={0}
                              max={l.basis === "percent" ? 100 : undefined}
                              step={0.01}
                              className={`${inputClass} w-24 text-right`}
                              aria-label={`${l.component || "component"} Tier ${t + 1} subsidy`}
                              value={l.amounts[t] ?? ""}
                              onChange={(e) => updLine(i, { amounts: l.amounts.map((a, k) => (k === t ? e.target.value : a)) })}
                            />
                          </td>
                        ))}
                        <td className="px-3 py-3">
                          <Button size="sm" variant="secondary" onClick={() => upd((cur) => ({ ...cur, lines: cur.lines.filter((_, j) => j !== i) }))}>Remove</Button>
                          {errors.rows[i] && <p role="alert" className="mt-1 text-[13px] font-medium text-alert">{errors.rows[i]}</p>}
                        </td>
                      </tr>
                    );
                  })}
                  {!d.lines.length && (
                    <tr>
                      <td colSpan={4 + d.tiers.length} className="px-3 py-6 text-center text-sm text-on-surface-variant">
                        No components selected. Add MOE master fee types above to configure subsidies.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </fieldset>
        {!view && (
          <div className="mt-6 flex flex-wrap items-center justify-end gap-3 border-t border-line pt-4">
            {dirty && <span role="status" className="mr-auto text-[13px] text-on-surface-variant">Unsaved draft changes</span>}
            <Button variant="secondary" onClick={() => { setD(draftOf(editing)); setErrors({ rows: {} }); setDirty(false); }}>Restore defaults</Button>
            <Button onClick={save}>Save rule</Button>
          </div>
        )}
      </Card>
    </div>
  );
}

/** HQ FAS rules tab (Req 4): the MOEFAS policy catalogue — one Active rule drives automatic assessment. */
export default function FasRules() {
  const [mode, setMode] = useState<"list" | "edit">("list");
  const [editing, setEditing] = useState<FasRule | null>(null);
  const [forceView, setForceView] = useState(false);
  const [note, setNote] = useState("");

  return mode === "list" ? (
    <RuleList
      note={note}
      onCreate={() => { setEditing(null); setForceView(false); setNote(""); setMode("edit"); }}
      onOpen={(r, view) => { setEditing(r); setForceView(view); setNote(""); setMode("edit"); }}
    />
  ) : (
    <RuleEditor
      editing={editing}
      forceView={forceView}
      onDone={(msg) => { setNote(msg); setMode("list"); }}
    />
  );
}

import { useState } from "react";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { EmptyState } from "../../../components/ui/EmptyState";
import { inputClass } from "../../../components/ui/Field";
import { SCHOOLS } from "../../../data/schools";
import {
  draftOfSbfasRule, moefasCoveredBands, ruleForSchool, sbfasRuleOk, toSbfasRule, validateSbfasRule,
  RISK_LEVELS, type RiskLevel, type SbfasRuleDraft, type SbfasRuleErrors, type SubsidyBasis,
} from "../../../data/sbfasRule";
import type { SbfasTier } from "../../../data/sbfasApplications";
import { useSbfas } from "../../../data/sbfasStore";
import { useFees } from "../../../data/feeStore";
import { useTiers } from "../../../data/moefas";
import { useSession } from "../../../session";
import { formatDate } from "../../../lib/format";

const LEVEL_LABEL: Record<RiskLevel, string> = { HIGH: "HIGH", MED: "MED", LOW: "LOW" };

const BLOCK_LEVELS: RiskLevel[] = ["LOW", "MED", "HIGH"];

/** A level's current tier range on one dimension as 1-based [from, to]; [0, 0] when the level claims no tiers. */
const rangeOf = (bands: (RiskLevel | null)[], l: RiskLevel): [number, number] => {
  const ix = bands.flatMap((v, i) => (v === l ? [i] : []));
  return ix.length ? [ix[0] + 1, ix[ix.length - 1] + 1] : [0, 0];
};

/**
 * School-side SBFAS rule (Req 4): the school groups MOE's national income bands (GHI and PCI) into need
 * levels for the AI suggestion and sets each tier's subsidy — a percentage of the fee or a fixed S$
 * amount. The school chooses how many tiers to offer. Bands already auto-granted by the Active MOEFAS
 * policy are locked — no student can hold both schemes.
 */
export default function SbfasRules() {
  const { role, staff } = useSession();
  // The signed-in school's own package — same key the review queue uses, so edits reach the modal.
  const school = role === "school" ? staff?.schoolCode ?? null : null;
  const { state, dispatch } = useSbfas();
  const { state: feeState } = useFees();
  const [tiers] = useTiers(); // HQ's central income tiers, read from storage on mount
  const covered = moefasCoveredBands(tiers);
  // The school's own fee types feed the per-component support picker below.
  const feeTypes = school ? feeState.types.filter((ft) => ft.school === school) : [];
  const rule = school ? ruleForSchool(state.rules, school) : null;
  const [d, setD] = useState<SbfasRuleDraft | null>(null);
  const [errors, setErrors] = useState<SbfasRuleErrors>({ rows: {} });
  const [note, setNote] = useState("");
  // Fee-component support rows: each picks a fee type + component; null = auto (first fee type, first component).
  const [rows, setRows] = useState<Array<{ ft: string; comp: string } | null>>([null]);

  if (!school || !rule) {
    return (
      <Card title="SBFAS rules">
        <EmptyState title="SBFAS rules are set by each school" hint="Sign in as a school user to configure your school's package." />
      </Card>
    );
  }

  const base = d ?? draftOfSbfasRule(rule);
  // HQ may have added or removed income tiers since this rule was saved: keep one level slot per current tier.
  const fit = (g: (RiskLevel | null)[], n: number) => Array.from({ length: n }, (_, i) => g[i] ?? null);
  const draft: SbfasRuleDraft = {
    ...base,
    grouping: { ghi: fit(base.grouping!.ghi, tiers.ghi.ranges.length), pci: fit(base.grouping!.pci, tiers.pci.ranges.length) },
  };
  const schoolName = SCHOOLS.find((s) => s.code === school)?.name ?? school;
  const upd = (i: number, patch: Partial<SbfasRuleDraft["tiers"][number]>) =>
    setD({ ...draft, tiers: draft.tiers.map((t, j) => (j === i ? { ...t, ...patch } : t)) });
  const addTier = () =>
    setD({ ...draft, tiers: [...draft.tiers, { basis: "percent", rate: "" }] });
  /** Removing a tier drops the level picks that pointed at it and shifts the higher names down. */
  const rmTier = (i: number) => {
    const levelTiers = { ...draft.levelTiers! };
    for (const l of RISK_LEVELS) {
      const x = levelTiers[l] ? Number(String(levelTiers[l]).replace(/\D/g, "")) : 0;
      levelTiers[l] = x === i + 1 ? null : x > i + 1 ? (`Tier ${x - 1}` as SbfasTier) : levelTiers[l];
    }
    setD({ ...draft, tiers: draft.tiers.filter((_, j) => j !== i), levelTiers });
  };
  // A level claims a contiguous tier range per dimension; MOEFAS-covered tiers are never assignable.
  const setRange = (dim: "ghi" | "pci", l: RiskLevel, end: "from" | "to", tier: number) => {
    const cov = dim === "ghi" ? covered.ghi : covered.pci;
    const bands = draft.grouping![dim];
    const cur = rangeOf(bands, l);
    const lo = end === "from" ? tier : cur[0] || tier;
    const hi = end === "from" ? cur[1] || tier : tier;
    const next = bands.map((v) => (v === l ? null : v));
    const firstFree = (cov.at(-1) ?? -1) + 1;
    if (lo && hi) for (let i = Math.max(lo - 1, firstFree); i <= Math.min(hi - 1, next.length - 1); i++) next[i] = l;
    setNote("");
    setD({ ...draft, grouping: { ...draft.grouping!, [dim]: next } });
  };

  const lockedDraft = (): SbfasRuleDraft => ({
    ...draft,
    grouping: {
      ghi: draft.grouping!.ghi.map((v, i) => (covered.ghi.includes(i) ? null : v)),
      pci: draft.grouping!.pci.map((v, i) => (covered.pci.includes(i) ? null : v)),
    },
  });

  const save = () => {
    const clean = lockedDraft();
    const e = validateSbfasRule(clean);
    setErrors(e);
    if (!sbfasRuleOk(e)) return;
    const saved = toSbfasRule(clean, school);
    dispatch({ type: "save-rule", rule: saved });
    setD(null);
    setNote(`SBFAS rules saved on ${formatDate(saved.updated)} — new suggestions and decisions use these rules.`);
  };

  return (
    <Card title={`SBFAS rules — ${schoolName}`}>
      <div className="space-y-4">
        {note && <p role="status" className="text-[13px] font-medium text-success">{note}</p>}
        {BLOCK_LEVELS.map((lv) => {
          const [pf, pt] = rangeOf(draft.grouping!.pci, lv);
          const [hf, ht] = rangeOf(draft.grouping!.ghi, lv);
          const opts = (dim: "ghi" | "pci") => {
            const n = draft.grouping![dim].length;
            const start = (dim === "ghi" ? covered.ghi : covered.pci).length;
            return Array.from({ length: Math.max(0, n - start) }, (_, k) => start + k + 1);
          };
          const sel = (dim: "ghi" | "pci", end: "from" | "to", val: number, id: string) => (
            <select
              id={id}
              className={inputClass}
              value={val ? String(val) : ""}
              onChange={(e) => setRange(dim, lv, end, Number(e.target.value) || 0)}
            >
              <option value="">—</option>
              {opts(dim).map((t) => <option key={t} value={t}>Tier {t}</option>)}
            </select>
          );
          return (
            <section key={lv} className="space-y-3 rounded-card border border-line bg-surface-container-lowest p-4">
              <h4 className="text-sm font-semibold text-on-surface">{LEVEL_LABEL[lv]}</h4>
              <div className="flex flex-wrap items-center gap-3">
                <span className="w-10 text-sm font-semibold text-on-surface">PCI</span>
                <label className="flex items-center gap-2 text-[13px] text-on-surface-variant">
                  From Tier {sel("pci", "from", pf, `pc-from-${lv}`)}
                </label>
                <label className="flex items-center gap-2 text-[13px] text-on-surface-variant">
                  To Tier {sel("pci", "to", pt, `pc-to-${lv}`)}
                </label>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="w-10 text-sm font-semibold text-on-surface">GHI</span>
                <label className="flex items-center gap-2 text-[13px] text-on-surface-variant">
                  From Tier {sel("ghi", "from", hf, `hh-from-${lv}`)}
                </label>
                <label className="flex items-center gap-2 text-[13px] text-on-surface-variant">
                  To Tier {sel("ghi", "to", ht, `hh-to-${lv}`)}
                </label>
              </div>
            </section>
          );
        })}
        {errors.grouping && <p role="alert" className="text-[13px] font-medium text-alert">{errors.grouping}</p>}

                <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className="px-3 py-2.5 font-medium text-on-surface-variant">Rank</th>
                <th scope="col" className="px-3 py-2.5 font-medium text-on-surface-variant">Subsidy</th>
                <th scope="col" className="px-3 py-2.5 font-medium text-on-surface-variant"><span className="sr-only">Remove</span></th>
              </tr>
            </thead>
            <tbody>
              {draft.tiers.map((t, i) => (
                <tr key={i} className="border-b border-line last:border-0">
                  <td className="px-3 py-3 font-semibold">Rank {i + 1}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <label className="shrink-0">
                        <span className="sr-only">Rank {i + 1} subsidy basis</span>
                        <select
                          id={`tier-basis-${i}`}
                          className={inputClass}
                          value={t.basis}
                          onChange={(e) => { setNote(""); upd(i, { basis: e.target.value as SubsidyBasis }); }}
                        >
                          <option value="percent">% of fee</option>
                          <option value="fixed">Fixed S$</option>
                        </select>
                      </label>
                      <div className="w-28">
                        <input
                          type="number"
                          min={0}
                          max={t.basis === "fixed" ? undefined : 100}
                          step={0.5}
                          className={`${inputClass} text-right`}
                          aria-label={`Rank ${i + 1} subsidy ${t.basis === "fixed" ? "amount" : "rate"}`}
                          value={t.rate}
                          onChange={(e) => { setNote(""); upd(i, { rate: e.target.value }); }}
                        />
                        {errors.rows[i] && <p role="alert" className="mt-1.5 text-[13px] font-medium text-alert">{errors.rows[i]}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <Button variant="ghost" disabled={draft.tiers.length <= 1} onClick={() => { setNote(""); rmTier(i); }}>
                      Remove
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex justify-start">
          <Button variant="secondary" onClick={() => { setNote(""); addTier(); }}>+ Rank</Button>
        </div>
        {errors.tiers && <p role="alert" className="text-[13px] font-medium text-alert">{errors.tiers}</p>}

        {feeTypes.length > 0 && (() => {
          const resolve = (r: { ft: string; comp: string } | null) => {
            const ft = feeTypes.find((x) => x.id === r?.ft) ?? feeTypes[0];
            const comp = ft.components.some((c) => c.name === r?.comp) ? r!.comp : ft.components[0].name;
            return { ft, comp };
          };
          const setOv = (ti: number, comp: string, basis: "percent" | "fixed" | "follow", cur?: { basis: "percent" | "fixed"; rate: string }) => {
            const t = draft.tiers[ti];
            const rest = { ...(t.components ?? {}) };
            if (basis === "follow") delete rest[comp];
            else rest[comp] = { basis, rate: cur?.rate ?? t.rate };
            setNote("");
            upd(ti, { components: rest });
          };
          return (
            <section aria-label="Fee component support" className="rounded-card border border-line bg-surface-container-lowest p-4 space-y-3">
              <h4 className="text-sm font-semibold text-on-surface">Fee component support</h4>
              {rows.map((r, ri) => {
                const { ft, comp } = resolve(r);
                const usedElsewhere = rows.filter((_, k) => k !== ri).map((x) => resolve(x).comp);
                const setRow = (patch: Partial<{ ft: string; comp: string }>) =>
                  setRows(rows.map((x, k) => { if (k !== ri) return x; const rx = resolve(x); return { ft: rx.ft.id, comp: rx.comp, ...patch }; }));
                return (
                  <div key={ri} className="rounded-control border border-line bg-surface-container-lowest p-3 space-y-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <label className="flex items-center gap-2 text-[13px] text-on-surface-variant">
                        Fee type
                        <select className={`${inputClass} w-52`} value={ft.id} onChange={(e) => setRow({ ft: e.target.value, comp: "" })}>
                          {feeTypes.map((x) => (
                            <option key={x.id} value={x.id}>{x.name}</option>
                          ))}
                        </select>
                      </label>
                      <label className="flex items-center gap-2 text-[13px] text-on-surface-variant">
                        Fee component
                        <select className={`${inputClass} w-52`} value={comp} onChange={(e) => setRow({ comp: e.target.value })}>
                          {ft.components.filter((c) => c.name === comp || !usedElsewhere.includes(c.name)).map((c) => (
                            <option key={c.name} value={c.name}>{c.name}</option>
                          ))}
                        </select>
                      </label>
                      {rows.length > 1 && (
                        <Button variant="ghost" onClick={() => setRows(rows.filter((_, k) => k !== ri))}>Remove</Button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-6 gap-y-2">
                      {draft.tiers.map((t, ti) => {
                        const ov = t.components?.[comp];
                        return (
                          <div key={ti} className="flex items-center gap-2 text-sm text-on-surface">
                            <span className="font-medium">Rank {ti + 1}</span>
                            <select
                              className={inputClass}
                              aria-label={`Rank ${ti + 1} support basis for ${comp}`}
                              value={ov?.basis ?? "follow"}
                              onChange={(e) => setOv(ti, comp, e.target.value as "percent" | "fixed" | "follow", ov)}
                            >
                              <option value="follow">Same as rank ({t.basis === "fixed" ? `S$${t.rate}` : `${t.rate}%`})</option>
                              <option value="percent">% of component</option>
                              <option value="fixed">Fixed S$ amount</option>
                            </select>
                            {ov && (
                              <input
                                type="number"
                                min={0}
                                max={ov.basis === "fixed" ? undefined : 100}
                                step={0.5}
                                className={`${inputClass} w-24 text-right`}
                                aria-label={`Rank ${ti + 1} support for ${comp}`}
                                value={ov.rate}
                                onChange={(e) => { setNote(""); upd(ti, { components: { ...(t.components ?? {}), [comp]: { basis: ov.basis, rate: e.target.value } } }); }}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              <div className="flex justify-start">
                <Button variant="secondary" onClick={() => setRows([...rows, null])}>+ Fee type</Button>
              </div>
            </section>
          );
        })()}

        <p className="text-[13px] text-on-surface-variant">
          Grouping and rates apply to new suggestions and newly generated charges. Issued charges keep the subsidy from
          when they were generated.
        </p>
        <div className="flex justify-end gap-3">
          <Button
            variant="secondary"
            onClick={() => { setD(draftOfSbfasRule(rule)); setErrors({ rows: {} }); setNote(""); }}
          >
            Reset
          </Button>
          <Button onClick={save}>Save SBFAS rules</Button>
        </div>
      </div>
    </Card>
  );
}

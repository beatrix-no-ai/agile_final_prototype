import { useState } from "react";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { EmptyState } from "../../../components/ui/EmptyState";
import { Field, inputClass } from "../../../components/ui/Field";
import { SCHOOLS } from "../../../data/schools";
import {
  draftOfSbfasRule, moefasCoveredBands, ruleForSchool, sbfasRuleOk, toSbfasRule, validateSbfasRule,
  RISK_LEVELS, type RiskLevel, type SbfasRuleDraft, type SbfasRuleErrors, type SubsidyBasis,
} from "../../../data/sbfasRule";
import type { SbfasTier } from "../../../data/sbfasApplications";
import { useSbfas } from "../../../data/sbfasStore";
import { useRules } from "../../../data/moefas";
import { schoolCodeFor } from "../../../data/users";
import { useSession } from "../../../session";
import { formatDate, formatSGD } from "../../../lib/format";

/** What a tier's subsidy means in money, on a S$100 fee — shown beside each tier while editing. */
const onHundred = (t: { basis: SubsidyBasis; rate: string }) => {
  const n = Number(t.rate);
  if (!Number.isFinite(n) || n < 0) return "—";
  if (t.basis === "percent" && n > 100) return "—";
  return formatSGD(Math.max(0, 100 - n));
};

const LEVEL_LABEL: Record<RiskLevel, string> = { HIGH: "HIGH", MED: "MED", LOW: "LOW" };
/** Blocks run from the least to the most support, then the bands no level claims. */
const BLOCK_LEVELS: (RiskLevel | null)[] = ["LOW", "MED", "HIGH", null];

const PCI_BANDS = ["Up to S$450", "S$451 - S$750", "S$751 - S$1,000", "S$1,001 - S$1,500", "Above S$1,500"];
const GHI_BANDS = ["Up to S$1,500", "S$1,501 - S$2,500", "S$2,501 - S$4,000", "Above S$4,000"];

/** One national-band panel (GHI or PCI): each row picks the school's need level; MOEFAS bands are locked. */
function BandPanel({
  title, bands, covered, levels, onPick,
}: {
  title: string;
  bands: readonly string[];
  covered: number[];
  levels: (RiskLevel | null)[];
  onPick: (i: number, level: RiskLevel | null) => void;
}) {
  return (
    <div className="rounded-card border border-line bg-surface-container-lowest p-4">
      <h3 className="text-sm font-semibold text-on-surface">{title}</h3>
      <div className="mt-3 space-y-2">
        {bands.map((label, i) => {
          const locked = covered.includes(i);
          return (
            <div key={i} className="flex items-center justify-between gap-3 rounded-card border border-line px-3 py-2">
              <span className="text-sm">
                <span className="font-medium">Tier {i + 1}</span>{" "}
                <span className="text-on-surface-variant">{label}</span>
              </span>
              {locked ? (
                <span className="inline-flex shrink-0 items-center gap-2" title="Families in this band are granted MOEFAS automatically — your school does not assess them.">
                  <Badge tone="primary">MOEFAS</Badge>
                  <span className="text-[13px] text-on-surface-variant">Auto-granted</span>
                </span>
              ) : (
                <label className="shrink-0">
                  <span className="sr-only">Your level for {label}</span>
                  <select
                    className={`${inputClass} w-36`}
                    value={levels[i] ?? ""}
                    onChange={(e) => onPick(i, (e.target.value || null) as RiskLevel | null)}
                  >
                    <option value="">Not grouped</option>
                    {RISK_LEVELS.map((l) => (
                      <option key={l} value={l}>{LEVEL_LABEL[l]}</option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * School-side SBFAS rule (Req 4): the school groups MOE's national income bands (GHI and PCI) into need
 * levels for the AI suggestion and sets each tier's subsidy — a percentage of the fee or a fixed S$
 * amount. The school chooses how many tiers to offer. Bands already auto-granted by the Active MOEFAS
 * policy are locked — no student can hold both schemes.
 */
export default function SbfasRules() {
  const { role } = useSession();
  const school = schoolCodeFor(role);
  const { state, dispatch } = useSbfas();
  const [moefasRules] = useRules(); // the HQ module's rules, read from storage on mount
  const covered = moefasCoveredBands(moefasRules);
  const rule = school ? ruleForSchool(state.rules, school) : null;
  const [d, setD] = useState<SbfasRuleDraft | null>(null);
  const [errors, setErrors] = useState<SbfasRuleErrors>({ rows: {} });
  const [note, setNote] = useState("");

  if (!school || !rule) {
    return (
      <Card title="SBFAS rules">
        <EmptyState title="SBFAS rules are set by each school" hint="Sign in as a school user to configure your school's package." />
      </Card>
    );
  }

  const draft = d ?? draftOfSbfasRule(rule);
  const schoolName = SCHOOLS.find((s) => s.code === school)?.name ?? school;
  const customized = Boolean(state.rules[school]);
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
  // MOEFAS bands never persist a level: force them back to Not grouped on every edit and save.
  const pick = (dim: "ghi" | "pci", i: number, level: RiskLevel | null) => {
    const bands = dim === "ghi" ? covered.ghi : covered.pci;
    const safe = bands.includes(i) ? null : level;
    setNote("");
    setD({ ...draft, grouping: { ...draft.grouping!, [dim]: draft.grouping![dim].map((v, j) => (j === i ? safe : v)) } });
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
    <Card
      title={`SBFAS rules — ${schoolName}`}
      action={customized ? <Badge tone="primary">Customised {formatDate(rule.updated)}</Badge> : <Badge tone="neutral">National defaults</Badge>}
    >
      <div className="space-y-4">
        <p className="text-sm text-on-surface-variant">
          MOE sets the national income bands; your school groups them into LOW, MED and HIGH need levels for the AI
          suggestion and funds the tiers from its own budget. Bands already granted MOEFAS automatically are locked —
          a student can never hold both schemes.
        </p>
        {note && <p role="status" className="text-[13px] font-medium text-success">{note}</p>}
        {BLOCK_LEVELS.map((lv) => {
          // Band indexes this level claims on each dimension; the panels below only show those rows.
          const pcIdx = draft.grouping!.pci.map((v, j) => (v === lv ? j : -1)).filter((j) => j >= 0);
          const hhIdx = draft.grouping!.ghi.map((v, j) => (v === lv ? j : -1)).filter((j) => j >= 0);
          return (
            <section key={lv ?? "ng"} className="space-y-3 rounded-card border border-line bg-surface-container-lowest p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h4 className="text-sm font-semibold text-on-surface">{lv ? LEVEL_LABEL[lv] : "Not grouped"}</h4>
                {!lv && (
                  <span className="text-[13px] text-on-surface-variant">Bands here match no level — move one into LOW, MED or HIGH.</span>
                )}
              </div>
              <BandPanel
                title="Per-capita bands in this level"
                bands={pcIdx.map((j) => PCI_BANDS[j])}
                covered={pcIdx.filter((j) => covered.pci.includes(j))}
                levels={pcIdx.map((j) => draft.grouping!.pci[j])}
                onPick={(k, level) => pick("pci", pcIdx[k], level)}
              />
              <BandPanel
                title="Gross household bands in this level"
                bands={hhIdx.map((j) => GHI_BANDS[j])}
                covered={hhIdx.filter((j) => covered.ghi.includes(j))}
                levels={hhIdx.map((j) => draft.grouping!.ghi[j])}
                onPick={(k, level) => pick("ghi", hhIdx[k], level)}
              />
            </section>
          );
        })}
        {errors.grouping && <p role="alert" className="text-[13px] font-medium text-alert">{errors.grouping}</p>}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className="px-3 py-2.5 font-medium text-on-surface-variant">Tier</th>
                <th scope="col" className="px-3 py-2.5 font-medium text-on-surface-variant">Subsidy</th>
                <th scope="col" className="px-3 py-2.5 font-medium text-on-surface-variant">Parent pays on a S$100 fee</th>
                <th scope="col" className="px-3 py-2.5 font-medium text-on-surface-variant"><span className="sr-only">Remove</span></th>
              </tr>
            </thead>
            <tbody>
              {draft.tiers.map((t, i) => (
                <tr key={i} className="border-b border-line last:border-0">
                  <td className="px-3 py-3 font-semibold">Tier {i + 1}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <label className="shrink-0">
                        <span className="sr-only">Tier {i + 1} subsidy basis</span>
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
                      <Field label={`Tier ${i + 1} subsidy`} className="w-28" error={errors.rows[i]}>
                        <input
                          type="number"
                          min={0}
                          max={t.basis === "fixed" ? undefined : 100}
                          step={0.5}
                          className={`${inputClass} text-right`}
                          aria-label={`Tier ${i + 1} subsidy ${t.basis === "fixed" ? "amount" : "rate"}`}
                          value={t.rate}
                          onChange={(e) => { setNote(""); upd(i, { rate: e.target.value }); }}
                        />
                      </Field>
                    </div>
                  </td>
                  <td className="px-3 py-3 tabular-nums text-on-surface-variant">{onHundred(t)}</td>
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
          <Button variant="secondary" onClick={() => { setNote(""); addTier(); }}>+ Tier</Button>
        </div>
        {errors.tiers && <p role="alert" className="text-[13px] font-medium text-alert">{errors.tiers}</p>}
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

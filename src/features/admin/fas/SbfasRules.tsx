import { useState } from "react";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { EmptyState } from "../../../components/ui/EmptyState";
import { Field, inputClass } from "../../../components/ui/Field";
import { SCHOOLS } from "../../../data/schools";
import {
  draftOfSbfasRule, moefasCoveredBands, ruleForSchool, sbfasRuleOk, toSbfasRule, validateSbfasRule,
  RISK_LEVELS, type RiskLevel, type SbfasRuleDraft, type SbfasRuleErrors,
} from "../../../data/sbfasRule";
import { SBFAS_TIERS, type SbfasTier } from "../../../data/sbfasApplications";
import { useSbfas } from "../../../data/sbfasStore";
import { useMoefas } from "../../../data/moefasStore";
import { schoolCodeFor } from "../../../data/users";
import { useSession } from "../../../session";
import { formatDate, formatSGD } from "../../../lib/format";

/** What a rate means in money, on a S$100 fee — shown beside each tier while editing. */
const onHundred = (rate: string) => {
  const n = Number(rate);
  return Number.isFinite(n) && n >= 0 && n <= 100 ? formatSGD(100 - n) : "—";
};

const LEVEL_LABEL: Record<RiskLevel, string> = { HIGH: "HIGH", MED: "MED", LOW: "LOW" };

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
 * levels for the AI suggestion, maps each level to an SBFAS tier, and sets the tiers' subsidy rates.
 * Bands already auto-granted by the Active MOEFAS policy are locked — no student can hold both schemes.
 */
export default function SbfasRules() {
  const { role } = useSession();
  const school = schoolCodeFor(role);
  const { state, dispatch } = useSbfas();
  const { state: moefasState } = useMoefas();
  const covered = moefasCoveredBands(moefasState.rules);
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
  // MOEFAS bands never persist a level: force them back to Not grouped on every edit and save.
  const pick = (dim: "ghi" | "pci", i: number, level: RiskLevel | null) => {
    const bands = dim === "ghi" ? covered.ghi : covered.pci;
    const safe = bands.includes(i) ? null : level;
    setD({ ...draft, grouping: { ...draft.grouping!, [dim]: draft.grouping![dim].map((v, j) => (j === i ? safe : v)) } });
  };
  const setLevelTier = (l: RiskLevel, tier: SbfasTier | null) =>
    setD({ ...draft, levelTiers: { ...draft.levelTiers!, [l]: tier } });

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
          MOE sets the national income bands; your school groups them into need levels for the AI suggestion, maps each
          level to an SBFAS tier, and funds the tiers from its own budget. Bands already granted MOEFAS automatically
          are locked — a student can never hold both schemes.
        </p>
        {note && <p role="status" className="text-[13px] font-medium text-success">{note}</p>}
        <div className="grid gap-4 md:grid-cols-2">
          <BandPanel
            title="Per-capita income (monthly)"
            bands={["Up to S$450", "S$451 - S$750", "S$751 - S$1,000", "S$1,001 - S$1,500", "Above S$1,500"]}
            covered={covered.pci}
            levels={draft.grouping!.pci}
            onPick={(i, l) => pick("pci", i, l)}
          />
          <BandPanel
            title="Gross household income (monthly)"
            bands={["Up to S$1,500", "S$1,501 - S$2,500", "S$2,501 - S$4,000", "Above S$4,000"]}
            covered={covered.ghi}
            levels={draft.grouping!.ghi}
            onPick={(i, l) => pick("ghi", i, l)}
          />
        </div>
        {errors.grouping && <p role="alert" className="text-[13px] font-medium text-alert">{errors.grouping}</p>}

        <div className="rounded-card border border-line bg-surface-container-lowest p-4">
          <h3 className="text-sm font-semibold text-on-surface">Suggested tier by need level</h3>
          <p className="mt-1 text-[13px] text-on-surface-variant">What the AI recommends when a family's band falls in each level. "No tier" leaves the decision entirely to the reviewer.</p>
          <div className="mt-3 flex flex-wrap gap-4">
            {RISK_LEVELS.map((l) => (
              <label key={l} className="inline-flex items-center gap-2 text-sm">
                <span className="font-semibold">{LEVEL_LABEL[l]}</span>
                <span aria-hidden>→</span>
                <span className="sr-only">Suggested SBFAS tier for {LEVEL_LABEL[l]}</span>
                <select
                  className={`${inputClass} w-32`}
                  value={draft.levelTiers![l] ?? "none"}
                  onChange={(e) => { setNote(""); setLevelTier(l, (e.target.value === "none" ? null : e.target.value) as SbfasTier | null); }}
                >
                  <option value="none">No tier</option>
                  {SBFAS_TIERS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className="px-3 py-2.5 font-medium text-on-surface-variant">Tier</th>
                <th scope="col" className="px-3 py-2.5 font-medium text-on-surface-variant">Offered by your school</th>
                <th scope="col" className="px-3 py-2.5 font-medium text-on-surface-variant">Subsidy rate (%)</th>
                <th scope="col" className="px-3 py-2.5 font-medium text-on-surface-variant">Parent pays on a S$100 fee</th>
              </tr>
            </thead>
            <tbody>
              {draft.tiers.map((t, i) => (
                <tr key={i} className="border-b border-line last:border-0">
                  <td className="px-3 py-3 font-semibold">Tier {i + 1}</td>
                  <td className="px-3 py-3">
                    <label className="inline-flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="size-4 accent-primary"
                        checked={t.active}
                        onChange={(e) => { setNote(""); upd(i, { active: e.target.checked }); }}
                      />
                      {t.active ? "Offered" : "Not offered"}
                    </label>
                  </td>
                  <td className="px-3 py-3">
                    <Field label={`Tier ${i + 1} subsidy rate`} className="w-28" error={errors.rows[i]}>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.5}
                        className={`${inputClass} text-right`}
                        aria-label={`Tier ${i + 1} subsidy rate`}
                        value={t.rate}
                        onChange={(e) => { setNote(""); upd(i, { rate: e.target.value }); }}
                      />
                    </Field>
                  </td>
                  <td className="px-3 py-3 tabular-nums text-on-surface-variant">{onHundred(t.rate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {errors.tiers && <p role="alert" className="text-[13px] font-medium text-alert">{errors.tiers}</p>}
        <p className="text-[13px] text-on-surface-variant">
          Grouping and rates apply to new suggestions and newly generated charges. Issued charges keep the subsidy from
          when they were generated, and a tier switched off can no longer be chosen in review.
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

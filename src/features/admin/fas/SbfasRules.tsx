import { useState } from "react";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { EmptyState } from "../../../components/ui/EmptyState";
import { Field, inputClass } from "../../../components/ui/Field";
import { SCHOOLS } from "../../../data/schools";
import {
  draftOfSbfasRule, ruleForSchool, sbfasRuleOk, toSbfasRule, validateSbfasRule,
  type SbfasRuleDraft, type SbfasRuleErrors,
} from "../../../data/sbfasRule";
import { useSbfas } from "../../../data/sbfasStore";
import { schoolCodeFor } from "../../../data/users";
import { useSession } from "../../../session";
import { formatDate, formatSGD } from "../../../lib/format";

/** What a rate means in money, on a S$100 fee — shown beside each tier while editing. */
const onHundred = (rate: string) => {
  const n = Number(rate);
  return Number.isFinite(n) && n >= 0 && n <= 100 ? formatSGD(100 - n) : "—";
};

/**
 * School-side SBFAS rule (Req 4): the school decides which tiers it offers and each tier's subsidy rate
 * from its own funds. The national MOEFAS rules stay with HQ. Until the school saves its own package,
 * the national reference rates apply.
 */
export default function SbfasRules() {
  const { role } = useSession();
  const school = schoolCodeFor(role);
  const { state, dispatch } = useSbfas();
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
    setD({ tiers: draft.tiers.map((t, j) => (j === i ? { ...t, ...patch } : t)) });

  const save = () => {
    const e = validateSbfasRule(draft);
    setErrors(e);
    if (!sbfasRuleOk(e)) return;
    const rule = toSbfasRule(draft, school);
    dispatch({ type: "save-rule", rule });
    setD(null);
    setNote(`SBFAS rules saved on ${formatDate(rule.updated)} — new decisions use these rates.`);
  };

  return (
    <Card
      title={`SBFAS rules — ${schoolName}`}
      action={customized ? <Badge tone="primary">Customised {formatDate(rule.updated)}</Badge> : <Badge tone="neutral">National defaults</Badge>}
    >
      <div className="space-y-4">
        <p className="text-sm text-on-surface-variant">
          Your school funds SBFAS from its own budget, so you decide which tiers to offer and the subsidy rate for each.
          MOE never changes these — the national MOEFAS rules are configured separately at HQ.
        </p>
        {note && <p role="status" className="text-[13px] font-medium text-success">{note}</p>}
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
          Rates apply to new SBFAS decisions and newly generated charges. Issued charges keep the subsidy from when
          they were generated, and a tier switched off can no longer be chosen in review.
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

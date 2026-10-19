import { useRef, useState, type RefObject } from "react";
import { Link } from "react-router";
import { Sparkle } from "@phosphor-icons/react";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Field, inputClass } from "../../../components/ui/Field";
import { Modal } from "../../../components/ui/Modal";
import { SBFAS_TIERS, type SbfasApplication, type SbfasTier } from "../../../data/sbfasApplications";
import type { SbfasRule } from "../../../data/sbfasRule";
import { isMoefasEligible, isSbfasEligible } from "../../../data/students";
import { formatSGD } from "../../../lib/format";
import { riskLevel } from "../../../lib/fas";
import { statusLabel, validateDecision, type Action, type Draft, type DecisionError } from "./review";

export const riskTone = { Low: "success", Medium: "warning", High: "alert" } as const;

export function RiskBadge({ score }: { score: number }) {
  const level = riskLevel(score);
  return <Badge tone={riskTone[level]}>{level} - {score}</Badge>;
}

/** Extra fields carried alongside the application (computed in the queue from real student records and charges). */
export type FeeContext = {
  payable: number;
  balance: number;
  nationality: string;
};

type Props = { app: (SbfasApplication & FeeContext) | null; rule: SbfasRule | null; onClose: () => void; onDecide: (id: string, action: Action, draft: Draft) => void };

function Dt({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[13px] text-on-surface-variant">{label}</dt>
      <dd className="mt-0.5 font-semibold text-on-surface">{children}</dd>
    </div>
  );
}

function ReviewBody({ app, rule, onClose, onDecide }: Omit<Props, "app"> & { app: SbfasApplication & FeeContext }) {
  const [tier, setTier] = useState<SbfasTier>(app.recommendedTier);
  const [justification, setJustification] = useState("");
  const [error, setError] = useState<DecisionError | null>(null);
  const tierRef = useRef<HTMLSelectElement>(null);
  const justRef = useRef<HTMLTextAreaElement>(null);
  const decided = app.status !== "Pending";

  const act = (action: Action) => {
    const draft = { justification, tier };
    const err = validateDecision(action, draft, app.recommendedTier);
    if (err) {
      setError(err);
      // Move focus to the offending field so keyboard and screen-reader users land on the error.
      ((err.field === "tier" ? tierRef : justRef) as RefObject<HTMLElement | null>).current?.focus();
      return;
    }
    onDecide(app.id, action, draft);
  };

  return (
    <div className="space-y-5">
      <dl className="grid grid-cols-2 gap-4">
        <Dt label="Student">
          <Link to={`/admin/students/${app.studentId}/fees`} className="rounded text-primary underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
            {app.student} ({app.level})
          </Link>
        </Dt>
        <Dt label="Nationality">{app.nationality}</Dt>
        <Dt label="Household income band (monthly)">{app.householdBand}</Dt>
        <Dt label="Per-capita income band (monthly)">{app.incomeBand}</Dt>
        <Dt label="AI risk rating"><RiskBadge score={app.riskScore} /></Dt>
        <Dt label="AI recommended tier">{app.recommendedTier}</Dt>
      </dl>

      {!isSbfasEligible(app.nationality) ? (
        <p className="rounded-control border border-line px-3 py-2.5 text-[13px] text-alert">
          {app.nationality} — not eligible for MOE FAS or SBFAS (Singapore Citizens and PRs only). Reject this application.
        </p>
      ) : !isMoefasEligible(app.nationality) && (
        <p className="rounded-control border border-line px-3 py-2.5 text-[13px] text-warning">
          {app.nationality} — not eligible for MOE FAS (Singapore Citizens only). SBFAS is the only scheme this student can be considered for.
        </p>
      )}

      <div className="rounded-control border border-line bg-surface-container-low p-4">
        <dl className="grid grid-cols-2 gap-4">
          <Dt label="Fee payable">
            <span className="text-alert">{formatSGD(app.payable)}</span>
            <Link to={`/admin/students/${app.studentId}/fees`} className="ml-1.5 text-[13px] font-normal text-primary underline-offset-2 hover:underline">view fees</Link>
          </Dt>
          <Dt label="Account balance (top-ups)">{formatSGD(app.balance)}</Dt>
        </dl>
      </div>

      <div className="rounded-control border border-line bg-surface-container-low p-4">
        <p className="flex items-center gap-1.5 text-[13px] font-semibold text-on-surface">
          <Sparkle size={16} aria-hidden="true" className="text-primary" /> AI explanation
        </p>
        <p className="mt-1.5 text-sm text-on-surface">{app.explanation}</p>
      </div>

      {decided ? (
        <div className="rounded-control border border-line p-4 text-sm">
          <p className="font-semibold text-on-surface">Decision recorded: {statusLabel(app.status)}{app.sbfasTier ? ` · ${app.sbfasTier}` : ""}</p>
          {app.justification && <p className="mt-1">Justification: {app.justification}</p>}
        </div>
      ) : (
        <>
          <Field
            label="Override tier"
            error={error?.field === "tier" ? error.message : undefined}
            hint={
              rule
                ? `SBFAS rates set by the student's school: ${rule.tiers.map((t) => `Tier ${t.tier.slice(-1)} ${t.active ? `${t.rate}%` : "not offered"}`).join(" · ")}.`
                : undefined
            }
          >
            <select ref={tierRef} className={inputClass} value={tier} onChange={(e) => setTier(e.target.value as SbfasTier)}>
              {SBFAS_TIERS.map((t) => {
                const def = rule?.tiers.find((x) => x.tier === t);
                const off = def && !def.active && t !== app.recommendedTier;
                return (
                  <option key={t} value={t} disabled={off}>
                    {t}{def?.active ? ` — ${def.rate}% subsidy` : ""}{t === app.recommendedTier ? " (AI recommended)" : ""}{off ? " — not offered" : ""}
                  </option>
                );
              })}
            </select>
          </Field>
          {rule && !rule.tiers.find((x) => x.tier === app.recommendedTier)?.active && (
            <p className="-mt-2 text-[13px] text-warning">
              The AI-recommended {app.recommendedTier} is not offered by your school's current SBFAS rules — override to an offered tier or reject.
            </p>
          )}
          <Field
            label="Justification (required to override)"
            hint="Recorded in the audit log with your decision."
            error={error?.field === "justification" ? error.message : undefined}
          >
            <textarea
              ref={justRef}
              rows={3}
              className={`${inputClass} py-2`}
              value={justification}
              onChange={(e) => {
                setJustification(e.target.value);
                if (error?.field === "justification") setError(null);
              }}
            />
          </Field>
          <div className="flex flex-wrap justify-end gap-3 pt-1">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button variant="secondary" onClick={() => act("reject")}>Reject</Button>
            <Button variant="secondary" onClick={() => act("override")}>Override</Button>
            <Button onClick={() => act("approve")}>Approve {app.recommendedTier}</Button>
          </div>
        </>
      )}
    </div>
  );
}

/** Modal stays mounted so Modal can restore focus to the opener; the body is keyed per application to reset its draft. */
export function ReviewModal({ app, rule, onClose, onDecide }: Props) {
  return (
    <Modal open={app !== null} onClose={onClose} title={app ? `Review application ${app.id}` : "Review application"}>
      {app && <ReviewBody key={app.id} app={app} rule={rule} onClose={onClose} onDecide={onDecide} />}
    </Modal>
  );
}

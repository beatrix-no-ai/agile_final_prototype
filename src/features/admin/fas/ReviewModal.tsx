import { useRef, useState, type RefObject } from "react";
import { Link } from "react-router";
import { Sparkle } from "@phosphor-icons/react";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Field, inputClass } from "../../../components/ui/Field";
import { Modal } from "../../../components/ui/Modal";
import { SBFAS_TIERS, SBFAS_TIER_RATES, INCOME_API_SOURCE, type SbfasApplication, type SbfasTier } from "../../../data/sbfasApplications";
import { formatDate, formatSGD } from "../../../lib/format";
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
  /** Outstanding fee components (name → total) that the tier table prices each subsidy against. */
  components: { name: string; amount: number }[];
};

type Props = { app: (SbfasApplication & FeeContext) | null; onClose: () => void; onDecide: (id: string, action: Action, draft: Draft) => void };

function Dt({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[13px] text-on-surface-variant">{label}</dt>
      <dd className="mt-0.5 font-semibold text-on-surface">{children}</dd>
    </div>
  );
}

function ReviewBody({ app, onClose, onDecide }: Omit<Props, "app"> & { app: SbfasApplication & FeeContext }) {
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
        <Dt label="Income source">{INCOME_API_SOURCE} · synced {formatDate(app.incomeSyncedOn)}</Dt>
        <Dt label="AI risk rating"><RiskBadge score={app.riskScore} /></Dt>
        <Dt label="AI recommended tier">{app.recommendedTier}</Dt>
      </dl>

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

      {app.components.length > 0 && (
        <div className="rounded-control border border-line p-4">
          <p className="text-[13px] font-semibold text-on-surface">What each tier would cover</p>
          <p className="mt-0.5 text-[12.5px] text-on-surface-variant">
            Subsidy per fee component on this student's outstanding charges. Income bands are read-only from the {INCOME_API_SOURCE}.
          </p>
          <table className="mt-2 w-full text-[13px]">
            <thead>
              <tr className="text-left text-on-surface-variant">
                <th scope="col" className="py-1 pr-2 font-medium">Component</th>
                <th scope="col" className="py-1 pr-2 text-right font-medium">Fee</th>
                {SBFAS_TIERS.map((t) => (
                  <th scope="col" key={t} className={`py-1 text-right font-medium${t === app.recommendedTier ? " text-primary font-semibold" : ""}`}>
                    {t} · {Math.round(SBFAS_TIER_RATES[t] * 100)}%{t === app.recommendedTier ? " · AI" : ""}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {app.components.map((c) => (
                <tr key={c.name} className="border-t border-line">
                  <td className="py-1 pr-2">{c.name}</td>
                  <td className="py-1 pr-2 text-right">{formatSGD(c.amount)}</td>
                  {SBFAS_TIERS.map((t) => (
                    <td key={t} className={`py-1 text-right${t === app.recommendedTier ? " font-semibold text-primary" : " text-success"}`}>
                      − {formatSGD(c.amount * SBFAS_TIER_RATES[t])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {decided ? (
        <div className="rounded-control border border-line p-4 text-sm">
          <p className="font-semibold text-on-surface">Decision recorded: {statusLabel(app.status)}{app.sbfasTier ? ` · ${app.sbfasTier}` : ""}</p>
          {app.justification && <p className="mt-1">Justification: {app.justification}</p>}
        </div>
      ) : (
        <>
          <Field label="Override tier" error={error?.field === "tier" ? error.message : undefined}>
            <select ref={tierRef} className={inputClass} value={tier} onChange={(e) => setTier(e.target.value as SbfasTier)}>
              {SBFAS_TIERS.map((t) => (
                <option key={t} value={t}>{t}{t === app.recommendedTier ? " (AI recommended)" : ""}</option>
              ))}
            </select>
          </Field>
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
export function ReviewModal({ app, onClose, onDecide }: Props) {
  return (
    <Modal open={app !== null} onClose={onClose} title={app ? `Review application ${app.id}` : "Review application"}>
      {app && <ReviewBody key={app.id} app={app} onClose={onClose} onDecide={onDecide} />}
    </Modal>
  );
}

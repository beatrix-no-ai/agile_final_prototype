import { ArrowsClockwise } from "@phosphor-icons/react";
import { useState } from "react";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { Field, inputClass } from "../../../components/ui/Field";
import { BANDS, householdOf, initialBandId } from "../../../data/familyFas";
import { useParent } from "../../../data/parentStore";
import { fmtDate } from "../overview/shared";
import type { SyncStatus } from "./logic";
import { AssumptionTag } from "../../../components/ui/AssumptionTag";
import type { Outcome } from "./useSync";

type Props = { status: SyncStatus; bandId: string; syncedOn: string; onSync: (o: Outcome) => void };

const message: Partial<Record<SyncStatus, string>> = {
  loading: "Syncing your income band via HOMES...",
  success: "Income band synced via HOMES.",
  error: "HOMES did not respond. Your previous band is kept. Try again.",
};

export function Household({ status, bandId, syncedOn, onSync }: Props) {
  const [outcome, setOutcome] = useState<Outcome>(initialBandId);
  const [after, setAfter] = useState<Outcome>(initialBandId); // band the retry returns after a demo failure
  const { state } = useParent();
  const household = householdOf(state.children);
  const band = BANDS.find((b) => b.id === bandId);
  const loading = status === "loading";

  function sync() {
    onSync(outcome);
    if (outcome === "fail") setOutcome(after); // fail only once, so Retry succeeds
  }

  return (
    <Card title="Household">
      <ul className="divide-y divide-line">
        {household.map((m) => (
          <li key={m.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3 first:pt-0">
            <div>
              <p className="text-sm font-semibold">{m.name}</p>
              <p className="text-[13px] text-on-surface-variant">{m.detail}</p>
            </div>
            <span className="text-[13px] font-medium text-on-surface-variant">{m.role}</span>
          </li>
        ))}
      </ul>
      <div className="mt-2 rounded-control border border-line bg-surface-container-low p-4">
        <p className="text-[13px] font-semibold text-on-surface-variant">Household income band (via HOMES)</p>
        <p className="mt-1 text-lg font-bold">{band?.label ?? "Not synced"}</p>
        <p className="text-[13px] text-on-surface-variant">Only a band is shared with MOE, never exact income. Last synced {fmtDate(syncedOn)}.</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button size="sm" variant="secondary" disabled={loading} onClick={sync} icon={<ArrowsClockwise size={16} weight="bold" aria-hidden="true" className={loading ? "motion-safe:animate-spin" : ""} />}>
            {loading ? "Syncing..." : status === "error" ? "Retry sync" : "Sync income band"}
          </Button>
          <p role="status" className={`text-[13px] font-medium ${status === "error" ? "text-alert" : status === "success" ? "text-success" : "text-on-surface-variant"}`}>
            {message[status]}
          </p>
        </div>
        <details className="mt-3 text-[13px] text-on-surface-variant">
          <summary className="cursor-pointer font-medium">Demo options</summary>
          <div className="mt-2 flex flex-wrap items-end gap-3">
            <Field label="Next sync outcome" className="w-full max-w-80">
              <select
                className={inputClass}
                value={outcome}
                onChange={(e) => {
                  setOutcome(e.target.value);
                  if (e.target.value !== "fail") setAfter(e.target.value);
                }}
              >
                {BANDS.map((b) => <option key={b.id} value={b.id}>Succeeds - band {b.label}</option>)}
                <option value="fail">Fails once, then Retry succeeds</option>
              </select>
            </Field>
            <span className="pb-3"><AssumptionTag /></span>
          </div>
        </details>      </div>
    </Card>
  );
}

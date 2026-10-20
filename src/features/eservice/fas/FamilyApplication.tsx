import { useState } from "react";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { EmptyState } from "../../../components/ui/EmptyState";
import { BANDS } from "../../../data/familyFas";
import { useParent } from "../../../data/parentStore";
import { useMockQuery } from "../../../lib/useMockQuery";
import { ApplicationForm } from "./ApplicationForm";
import { ChildResults } from "./ChildResults";
import { Household } from "./Household";
import { trackerSteps, type FormValues } from "./logic";
import { StartFas } from "./StartFas";
import { TODAY } from "./shared";
import { Tracker } from "./Tracker";
import { useSync } from "./useSync";

const pulse = "motion-safe:animate-pulse rounded-card bg-track";

export default function FamilyApplication() {
  const query = useMockQuery(true);
  const sync = useSync();
  const { state, dispatch } = useParent();
  const { stage, submittedOn } = state.fas;
  // Disbursement starts once the school has answered for every child that was waiting on it.
  const decided = !Object.values(state.outcomes).some((o) => o?.status === "Awaiting school decision");
  // The form starts with the details already on the parent's profile. Residents defaults to the household on file (parents + children), editable.
  const [values, setValues] = useState<FormValues>({ extraIncome: "0", residents: String(state.children.length + 2), contact: state.profile.contact, mailingAddress: state.profile.mailingAddress, note: "" });

  if (query.status === "loading") {
    return (
      <div aria-busy="true" aria-label="Loading family application" className="space-y-4">
        <div className={`${pulse} h-40`} />
        <div className={`${pulse} h-72`} />
        <div className={`${pulse} h-28`} />
      </div>
    );
  }
  if (query.status === "error") {
    return (
      <Card>
        <EmptyState as="h2" title="Could not load your application" hint="Check your connection and try again." action={<Button onClick={query.retry}>Retry</Button>} />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Tracker steps={trackerSteps(stage, decided)} submittedOn={submittedOn} />
      <Household bandId={sync.bandId} syncedOn={sync.syncedOn} />
      <StartFas stage={stage} submittedOn={submittedOn} onStart={() => dispatch({ type: "startFas" })} />
      {stage === "submitted" && <ChildResults children={state.children} outcomes={state.outcomes} />}
      {stage === "preparing" && (
        <ApplicationForm values={values} onChange={setValues} applicant={state.profile.name} onSubmit={() => dispatch({ type: "submitFas", date: TODAY, band: BANDS.find((b) => b.id === sync.bandId)!, details: { extraIncome: Number(values.extraIncome), residents: Number(values.residents) } })} />
      )}
    </div>
  );
}

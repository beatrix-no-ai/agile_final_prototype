import { useState } from "react";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { EmptyState } from "../../../components/ui/EmptyState";
import { BANDS } from "../../../data/familyFas";
import { buildFamilyApps, familyOutcome, reviewPhase } from "../../../data/familySubmission";
import { useSbfas } from "../../../data/sbfasStore";
import { useMockQuery } from "../../../lib/useMockQuery";
import { AiHelper } from "./AiHelper";
import { ApplicationForm } from "./ApplicationForm";
import { ChildResults } from "./ChildResults";
import { Household } from "./Household";
import { trackerSteps, type FormValues } from "./logic";
import { Tracker } from "./Tracker";
import { TODAY } from "./shared";
import { useSync } from "./useSync";
import type { SbfasApplication } from "../../../data/sbfasApplications";
import { fmtDate } from "../overview/shared";

const pulse = "motion-safe:animate-pulse rounded-card bg-track";
const blank: FormValues = { contact: "", mailingAddress: "", note: "" };

export default function FamilyApplication() {
  const query = useMockQuery(true);
  const sync = useSync();
  const { state: sbfas, dispatch } = useSbfas();
  const [values, setValues] = useState<FormValues>(blank);
  const [filledNote, setFilledNote] = useState("");
  const [aiOpen, setAiOpen] = useState(false);
  const band = BANDS.find((b) => b.id === sync.bandId); // undefined = unknown band, shown as "Not synced"
  const outcome = familyOutcome(sbfas.apps, sbfas.family);

  // One family submission per session: per-child SBFAS applications enter the school's review queue.
  const submit = () => {
    if (sbfas.family) return;
    dispatch({ type: "submitFamily", submittedOn: TODAY, apps: buildFamilyApps(sbfas.apps, sync.bandId, sync.syncedOn, values.note) });
  };

  // Per-child decision state for the results card: the app created for each child of this family, if any.
  const appFor = (childName: string): SbfasApplication | undefined =>
    sbfas.family ? sbfas.apps.find((a) => sbfas.family?.appIds.includes(a.id) && a.student === childName) : undefined;

  if (query.status === "loading") {
    return (
      <div aria-busy="true" aria-label="Loading family application" className="space-y-4">
        <div className={`${pulse} h-36`} />
        <div className="grid gap-4 xl:grid-cols-2"><div className={`${pulse} h-96`} /><div className={`${pulse} h-96`} /></div>
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

  const meta = sbfas.family ? `${sbfas.family.appIds[0]} - submitted ${fmtDate(sbfas.family.submittedOn)}` : "Not submitted yet";

  return (
    <div className="space-y-4">
      <Tracker steps={trackerSteps(sync.status, Boolean(band), reviewPhase(outcome), outcome.phase === "approved")} meta={meta} />
      <div className="grid items-start gap-4 xl:grid-cols-2">
        <div className="space-y-4">
          <Household status={sync.status} bandId={sync.bandId} syncedOn={sync.syncedOn} onSync={sync.run} />
          <ChildResults band={band} appFor={appFor} submitted={Boolean(sbfas.family)} />
        </div>
        <ApplicationForm
          values={values}
          onChange={(v) => { setValues(v); setFilledNote(""); }}
          filledNote={filledNote}
          onAskAi={() => setAiOpen(true)}
          onSubmit={submit}
          family={sbfas.family}
        />
      </div>
      <AiHelper open={aiOpen} onClose={() => setAiOpen(false)} values={values} onFill={(v, note) => { setValues(v); setFilledNote(note); }} />
    </div>
  );
}

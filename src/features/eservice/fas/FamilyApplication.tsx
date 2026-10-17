import { useState } from "react";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { EmptyState } from "../../../components/ui/EmptyState";
import { BANDS } from "../../../data/familyFas";
import { useMockQuery } from "../../../lib/useMockQuery";
import { AiHelper } from "./AiHelper";
import { ApplicationForm } from "./ApplicationForm";
import { ChildResults } from "./ChildResults";
import { Household } from "./Household";
import { trackerSteps, type FormValues } from "./logic";
import { Tracker } from "./Tracker";
import { useSync } from "./useSync";

const pulse = "motion-safe:animate-pulse rounded-card bg-track";
const blank: FormValues = { contact: "", mailingAddress: "", note: "" };

export default function FamilyApplication() {
  const query = useMockQuery(true);
  const sync = useSync();
  const [values, setValues] = useState<FormValues>(blank);
  const [filledNote, setFilledNote] = useState("");
  const [aiOpen, setAiOpen] = useState(false);
  const band = BANDS.find((b) => b.id === sync.bandId); // undefined = unknown band, shown as "Not synced"

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

  return (
    <div className="space-y-4">
      <Tracker steps={trackerSteps(sync.status, Boolean(band))} />
      <div className="grid items-start gap-4 xl:grid-cols-2">
        <div className="space-y-4">
          <Household status={sync.status} bandId={sync.bandId} syncedOn={sync.syncedOn} onSync={sync.run} />
          <ChildResults band={band} />
        </div>
        <ApplicationForm values={values} onChange={(v) => { setValues(v); setFilledNote(""); }} filledNote={filledNote} onAskAi={() => setAiOpen(true)} />
      </div>
      <AiHelper open={aiOpen} onClose={() => setAiOpen(false)} values={values} onFill={(v, note) => { setValues(v); setFilledNote(note); }} />
    </div>
  );
}

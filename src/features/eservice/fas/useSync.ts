import { useEffect, useRef, useState } from "react";
import { initialBandId } from "../../../data/familyFas";
import { TODAY } from "./shared";
import type { SyncStatus } from "./logic";

/** ASSUMPTION: mock SingPass income sync. The outcome ("fail" or a band id) is chosen in the demo control; the sync returns a band id, never an exact income. */
export type Outcome = string;

export function useSync() {
  const [status, setStatus] = useState<SyncStatus>("idle");
  const [bandId, setBandId] = useState<string>(initialBandId);
  const [syncedOn, setSyncedOn] = useState(TODAY);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const busy = useRef(false);
  useEffect(() => () => clearTimeout(timer.current), []);

  function run(outcome: Outcome) {
    if (busy.current) return; // in-flight guard: double clicks must not start a second sync
    busy.current = true;
    setStatus("loading");
    timer.current = setTimeout(() => {
      busy.current = false;
      if (outcome === "fail") return setStatus("error");
      setBandId(outcome);
      setSyncedOn(TODAY);
      setStatus("success");
    }, 1200);
  }
  return { status, bandId, syncedOn, run };
}

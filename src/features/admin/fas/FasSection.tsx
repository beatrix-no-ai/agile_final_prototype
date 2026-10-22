import { useState } from "react";
import { useSession } from "../../../session";
import { SbfasReview } from "./FasApplications";
import SbfasRules from "./SbfasRules";
import { MoefasHandbook } from "./MoefasHandbook";
import HardcopyEntry from "./HardcopyEntry";

const SCHOOL_TABS = [
  { id: "sbfas", label: "SBFAS review" },
  { id: "sbfasRules", label: "SBFAS rules" },
  { id: "handbook", label: "MOEFAS Handbook" },
  { id: "hardcopy", label: "Hardcopy applications" },
] as const;

type TabId = (typeof SCHOOL_TABS)[number]["id"];

/** SBFAS workspace (Req 4): schools review their queue, set their own rules, enter paper applications and read the national handbook. MOEFAS lives in /admin/moefas (HQ only), so HQ sees the queue read-only. */
export default function FasSection() {
  const { role } = useSession();
  const [tab, setTab] = useState<TabId>("sbfas");
  if (role === "hq") return <SbfasReview />;

  return (
    <div className="space-y-4">
      <div role="tablist" aria-label="FAS workspace" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {SCHOOL_TABS.map((t, i) => {
          const on = tab === t.id;
          return (
            <button
              key={t.id}
              role="tab"
              type="button"
              aria-selected={on}
              onClick={() => setTab(t.id)}
              className={`flex min-h-14 items-center gap-3 rounded-card border px-4 py-2 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${on ? "border-primary bg-primary-fixed" : "border-line bg-surface-container-lowest hover:bg-surface-container-low"}`}
            >
              <span aria-hidden className={`grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold ${on ? "bg-primary text-on-primary" : "bg-track text-on-surface-variant"}`}>{i + 1}</span>
              <span>
                <span className={`block text-sm font-semibold ${on ? "text-primary" : "text-on-surface"}`}>{t.label}</span>
              </span>
            </button>
          );
        })}
      </div>
      {tab === "sbfas" ? <SbfasReview /> : tab === "sbfasRules" ? <SbfasRules /> : tab === "handbook" ? <MoefasHandbook /> : <HardcopyEntry />}
    </div>
  );
}

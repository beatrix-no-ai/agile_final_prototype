import { useState } from "react";
import { useSession } from "../../../session";
import FasRules from "./FasRules";
import { SbfasReview } from "./FasApplications";
import MoefasApplications from "./MoefasApplications";
import SbfasRules from "./SbfasRules";

const HQ_TABS = [
  { id: "applications", label: "MOEFAS applications", hint: "Family submissions, assessed per child" },
  { id: "rules", label: "FAS rules", hint: "Tiers and subsidies for MOE fee components" },
  { id: "sbfas", label: "SBFAS review", hint: "Referred cases, decided by schools" },
] as const;

const SCHOOL_TABS = [
  { id: "sbfas", label: "SBFAS review", hint: "Applications and decisions" },
  { id: "sbfasRules", label: "SBFAS rules", hint: "Your school's tiers and subsidy rates" },
] as const;

type TabId = "applications" | "rules" | "sbfas" | "sbfasRules";

/** FAS workspace (Req 4): HQ configures MOEFAS policy and reviews family applications; schools review their SBFAS queue. */
export default function FasSection() {
  const { role } = useSession();
  const hq = role === "hq";
  const [tab, setTab] = useState<TabId>(hq ? "applications" : "sbfas");
  const tabs = hq ? HQ_TABS : SCHOOL_TABS;

  return (
    <div className="space-y-4">
      {tabs.length > 1 && (
        <div role="tablist" aria-label="FAS workspace" className={`grid gap-2 ${hq ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
          {tabs.map((t, i) => {
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
                  <span className="block text-[13px] text-on-surface-variant">{t.hint}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
      {tab === "applications" && hq && <MoefasApplications />}
      {tab === "rules" && hq && <FasRules />}
      {tab === "sbfas" && <SbfasReview />}
      {tab === "sbfasRules" && !hq && <SbfasRules />}
    </div>
  );
}

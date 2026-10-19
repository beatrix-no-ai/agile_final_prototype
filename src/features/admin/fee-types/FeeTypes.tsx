import { useState } from "react";
import { MASTER } from "../../../data/fees";
import { schoolCodeFor } from "../../../data/users";
import { useSession } from "../../../session";
import AssignCharges from "./AssignCharges";
import FeeTypeList from "./FeeTypeList";
import HqFeeDashboard, { SchoolFeeBody } from "./HqFeeDashboard";
import StudentCharges from "./StudentCharges";

const TABS = [
  { id: "dash", label: "Student fees & dashboard", hint: "Collected vs outstanding" },
  { id: "assign", label: "Assign fees", hint: "MOE Bill · School Bill · history" },
  { id: "types", label: "School Bill catalogue", hint: "Set up what the school charges" },
  { id: "stu", label: "Student fees", hint: "Review every charge" },
] as const;
type TabId = (typeof TABS)[number]["id"];

const HQ_TABS = [
  { id: "dash", label: "Fee dashboard", hint: "All schools, read-only" },
  { id: "master", label: "MOE Bill catalogue", hint: "Mandatory, whole-cohort bills" },
] as const;

/** Fee (Req 3): schools set up fee types, assign them to classes and review charges; HQ reviews every school read-only. */
export default function FeeTypes() {
  const { role } = useSession();
  const school = schoolCodeFor(role);
  const [tab, setTab] = useState<TabId | "master">("dash");
  const [preset, setPreset] = useState("");
  const hq = role === "hq" || !school;
  const tabs = hq ? HQ_TABS : TABS;

  return (
    <div className="space-y-4">
      <div role="tablist" aria-label="Fee workspace" className={`grid gap-2 sm:grid-cols-2 ${hq ? "" : "lg:grid-cols-4"}`}>
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
      {hq ? (tab === "master" ? <FeeTypeList school={MASTER} /> : <HqFeeDashboard />) : (
        <>
          {tab === "dash" && <SchoolFeeBody school={school} />}
          {tab === "stu" && <StudentCharges school={school} />}
          {tab === "types" && <FeeTypeList school={school} onAssign={(id) => { setPreset(id); setTab("assign"); }} />}
          {tab === "assign" && <AssignCharges school={school} presetFee={preset} />}
        </>
      )}
    </div>
  );
}

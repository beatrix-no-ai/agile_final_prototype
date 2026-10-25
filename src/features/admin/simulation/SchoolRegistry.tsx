import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { ArrowRight, Buildings, Eye, Info, Lock, MagnifyingGlass, User } from "@phosphor-icons/react";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { inputClass } from "../../../components/ui/Field";
import { navFor } from "../../../data/nav";
import { FAMILY_STUDENT_NAMES } from "../../../data/parent";
import { useRegistry } from "../../../data/registryStore";
import { PARENT, usersOfSchool, type StaffAccount } from "../../../data/users";
import { useSession } from "../../../session";
import { filterSchools } from "./logic";

type View = "school" | "parent";

/** Screens a School user sees: same rule as their sidebar (modules + Principal manages users). */
const screensOf = (s: StaffAccount) =>
  navFor("school", { can: (m) => s.modules.includes(m), canManageUsers: s.title === "Principal" }).map((n) => n.label);

function Step({ n, title, hint, children }: { n: number; title: string; hint: string; children: ReactNode }) {
  return (
    <section className="border-line [&+&]:mt-6 [&+&]:border-t [&+&]:pt-6">
      <div className="mb-4 flex items-center gap-3">
        <span className="grid size-7 shrink-0 place-items-center rounded-full border border-line text-xs font-semibold text-primary">{n}</span>
        <div>
          <h2 className="text-sm font-semibold text-on-surface">{title}</h2>
          <p className="text-xs text-on-surface-variant">{hint}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

/** Selectable row/card with a radio dot; aria-pressed carries the state. */
function Choice({ selected, onClick, children, className = "" }: { selected: boolean; onClick(): void; children: ReactNode; className?: string }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`relative flex w-full items-center gap-3 rounded-control border p-3 text-left motion-safe:transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${selected ? "border-primary bg-primary-fixed/30" : "border-line bg-surface-container-lowest hover:border-primary-fixed-dim"} ${className}`}
    >
      {children}
      <span aria-hidden className={`ml-auto size-4 shrink-0 self-start rounded-full border ${selected ? "border-[5px] border-primary" : "border-outline"}`} />
    </button>
  );
}

const Avatar = ({ text }: { text: string }) => (
  <span className="grid size-9 shrink-0 place-items-center rounded-control bg-surface-container text-xs font-semibold text-primary">{text}</span>
);

/** Req 7: MOE HQ picks a School user or Parent and views the system as them, read-only. */
export default function SchoolRegistry() {
  const { startSimulation } = useSession();
  const { state: reg } = useRegistry();
  const navigate = useNavigate();
  const [view, setView] = useState<View>("school");
  const [q, setQ] = useState("");
  const [schoolCode, setSchoolCode] = useState<string | null>(null);
  const [staffEmail, setStaffEmail] = useState<string | null>(null);
  const [parentPicked, setParentPicked] = useState(false);

  const school = reg.schools.find((s) => s.code === schoolCode);
  const users = school ? usersOfSchool(school.code).filter((u) => u.active) : [];
  const staff = users.find((u) => u.email === staffEmail);
  // ASSUMPTION: the mock data holds one parent family; more parents arrive with the SingPass data.
  const parents = [PARENT].filter((p) => `${p.name} ${p.singpassId}`.toLowerCase().includes(q.trim().toLowerCase()));
  const schools = filterSchools(reg.schools, q);
  const ready = view === "school" ? !!staff : parentPicked;
  const screens = view === "parent" ? navFor("parent").map((n) => n.label) : staff ? screensOf(staff) : [];

  const pickView = (v: View) => {
    setView(v);
    setQ("");
    setSchoolCode(null);
    setStaffEmail(null);
    setParentPicked(false);
  };
  const start = () => {
    if (!ready) return;
    startSimulation(view, school?.name, staff?.email);
    navigate(view === "school" ? "/admin" : "/parent");
  };

  const noun = view === "school" ? "school" : "parent";
  const rows: [string, string][] = [
    ["View as", view === "school" ? "School User" : "Parent"],
    ...(view === "school"
      ? ([
          ["School", school?.name ?? "Not selected yet"],
          ["School User", staff?.name ?? "Not selected yet"],
          ["Position", staff?.title ?? "Select a user"],
        ] as [string, string][])
      : ([["Parent", parentPicked ? PARENT.name : "Not selected yet"]] as [string, string][])),
    ["Data scope", view === "school" ? (school ? "Selected school only" : "Choose a record to continue") : parentPicked ? `${FAMILY_STUDENT_NAMES.length} linked children` : "Choose a record to continue"],
    ["Session mode", "Read-only"],
  ];

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-primary">User support</p>
          <p className="mt-1 text-sm text-on-surface-variant">Open a school or parent view to understand and resolve their queries.</p>
        </div>
        <p className="flex items-center gap-1.5 text-xs text-on-surface-variant"><Lock size={14} aria-hidden /> Read-only simulation</p>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.65fr)_minmax(300px,1fr)]">
        <Card>
          <Step n={1} title="Choose a view" hint="Select the portal you want to explore.">
            <div role="group" aria-label="Simulation view" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {([
                ["school", "School User", "Choose a school and a user to view their accessible screens.", Buildings],
                ["parent", "Parent", "View a parent's children, accounts and fees.", User],
              ] as const).map(([v, label, hint, Icon]) => (
                <Choice key={v} selected={view === v} onClick={() => pickView(v)} className="min-h-32 flex-col items-start p-5">
                  <span className={`grid size-9 place-items-center rounded-control ${view === v ? "bg-primary-fixed text-primary" : "bg-surface-container text-on-surface-variant"}`}>
                    <Icon size={20} aria-hidden />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold">{label}</span>
                    <span className="mt-1 block text-xs text-on-surface-variant">{hint}</span>
                  </span>
                </Choice>
              ))}
            </div>
          </Step>

          <Step n={2} title={`Choose a ${noun}`} hint={view === "school" ? "The school determines which records you see." : "The parent determines which children you see."}>
            <label htmlFor="sim-search" className="mb-1.5 block text-[13px] font-semibold">Find {noun}</label>
            <div className="relative">
              <MagnifyingGlass size={16} aria-hidden className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
              <input id="sim-search" type="search" autoComplete="off" className={`${inputClass} pl-9`} placeholder={`Search ${noun} name or ID`} value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <div className="mt-3 grid max-h-80 gap-2 overflow-y-auto">
              {view === "school"
                ? schools.map((s) => (
                    <Choice key={s.code} selected={s.code === schoolCode} onClick={() => { setSchoolCode(s.code); setStaffEmail(null); }}>
                      <Avatar text={s.name.split(" ").map((w) => w[0]).slice(0, 2).join("")} />
                      <span><span className="block text-[13px] font-semibold">{s.name}</span><span className="text-xs text-on-surface-variant">{s.code} · {s.level}</span></span>
                    </Choice>
                  ))
                : parents.map((p) => (
                    <Choice key={p.singpassId} selected={parentPicked} onClick={() => setParentPicked(true)}>
                      <Avatar text={p.initials} />
                      <span><span className="block text-[13px] font-semibold">{p.name}</span><span className="text-xs text-on-surface-variant">{p.singpassId} · {FAMILY_STUDENT_NAMES.length} linked children</span></span>
                    </Choice>
                  ))}
              {(view === "school" ? schools : parents).length === 0 && (
                <p role="status" className="py-8 text-center text-[13px] text-on-surface-variant">No matching records. Try another name or ID.</p>
              )}
            </div>
            <p className="mt-3 text-xs text-on-surface-variant">
              {view === "school" ? "Next, select a user belonging to this school." : "Uses the standard Parent view and the selected parent's linked children."}
            </p>
          </Step>

          {view === "school" && (
            <Step n={3} title="Choose a School User" hint="Available screens follow the selected user's modules.">
              <div className="grid gap-2">
                {!school ? (
                  <p className="py-8 text-center text-[13px] text-on-surface-variant">Select a school to see its users.</p>
                ) : users.length === 0 ? (
                  <p className="py-8 text-center text-[13px] text-on-surface-variant">This school has no active users yet.</p>
                ) : (
                  users.map((u) => (
                    <Choice key={u.email} selected={u.email === staffEmail} onClick={() => setStaffEmail(u.email)}>
                      <Avatar text={u.initials} />
                      <span><span className="block text-[13px] font-semibold">{u.name}</span><span className="text-xs text-on-surface-variant">{u.title} · {u.email}</span></span>
                    </Choice>
                  ))
                )}
              </div>
            </Step>
          )}
        </Card>

        <aside className="grid gap-5 lg:sticky lg:top-6">
          <Card title="Your simulation" action={<Badge tone="primary">Preview</Badge>}>
            <dl aria-live="polite">
              {rows.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 border-b border-line py-3 text-[13px]">
                  <dt className="text-on-surface-variant">{k}</dt>
                  <dd className="max-w-[65%] text-right">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="mb-2 mt-5 text-[11px] uppercase tracking-wide text-on-surface-variant">Screens available to this user</p>
            <div className="flex min-h-6 flex-wrap gap-1.5">
              {screens.map((s) => <span key={s} className="rounded-md border border-line px-2 py-1 text-xs">{s}</span>)}
            </div>
            <div className="my-5 flex gap-2.5 rounded-control border border-line bg-surface-container-low p-3 text-xs text-on-surface-variant">
              <Info size={16} aria-hidden className="mt-0.5 shrink-0 text-primary" />
              <span>MOE HQ can only view. Create, edit, approve, submit and payment actions stay disabled, even if the selected user can perform them.</span>
            </div>
            <Button className="w-full" disabled={!ready} onClick={start} icon={<Eye size={18} aria-hidden />}>
              Start simulation <ArrowRight size={16} aria-hidden />
            </Button>
            <p className="mt-2 text-center text-[11px] text-on-surface-variant">Your MOE HQ session stays signed in.</p>
          </Card>
        </aside>
      </div>
    </div>
  );
}

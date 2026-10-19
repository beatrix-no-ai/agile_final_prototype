import { Badge, type BadgeTone } from "../../../components/ui/Badge";
import { Card } from "../../../components/ui/Card";
import type { ChildFas } from "../../../data/fasStore";
import { fasStatus, type Child } from "../../../data/parent";
import type { FasProgress } from "../../../data/parentStore";
import { GoLink, fmtDate } from "./shared";

type Overall = { label: "Pending" | "Granted" | "Declined"; tone: BadgeTone };

/** Pending while any child still waits on the school; otherwise approved if at least one child got assistance. */
export function overallStatus(outcomes: (ChildFas | null)[]): Overall {
  if (outcomes.some((o) => o?.status === "Awaiting school decision")) return { label: "Pending", tone: "warning" };
  if (outcomes.some((o) => o?.status === "Granted")) return { label: "Granted", tone: "success" };
  return { label: "Declined", tone: "alert" };
}

export function FasCard({ progress, children, outcomes }: { progress: FasProgress; children: Child[]; outcomes: Record<string, ChildFas | null> }) {
  if (progress.stage !== "submitted") {
    const started = progress.stage === "preparing";
    return (
      <Card title="Financial assistance (FAS)" action={<Badge tone={started ? "warning" : "neutral"}>{started ? "In progress" : "Not started"}</Badge>}>
        <p className="text-sm text-on-surface-variant">
          {started ? "You have started an application. Finish it and submit it to MOE." : "You have not applied yet. One application covers all your children."}
        </p>
        <div className="mt-3"><GoLink to="/parent/fas" label={started ? "Continue application" : "Start FAS application"} /></div>
      </Card>
    );
  }
  const overall = overallStatus(children.map((c) => outcomes[c.id] ?? null));
  return (
    <Card title="Financial assistance (FAS)" action={<Badge tone={overall.tone}>{overall.label}</Badge>}>
      <p className="text-[13px] text-on-surface-variant">{fasStatus.applicationId} - submitted {fmtDate(progress.submittedOn ?? fasStatus.submittedOn)}</p>
      <ul className="mt-3 space-y-1.5 text-sm">
        {children.map((c) => {
          const o = outcomes[c.id] ?? null;
          return (
            <li key={c.id} className="flex flex-wrap items-baseline justify-between gap-x-3">
              <span className="font-semibold">{c.name.split(" ")[0]}</span>
              <span className="text-on-surface-variant">{o ? `${o.scheme}${o.tier ? ` ${o.tier}` : ""} - ${o.status.toLowerCase()}` : "Not eligible"}</span>
            </li>
          );
        })}
      </ul>
      <div className="mt-3"><GoLink to="/parent/fas" label="View application" /></div>
    </Card>
  );
}

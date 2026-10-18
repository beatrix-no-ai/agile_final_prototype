import { Badge, type BadgeTone } from "../../../components/ui/Badge";
import { Card } from "../../../components/ui/Card";
import { children } from "../../../data/parent";
import type { Band } from "../../../data/familyFas";
import { assess } from "./logic";
import { AssumptionTag } from "../../../components/ui/AssumptionTag";
import type { SbfasApplication } from "../../../data/sbfasApplications";

const tone: Record<string, BadgeTone> = { Indicative: "success", "School decides": "warning", "Not eligible": "neutral", "In review": "warning", Granted: "success", Declined: "alert" };

/** After the family submission, each child's row shows the school's live decision instead of the band preview. */
export function ChildResults({ band, appFor, submitted }: { band: Band | undefined; appFor: (childName: string) => SbfasApplication | undefined; submitted: boolean }) {
  const r = band ? assess(band) : null;
  return (
    <Card title="Result per child">
      <ul className="space-y-3">
        {children.map((c) => (
          <li key={c.id} className="rounded-control border border-line px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">{c.name}</p>
                <p className="text-[13px] text-on-surface-variant">{c.level}, {c.school}</p>
              </div>
              <ChildBadge r={r} app={appFor(c.name)} submitted={submitted} />
            </div>
            <ChildNote r={r} app={appFor(c.name)} submitted={submitted} />
          </li>
        ))}
      </ul>
      <p className="mt-3 flex flex-wrap items-center gap-2 text-[13px] text-on-surface-variant">
        <AssumptionTag /> Results are indicative until review ends. MOEFAS takes precedence: SBFAS is only considered when MOEFAS is not granted.
      </p>
    </Card>
  );
}

function ChildBadge({ r, app, submitted }: { r: ReturnType<typeof assess> | null; app: SbfasApplication | undefined; submitted: boolean }) {
  if (submitted && app) {
    if (app.status === "Pending") return <Badge tone="warning">SBFAS - In review</Badge>;
    if (app.status === "Approved" || app.status === "Overridden") return <Badge tone="success">SBFAS {app.sbfasTier} - Granted</Badge>;
    return <Badge tone="alert">SBFAS - Declined</Badge>;
  }
  if (r) return <Badge tone={tone[r.status]}>{r.scheme ? `${r.scheme}${r.tier ? ` ${r.tier}` : ""} - ` : ""}{r.status}</Badge>;
  return <Badge tone="neutral">{submitted ? "No school application" : "Not synced"}</Badge>;
}

function ChildNote({ r, app, submitted }: { r: ReturnType<typeof assess> | null; app: SbfasApplication | undefined; submitted: boolean }) {
  if (submitted && app) {
    if (app.status === "Pending") return <p className="mt-2 text-[13px] text-on-surface-variant">Application {app.id} is in the school&apos;s SBFAS queue awaiting a decision.</p>;
    if (app.status === "Approved" || app.status === "Overridden") return <p className="mt-2 text-[13px] text-on-surface-variant">Application {app.id} granted — the subsidy applies to newly issued charges.</p>;
    return <p className="mt-2 text-[13px] text-on-surface-variant">Application {app.id} was declined{app.justification ? `: ${app.justification}` : "."}</p>;
  }
  if (submitted && !app) return <p className="mt-2 text-[13px] text-on-surface-variant">This child did not need a school application (MOE-level or not eligible from the synced band).</p>;
  return <p className="mt-2 text-[13px] text-on-surface-variant">{r ? r.note : "Sync your household income band to see a result."}</p>;
}

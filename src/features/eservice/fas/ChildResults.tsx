import { Badge, type BadgeTone } from "../../../components/ui/Badge";
import { Card } from "../../../components/ui/Card";
import type { ChildFas } from "../../../data/fasStore";
import type { Child } from "../../../data/parent";
import type { SbfasTier } from "../../../data/sbfasApplications";
import { SBFAS_TIER_RATE } from "../../../lib/fees";

/** Parent-facing wording: Pending / Granted / Declined. */
const LABEL: Record<ChildFas["status"], string> = { Granted: "Granted", "Awaiting school decision": "Pending", "Not granted": "Declined" };
const tone: Record<ChildFas["status"], BadgeTone> = { Granted: "success", "Awaiting school decision": "warning", "Not granted": "alert" };

/** The one-line explanation shown under each child's result. */
export function resultNote(o: ChildFas | null): string {
  if (!o) return "No assistance: the household income band is above both schemes. Speak to your school if your situation has changed.";
  if (o.status === "Awaiting school decision") return "Not in a MOEFAS band, so your child's school decides on SBFAS.";
  if (o.status === "Not granted") return o.reason ? `The school did not grant SBFAS: ${o.reason}` : "The school did not grant SBFAS.";
  if (o.scheme === "MOEFAS") return "Granted automatically by criteria. School and miscellaneous fees are waived in full.";
  return `${Math.round((SBFAS_TIER_RATE[o.tier as SbfasTier] ?? 0.5) * 100)}% of each school fee is waived. Unpaid fees have been updated.`;
}

/** What happened to each child's application, as decided on the school side. */
export function ChildResults({ children, outcomes }: { children: Child[]; outcomes: Record<string, ChildFas | null> }) {
  return (
    <Card title="Result per child">
      <ul className="space-y-3">
        {children.map((c) => {
          const o = outcomes[c.id] ?? null;
          return (
            <li key={c.id} className="rounded-control border border-line px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">{c.name}</p>
                  <p className="text-[13px] text-on-surface-variant">{c.level}, {c.school}</p>
                </div>
                {o ? <Badge tone={tone[o.status]}>{o.scheme}{o.tier ? ` ${o.tier}` : ""} - {LABEL[o.status]}</Badge> : <Badge tone="neutral">Not eligible</Badge>}
              </div>
              <p className="mt-2 text-[13px] text-on-surface-variant">{resultNote(o)}</p>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-[13px] text-on-surface-variant">MOEFAS takes precedence: SBFAS is only considered when MOEFAS is not granted.</p>
    </Card>
  );
}

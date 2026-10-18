import { Card } from "../../../components/ui/Card";
import { Badge } from "../../../components/ui/Badge";
import type { Step } from "./logic";
import { AssumptionTag } from "../../../components/ui/AssumptionTag";
import { stateTone } from "./shared";

export function Tracker({ steps, meta }: { steps: Step[]; meta: string }) {
  return (
    <Card title="Application status" action={<span className="text-[13px] text-on-surface-variant">{meta}</span>}>
      <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {steps.map((s, i) => (
          <li key={s.name} className="flex items-center gap-3 rounded-control border border-line px-4 py-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary-fixed text-sm font-bold text-primary" aria-hidden="true">{i + 1}</span>
            <div className="min-w-0">
              <p className="text-sm font-semibold">{s.name}</p>
              <Badge tone={stateTone[s.state]}>{s.state}</Badge>
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-3 flex flex-wrap items-center gap-2 text-[13px] text-on-surface-variant">
        <AssumptionTag /> One application covers the whole family. Disbursement starts only after review is complete.
      </p>
    </Card>
  );
}

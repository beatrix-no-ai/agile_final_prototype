import { Check } from "@phosphor-icons/react";
import { Card } from "../../../components/ui/Card";
import { application } from "../../../data/familyFas";
import { fmtDate } from "../overview/shared";
import type { Step } from "./logic";

const HINT: Record<string, string> = {
  "Prepare info": "Check your household details and fill in the form.",
  Submission: "Send your application to MOE.",
  Disbursement: "Assistance is paid out after MOE has reviewed your application.",
};

/** Three-stage progress: the first step that is not Done is the current one. */
export function Tracker({ steps, submittedOn }: { steps: Step[]; submittedOn?: string }) {
  const current = steps.findIndex((s) => s.state !== "Done");
  return (
    <Card title="Application status" action={submittedOn ? <span className="text-[13px] text-on-surface-variant">{application.id} · submitted {fmtDate(submittedOn)}</span> : undefined}>
      <ol className="grid gap-4 sm:grid-cols-3">
        {steps.map((s, i) => {
          const done = s.state === "Done";
          const now = i === current && s.state === "In progress";
          return (
            <li key={s.name} className="relative">
              <div className="flex items-center gap-3">
                <span
                  className={`grid size-9 shrink-0 place-items-center rounded-full border-2 text-sm font-bold ${done ? "border-success bg-success text-on-primary" : now ? "border-primary bg-primary text-on-primary" : "border-line bg-surface-container-lowest text-on-surface-variant"}`}
                  aria-hidden="true"
                >
                  {done ? <Check size={16} weight="bold" /> : i + 1}
                </span>
                <span className={`hidden h-0.5 flex-1 sm:block ${i === steps.length - 1 ? "sm:hidden" : done ? "bg-success" : "bg-line"}`} aria-hidden="true" />
              </div>
              <p className="mt-2 text-[15px] font-semibold">{s.name}</p>
              <p className="text-[13px] font-medium text-on-surface-variant">{done ? "Done" : now ? "In progress" : s.state === "To do" ? "Next step" : "Not started"}</p>
              <p className="mt-1 text-[13px] text-on-surface-variant">{HINT[s.name]}</p>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

import { HandHeart } from "@phosphor-icons/react";
import { Card } from "../../../components/ui/Card";
import type { FasStage } from "../../../data/parentStore";
import { fmtDate } from "../overview/shared";

/** Under the household section once submitted: where the application stands. Before that the form takes this place. */
export function StartFas({ stage, submittedOn }: { stage: FasStage; submittedOn?: string }) {
  if (stage !== "submitted") return null;
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-full border-[1.5px] border-primary-fixed text-primary" aria-hidden="true">
            <HandHeart size={26} />
          </span>
          <div>
            <h2 className="text-lg font-semibold">Your application is with MOE</h2>
            <p className="mt-1 max-w-xl text-sm text-on-surface-variant">
              {`Submitted on ${fmtDate(submittedOn ?? "")}. MOE is reviewing it. Disbursement starts once the review is complete.`}
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}

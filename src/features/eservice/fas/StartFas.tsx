import { ArrowRight, HandHeart } from "@phosphor-icons/react";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import type { FasStage } from "../../../data/parentStore";
import { fmtDate } from "../overview/shared";

/** The call to action under the household section: start the application, or see where it stands. */
export function StartFas({ stage, submittedOn, onStart }: { stage: FasStage; submittedOn?: string; onStart: () => void }) {
  if (stage === "preparing") return null; // the form itself takes this place
  const submitted = stage === "submitted";
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-full border-[1.5px] border-primary-fixed text-primary" aria-hidden="true">
            <HandHeart size={26} />
          </span>
          <div>
            <h2 className="text-lg font-semibold">{submitted ? "Your application is with MOE" : "Apply for financial assistance"}</h2>
            <p className="mt-1 max-w-xl text-sm text-on-surface-variant">
              {submitted
                ? `Submitted on ${fmtDate(submittedOn ?? "")}. MOE is reviewing it. Disbursement starts once the review is complete.`
                : "One application covers all your children. It takes a few minutes, and we use the household details above."}
            </p>
          </div>
        </div>
        {!submitted && <Button className="min-h-12 px-6 text-base" onClick={onStart} icon={<ArrowRight size={18} weight="bold" aria-hidden="true" />}>Start FAS application</Button>}
      </div>
    </Card>
  );
}

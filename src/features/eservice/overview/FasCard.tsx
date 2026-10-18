import { ArrowRight } from "@phosphor-icons/react";
import { Link } from "react-router";
import { Badge, type BadgeTone } from "../../../components/ui/Badge";
import { Card } from "../../../components/ui/Card";
import type { Fas } from "../../../data/parent";
import type { FasProgress } from "../../../data/parentStore";
import { fmtDate, linkClass } from "./shared";

const tone: Record<Fas["status"], BadgeTone> = { "Under review": "warning", Approved: "success", "Not approved": "alert" };

export function FasCard({ fas, progress }: { fas: Fas; progress: FasProgress }) {
  if (progress.stage !== "submitted") {
    const started = progress.stage === "preparing";
    return (
      <Card title="Financial assistance (FAS)" action={<Badge tone={started ? "warning" : "neutral"}>{started ? "In progress" : "Not started"}</Badge>}>
        <p className="text-sm text-on-surface-variant">
          {started ? "You have started an application. Finish it and submit it to MOE." : "You have not applied yet. One application covers all your children."}
        </p>
        <Link to="/parent/fas" className={`${linkClass} mt-3 gap-1`}>
          {started ? "Continue application" : "Start FAS application"} <ArrowRight size={14} weight="bold" aria-hidden="true" />
        </Link>
      </Card>
    );
  }
  return (
    <Card title="Financial assistance (FAS)" action={<Badge tone={tone[fas.status]}>{fas.status}</Badge>}>
      <p className="text-sm font-semibold">{fas.scheme}</p>
      <p className="text-[13px] text-on-surface-variant">{fas.applicationId} - submitted {fmtDate(progress.submittedOn ?? fas.submittedOn)}</p>
      <p className="mt-3 text-sm text-on-surface-variant">{fas.note}</p>
      <Link to="/parent/fas" className={`${linkClass} mt-3 gap-1`}>
        View application <ArrowRight size={14} weight="bold" aria-hidden="true" />
      </Link>
    </Card>
  );
}
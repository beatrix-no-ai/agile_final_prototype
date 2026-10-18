import { ArrowRight } from "@phosphor-icons/react";
import { Link } from "react-router";
import { Badge, type BadgeTone } from "../../../components/ui/Badge";
import { Card } from "../../../components/ui/Card";
import { familyOutcome } from "../../../data/familySubmission";
import { useSbfas } from "../../../data/sbfasStore";
import { fmtDate, linkClass } from "./shared";

const tone: Record<string, BadgeTone> = { "Not applied": "neutral", "Under review": "warning", Approved: "success", "Not approved": "alert" };

/** Overview card: derives its status live from the school's decisions on this family's application. */
export function FasCard() {
  const { state } = useSbfas();
  const o = familyOutcome(state.apps, state.family);

  const status =
    o.phase === "not-submitted" ? "Not applied"
    : o.phase === "pending" ? "Under review"
    : o.phase === "approved" ? "Approved"
    : "Not approved";
  const idLine = o.phase === "not-submitted" ? "One form covers every child in the family." : `${o.id} - submitted ${fmtDate(o.submittedOn)}`;
  const note =
    o.phase === "not-submitted" ? "Household income band is synced via SingPass when you apply; the school decides on SBFAS per child."
    : o.phase === "pending" ? `The school is reviewing ${o.total} child application${o.total === 1 ? "" : "s"} from this submission${o.decided > 0 ? ` (${o.decided} decided)` : ""}.`
    : o.phase === "approved" ? `SBFAS granted for ${o.granted} of ${o.total} children — the subsidy applies to newly issued charges.`
    : "The school declined this application. Speak to the school bursar if your situation has changed.";

  return (
    <Card title="Financial assistance (FAS)" action={<Badge tone={tone[status]}>{status}</Badge>}>
      <p className="text-sm font-semibold">MOE Financial Assistance Scheme (MOEFAS)</p>
      <p className="text-[13px] text-on-surface-variant">{idLine}</p>
      <p className="mt-3 text-sm text-on-surface-variant">{note}</p>
      <Link to="/parent/fas" className={`${linkClass} mt-3 gap-1`}>
        {o.phase === "not-submitted" ? "Start family application" : "View family application"} <ArrowRight size={14} weight="bold" aria-hidden="true" />
      </Link>
    </Card>
  );
}

import { useEffect } from "react";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft } from "@phosphor-icons/react";
import { Card } from "../../../components/ui/Card";
import { EmptyState } from "../../../components/ui/EmptyState";
import { useFas } from "../../../data/fasStore";
import { schoolOfLevel } from "../../../data/schoolMgmt";
import { useRegistry } from "../../../data/registryStore";
import type { Level } from "../../../data/students";
import { useSession } from "../../../session";
import { PaperDetail } from "./HardcopyEntry";

/** A submitted paper form as its own page: clicking a history row navigates here instead of
 *  expanding the list, so the list stays scannable no matter how many applications there are.
 *
 *  After this school REJECTS a child's SBFAS request, everything happens on the review page
 *  instead: the parent's re-request returns the same application to the queue as its next round,
 *  reason logged — a recorded decision is never changed in place (one application per child per
 *  year; see ReviewPage). */
export default function HardcopyDetailPage() {
  const { faId = "" } = useParams();
  const navigate = useNavigate();
  const { state: fas } = useFas();
  const { state: reg } = useRegistry();
  const { staff } = useSession();
  const mySchool = staff?.schoolCode ?? "";
  const schoolName = reg.schools.find((s) => s.code === mySchool)?.name ?? mySchool;

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [faId]);

  const fa = fas.familyApps.find((f) => f.id === faId && (f.school === schoolName || f.school === mySchool));
  const back = () => navigate("/admin/fas", { state: { fasTab: "hardcopy", hardcopyView: "apps" } });
  const schoolOf = (level: string) => {
    const code = schoolOfLevel(level as Level);
    return reg.schools.find((x) => x.code === code)?.name ?? code;
  };

  const backLink = (
    <button
      type="button"
      onClick={back}
      className="inline-flex items-center gap-1.5 rounded text-sm font-semibold text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <ArrowLeft size={16} weight="bold" aria-hidden="true" /> Back to all applications
    </button>
  );

  if (!fa) {
    return (
      <div className="space-y-4">
        {backLink}
        <Card title={`Paper application ${faId}`}>
          <EmptyState
            title="This paper application is not in the current session"
            hint="Demo data lives in memory and resets on reload — issue a fresh form on the Issue form tab to bring the family back."
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {backLink}
      <Card title={`${fa.id} · ${fa.applicant}`}>
        <PaperDetail fa={fa} linked={fas.apps.filter((x) => x.familyAppId === fa.id)} schoolOf={schoolOf} />
      </Card>
    </div>
  );
}

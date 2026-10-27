import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft, ArrowClockwise } from "@phosphor-icons/react";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { EmptyState } from "../../../components/ui/EmptyState";
import { Field, inputClass } from "../../../components/ui/Field";
import { Modal } from "../../../components/ui/Modal";
import { childOutcomeNow, type FamilyChild } from "../../../data/familyApplications";
import { useFas, latestAppFor } from "../../../data/fasStore";
import { useFasActions } from "../../../data/fasActions";
import { schoolOfLevel } from "../../../data/schoolMgmt";
import { useRegistry } from "../../../data/registryStore";
import type { Level } from "../../../data/students";
import { useSession } from "../../../session";
import { PaperDetail } from "./HardcopyEntry";

/** A submitted paper form as its own page: clicking a history row navigates here instead of
 *  expanding the list, so the list stays scannable no matter how many applications there are.
 *
 *  The edge case lives here (Sprint 3): after this school REJECTS a child's SBFAS request, the
 *  parent may come back asking again. The staff files the re-request from this page — the SAME
 *  application returns to the school's SBFAS review queue with the reason logged as its next
 *  round (attempt 2, 3, ...): one application per child, no second record, no MOE re-assessment. */
export default function HardcopyDetailPage() {
  const { faId = "" } = useParams();
  const navigate = useNavigate();
  const { state: fas } = useFas();
  const { state: reg } = useRegistry();
  const actions = useFasActions();
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

  // The re-request dialog: what changed, and which rejected children it covers.
  const [reaskOpen, setReaskOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
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

  // A child can take a new request only when this record's SBFAS outcome reads rejected AND nothing
  // newer is pending or granted for them (the store guard enforces the same rule again).
  const reaskable: FamilyChild[] = fa.children.filter((c) => {
    if (childOutcomeNow(fa, c, fas.apps).kind !== "rejected") return false;
    if (fas.moefas[c.studentId]) return false;
    const latest = latestAppFor(fas.apps, c.studentId);
    return !latest || latest.status === "Rejected";
  });

  const openReask = () => {
    setPicked(new Set(reaskable.map((c) => c.studentId)));
    setReason("");
    setError("");
    setReaskOpen(true);
  };
  const fileReask = () => {
    if (!reason.trim()) { setError("Say what changed since the rejected request."); return; }
    if (!picked.size) { setError("Pick at least one child for the new request."); return; }
    setError("");
    reaskable
      .filter((c) => picked.has(c.studentId))
      .forEach((c) => actions.requeueSbfas({ studentId: c.studentId, reason: reason.trim(), by: staff?.name ?? "School user" }));
    setReaskOpen(false);
  };

  return (
    <div className="space-y-4">
      {backLink}
      <Card title={`${fa.id} · ${fa.applicant}`}>
        <PaperDetail fa={fa} linked={fas.apps.filter((x) => x.familyAppId === fa.id)} schoolOf={schoolOf} />
      </Card>

      {reaskable.length > 0 && (
        <Card title="SBFAS not granted — the parent asked again?">
          <div className="space-y-3">
            <p className="text-[13px] text-on-surface-variant">
              {reaskable.map((c) => c.student).join(", ")} had the SBFAS request rejected. If the school is reconsidering its own
              decision, use Reopen &amp; amend on the review screen — the record is amended in place. This button is for the
              parent&apos;s new request: the same application returns to this school&apos;s SBFAS review queue with the reason
              logged on it — no second application is created, and no MOE re-assessment runs.
            </p>
            <div className="flex justify-end">
              <Button onClick={openReask}>
                <ArrowClockwise size={16} weight="bold" aria-hidden="true" /> Request SBFAS review again
              </Button>
            </div>
          </div>
        </Card>
      )}

      <Modal
        open={reaskOpen}
        onClose={() => setReaskOpen(false)}
        title="File a new SBFAS request"
        footer={
          <>
            <Button variant="secondary" onClick={() => setReaskOpen(false)}>Cancel</Button>
            <Button onClick={fileReask}>File the request</Button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <p className="text-sm font-semibold text-on-surface">Children on the new request</p>
            {/* One reaskable child needs no picking — the request simply covers them. */}
            {reaskable.length === 1 ? (
              <p className="mt-1.5 rounded-control border border-line px-3 py-2 text-sm">
                {reaskable[0].student} <span className="text-[13px] text-on-surface-variant">({reaskable[0].level})</span>
              </p>
            ) : (
              <ul className="mt-1.5 space-y-1.5">
                {reaskable.map((c) => (
                  <li key={c.studentId}>
                    <label className="flex items-center gap-2.5 rounded-control border border-line px-3 py-2 text-sm">
                      <input
                        type="checkbox"
                        className="size-4 accent-[#8A2538]"
                        checked={picked.has(c.studentId)}
                        onChange={(e) => setPicked((p) => {
                          const next = new Set(p);
                          if (e.target.checked) next.add(c.studentId); else next.delete(c.studentId);
                          return next;
                        })}
                      />
                      <span>{c.student} <span className="text-[13px] text-on-surface-variant">({c.level})</span></span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <Field label="What changed since the rejected request" required>
            <textarea
              rows={2}
              className={`${inputClass} py-2`}
              value={reason}
              onChange={(e) => { setReason(e.target.value); if (error) setError(""); }}
              placeholder="e.g. a parent stopped working in August"
            />
          </Field>
          {error && <p className="text-[13px] font-medium text-alert" role="alert">{error}</p>}
          <p className="text-[13px] text-on-surface-variant">
            The same application returns to this school&apos;s SBFAS review queue as its next round — the queue keeps one row
            per child. Every round (the request and its decision) stays logged on the application&apos;s review page.
          </p>
        </div>
      </Modal>
    </div>
  );
}

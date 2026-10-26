import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { CaretRight, Plus, Printer, X } from "@phosphor-icons/react";
import { Badge, type BadgeTone } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { EmptyState } from "../../../components/ui/EmptyState";
import { Modal } from "../../../components/ui/Modal";
import { Field, inputClass } from "../../../components/ui/Field";
import { childOutcomeNow, draftByCode, nextDraftId, outcomeNote, type ChildOutcomeNow, type FamilyApplication, type FamilyChild, type FamilyDraft } from "../../../data/familyApplications";
import { openDraftPrint } from "./draftPrint";
import { guardianByNric, normNric, type GuardianRecord } from "../../../data/familyRegistry";
import { useFasActions } from "../../../data/fasActions";
import { latestAppFor, useFas } from "../../../data/fasStore";
import { BANDS, type Band } from "../../../data/familyFas";
import { attemptOf, type SbfasApplication } from "../../../data/sbfasApplications";
import { schoolOfLevel } from "../../../data/schoolMgmt";
import { useRegistry } from "../../../data/registryStore";
import type { Level } from "../../../data/students";
import { schoolOfStudent } from "../../../lib/registry";
import { useSession } from "../../../session";
import { statusLabel } from "./review";

// Requirement 5: parents who cannot use the e-Service Portal hand a paper MOE FAS form to the school.
// Sprint 3 refinement (Sherly, 26 Oct 2026): the entry starts with the parent/guardian NRIC — the
// applicant, contact, address and EVERY child of the family come from the shared MOE registry, and
// those registry rows are locked (a difference between the form and the registry means the form was
// filled in wrongly, not the database). An NRIC that matches nothing falls back to typing the
// children in by hand. OCR was dropped with the same refinement — the registry pre-fills the form,
// so there is nothing to scan. Sections III (benefits), IV (transport) and V (IMDA device) were cut
// from the scope; the form keeps the paper form's own numbering for what remains.
// Both hardcopy flows share one entry form: (1) the FIRST form goes to MOE and runs the SAME
// assessment as an online one: MOEFAS first, then the SBFAS queue on referral. Section I lists every
// child the form names — this school's children are tagged "Your school", a child at another school
// shows their school, and their own school receives any SBFAS referral. (2) after that application
// is rejected at SBFAS, the parent hands in a SEPARATE new request — at the submit step the form
// goes straight to the school's SBFAS queue as attempt 2, 3, ... The Applications tab keeps history.
//
// The entry form follows the online family application (Sprint 3 parity — the same fields, the same
// assessment): I Child particulars · II Household income (extra money + residents; the band itself
// comes from HOMES) · III Declaration. Section IV is the school's own step (not on the paper form):
// where the form goes — MOE or straight to the SBFAS queue — and the staff member's confirmation
// that every field was checked.
//
// The print-first flow keeps a MANDATORY draft record: every generated form is stored as "Draft —
// awaiting return" with the children it was issued for, so the school always knows exactly which
// students hold a form. Keying in the returned copy requires cross-checking it against that draft
// (a required confirmation), and on submit the draft flips to "Returned", linked to the FAS2026####
// application the copy became — both flows, MOE and the SBFAS queue. The returned paper carries its
// DRF no. in the header, so the staff usually pulls the form by that code (the pre-printed fields
// lock and only the parent's hand-filled Sections II–III are keyed in); the NRIC lookup remains for
// forms the system never printed.

/** Mock rendering of a scanned form for a record that still carries one (HQ applications screen). */
export const formDocImage = (file: string, applicant: string) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="700" height="760"><rect width="700" height="760" fill="#faf8f6"/><rect x="40" y="35" width="620" height="690" rx="6" fill="white" stroke="#e4dddd"/><text x="75" y="100" font-family="Arial" font-size="24" fill="#8a2538">Scanned MOE FAS form · SAMPLE</text><text x="75" y="155" font-family="Arial" font-size="15">File: ${file}</text><text x="75" y="200" font-family="Arial" font-size="17">Applicant: ${applicant || "—"}</text><text x="75" y="260" font-family="Arial" font-size="16">Sections I–VI as filled in by the parent</text><text x="75" y="310" font-family="Arial" font-size="14">Mock scan rendering — the OCR pre-filled the entry fields from it.</text><text x="75" y="340" font-family="Arial" font-size="14">Verify every field against this scan before submitting.</text></svg>`;
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
};
/** One Section I row as the staff types it — the paper form's child table columns, keyed as on the form.
 *  `db` marks a row the family lookup pulled from the registry: every field on it is locked. */
type ChildDraft = { nric: string; name: string; school: string; level: string; db?: boolean };
const blankChild = (): ChildDraft => ({ nric: "", name: "", school: "", level: "" });

/** Tone for the live per-child outcome (childOutcomeNow): follows the school's SBFAS decision. */
const LIVE_TONE: Record<ChildOutcomeNow["kind"], BadgeTone> = { granted: "success", pending: "warning", rejected: "alert", neutral: "neutral" };

/** Section IV's one-line MOE verdict for a flow-1 form: the assessment ran at submission and is
 *  final, so it is told here once instead of repeating a badge on every child row. */
function moeVerdict(fa: FamilyApplication): string {
  const granted = fa.children.filter((c) => c.outcome === "MOEFAS granted");
  const referred = fa.children.filter((c) => c.outcome === "MOEFAS not granted");
  const covered = fa.children.filter((c) => c.outcome === "Already covered");
  const names = (xs: FamilyChild[]) => xs.map((c) => c.student).join(", ");
  if (granted.length && !referred.length) return `MOE assessed at submission: MOEFAS granted — ${names(granted)}.`;
  if (referred.length && !granted.length)
    return `MOE assessed at submission: MOEFAS not granted for ${names(referred)} — outside the MOEFAS bands, referred to each school's SBFAS review queue.`;
  const parts: string[] = [];
  if (granted.length) parts.push(`MOEFAS granted for ${names(granted)}`);
  if (referred.length) parts.push(`not granted for ${names(referred)} — referred to SBFAS`);
  if (covered.length) parts.push(`${names(covered)} already covered`);
  return parts.length ? `MOE assessed at submission: ${parts.join("; ")}.` : "MOE assessed at submission.";
}
const statusTone: Record<SbfasApplication["status"], BadgeTone> = { Pending: "neutral", Approved: "success", Overridden: "success", Rejected: "alert" };

/** Small numbered section heading, mirroring the paper form's sections. */
function SectionTitle({ n, title, note }: { n: string; title: string; note?: string }) {
  return (
    <div>
      <h3 className="text-sm font-bold text-on-surface">Section {n} — {title}</h3>
      {note && <p className="mt-0.5 text-[13px] text-on-surface-variant">{note}</p>}
    </div>
  );
}

/** One paper family application as a row — click anywhere on it to read the form as submitted.
 *  Child badges read the linked queue application live, so a later school decision shows here. */
function PaperRow({ fa, apps, schoolOf, onOpen }: { fa: FamilyApplication; apps: SbfasApplication[]; schoolOf: (level: string) => string; onOpen: () => void }) {
  return (
    <li className="relative cursor-pointer rounded-control border border-line px-4 py-3 transition-colors hover:border-outline hover:bg-surface-container-low">
      <button className="absolute inset-0 rounded-control" aria-label={`View ${fa.id} — ${fa.applicant}`} onClick={onOpen} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">{fa.id} · {fa.applicant}</p>
          <p className="text-[13px] text-on-surface-variant">
            {new Date(fa.at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} · {fa.bandLabel} · entered by {fa.enteredBy}
            {fa.entryMode === "ocr" ? " (PDF upload + OCR)" : ""}
          </p>
        </div>
        <span className="flex items-center gap-1.5">
          <Badge tone="neutral">{fa.children.length} {fa.children.length > 1 ? "children" : "child"}</Badge>
          <CaretRight size={16} weight="bold" aria-hidden="true" className="text-on-surface-variant" />
        </span>
      </div>
      <ul className="mt-2 space-y-1.5">
        {fa.children.map((c) => {
          const co = childOutcomeNow(fa, c, apps);
          return (
            <li key={c.studentId} className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
              <span className="font-medium text-on-surface">
                {c.student} <span className="font-normal text-on-surface-variant">({c.level}{schoolOf(c.level) !== fa.school ? ` · ${schoolOf(c.level)}` : ""})</span>
              </span>
              <span className="flex flex-wrap items-center gap-1.5">
                {/* Single live badge; MOE's instant verdict is told once, in Section IV of the detail page. */}
                <Badge tone={LIVE_TONE[co.kind]}>{co.label}</Badge>
              </span>
            </li>
          );
        })}
      </ul>
      {(fa.welfareLetter || fa.note || fa.imdaHardcopy === "yes") && (
        <div className="mt-2 space-y-1 border-t border-line pt-2">
          {fa.welfareLetter && (
            <p className="text-[12px] text-on-surface-variant">
              Welfare home letter: {fa.welfareLetter.home ? `${fa.welfareLetter.home} · ` : ""}{fa.welfareLetter.file}
            </p>
          )}
          {fa.note && <p className="text-[12px] text-on-surface-variant">Note on the form: {fa.note}</p>}
          {fa.imdaHardcopy === "yes" && (
            <p className="text-[12px] text-on-surface-variant">IMDA DigitalAccess@Home — hard copy of the application form requested.</p>
          )}
        </div>
      )}
    </li>
  );
}

/** The submitted paper form behind a history row: every field the school keyed in, frozen read-only,
 *  plus where the form went — the child outcomes and any request now sitting in the review queue. */
export function PaperDetail({ fa, linked, schoolOf }: { fa: FamilyApplication; linked: SbfasApplication[]; schoolOf: (level: string) => string }) {
  const flow2 = fa.children.length > 0 && fa.children.every((c) => c.outcome === "New SBFAS request");
  const totalGhi = (fa.household ?? []).reduce((s, m) => s + m.gross + m.other, 0);
  return (
    <div className="space-y-5">
      <p className="text-[13px] text-on-surface-variant">
        {new Date(fa.at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} · {fa.school} · entered by {fa.enteredBy}
        {fa.entryMode === "ocr" ? " (PDF upload + OCR)" : " (keyed in)"}
      </p>
      <section className="space-y-2">
        <SectionTitle n="I" title="Particulars of the child" />
        <ul className="space-y-1.5">
          {fa.children.map((c) => {
            const co = childOutcomeNow(fa, c, linked);
            const note =
              co.kind === "granted" && c.outcome !== "MOEFAS granted"
                ? "MOEFAS was not granted, but the school granted SBFAS — the subsidy is applied to the eligible fees."
                : co.kind === "rejected"
                  ? "SBFAS not granted — the parent may hand the school a separate new request if circumstances change."
                  : co.kind === "pending" && c.outcome === "MOEFAS not granted"
                    ? `Referred to ${schoolOf(c.level) === fa.school ? "this school's" : `${schoolOf(c.level)}'s`} SBFAS review queue — awaiting the decision.`
                    : outcomeNote(c);
            return (
              <li key={c.studentId} className="space-y-0.5">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="font-medium text-on-surface">
                    {c.student} <span className="font-normal text-[13px] text-on-surface-variant">({c.level}{schoolOf(c.level) !== fa.school ? ` · ${schoolOf(c.level)}` : ""})</span>
                  </span>
                  <Badge tone={LIVE_TONE[co.kind]}>{co.label}</Badge>
                </div>
                <p className="text-[13px] text-on-surface-variant">{note}</p>
              </li>
            );
          })}
        </ul>
        <p className="text-sm"><span className="text-on-surface-variant">Contact: </span><span className="font-medium">{fa.contact || "—"}</span></p>
        {fa.address && <p className="text-sm"><span className="text-on-surface-variant">Home address: </span><span className="font-medium">{fa.address}</span></p>}
        {fa.email && <p className="text-sm"><span className="text-on-surface-variant">Email: </span><span className="font-medium">{fa.email}</span></p>}
      </section>
      <section className="space-y-2 border-t border-line pt-4">
        <SectionTitle n="II" title="Household income" />
        {(fa.extraIncome !== undefined || fa.residents !== undefined) && (
          <p className="text-sm">
            <span className="text-on-surface-variant">Extra monthly money (not in HOMES): </span>
            <span className="font-medium">S${fa.extraIncome?.toLocaleString("en-SG") ?? 0}</span>
            <span className="text-on-surface-variant"> · People currently living in the home: </span>
            <span className="font-medium">{fa.residents ?? "—"}</span>
          </p>
        )}
        {fa.welfareHome ? (
          <p className="text-sm">
            <span className="text-on-surface-variant">Welfare home resident — letter: </span>
            <span className="font-medium">{fa.welfareLetter?.file ?? "not attached"}</span>
            {fa.welfareLetter?.home && (
              <span className="text-[13px] text-on-surface-variant"> · {fa.welfareLetter.home}{fa.welfareLetter.dated ? `, dated ${fa.welfareLetter.dated}` : ""}</span>
            )}
          </p>
        ) : fa.household?.length ? (
          <ul className="space-y-1">
            {fa.household.map((m, i) => (
              <li key={i} className="text-sm">
                <span className="font-medium">{m.name}</span>
                <span className="text-[13px] text-on-surface-variant"> · {m.nric ?? "—"} · {m.relationship} · {m.age} · {m.occupation} · gross S${m.gross.toLocaleString("en-SG")} · other S${m.other.toLocaleString("en-SG")}</span>
              </li>
            ))}
            <li className="text-sm"><span className="text-on-surface-variant">Total GHI: </span><span className="font-medium">S${totalGhi.toLocaleString("en-SG")} / month</span></li>
          </ul>
        ) : fa.homesOnly ? (
          <p className="text-sm text-on-surface-variant">
            Only employment and/or trade income — Section II was not required; the bands were retrieved from HOMES (IRAS + CPF).
          </p>
        ) : null}
        <p className="text-sm"><span className="text-on-surface-variant">Income band: </span><span className="font-medium">{fa.bandLabel}</span></p>
      </section>
      {/* Sections IV (transport) and V (IMDA device) were cut from the scope — a record can no longer
          carry them, so the paper detail jumps from Section II to the Section III declaration. */}
      <section className="space-y-2 border-t border-line pt-4">
        <SectionTitle n="III" title="Declaration and agreement by the applicant" />
        {fa.declaredAt && (
          <p className="text-sm">
            <span className="text-on-surface-variant">Signed and dated by </span>
            <span className="font-medium">{fa.applicant}</span>
            <span className="text-on-surface-variant"> on </span>
            <span className="font-medium">{new Date(fa.declaredAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
          </p>
        )}
        {fa.note && <p className="text-[13px] text-on-surface-variant">{flow2 ? "What changed: " : "Note on the form: "}{fa.note}</p>}
      </section>
      <section className="space-y-2 border-t border-line pt-4">
        <SectionTitle n="IV" title="Where this form goes" />
        <p className="text-sm font-medium">
          {flow2 ? "To this school's SBFAS review queue — a separate request after a rejection" : "To MOE for assessment — the first application"}
        </p>
        {/* The MOE verdict is instant and final at submission — it is told here, once, not repeated
            as a second badge on every child row above. */}
        {!flow2 && <p className="text-[13px] text-on-surface-variant">{moeVerdict(fa)}</p>}
        {/* MOE route: every child's pass/fail is known at submission, so the rows carry the verdict
            itself (the school's live SBFAS status stays on each child in Section I). Flow 2 never
            reaches MOE — its rows keep the school queue status. */}
        {flow2 ? (
          linked.length > 0 && (
            <ul className="space-y-1.5">
              {linked.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span>
                    <span className="font-medium">{a.id}</span> · {a.student}
                    <span className="text-[13px] text-on-surface-variant">{attemptOf(a) > 1 ? ` · attempt ${attemptOf(a)}` : ""}{a.sbfasTier ? ` · ${a.sbfasTier}` : ""}</span>
                  </span>
                  <Badge tone={statusTone[a.status]}>{statusLabel(a.status)}</Badge>
                </li>
              ))}
            </ul>
          )
        ) : (
          <ul className="space-y-1.5">
            {fa.children.map((c) => {
              const a = linked.filter((x) => x.studentId === c.studentId).sort((x, y) => (y.attemptNo ?? 1) - (x.attemptNo ?? 1))[0];
              return (
                <li key={c.studentId} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span>
                    {c.student}
                    {a && <span className="text-[13px] text-on-surface-variant"> · {a.id}</span>}
                  </span>
                  <Badge tone={c.outcome === "MOEFAS granted" ? "success" : c.outcome === "Already covered" ? "neutral" : "warning"}>
                    {c.outcome === "MOEFAS granted" ? `MOEFAS granted${c.tier ? ` · ${c.tier}` : ""}` : c.outcome === "Already covered" ? "Already covered" : "MOEFAS not granted"}
                  </Badge>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

export default function HardcopyEntry() {
  const { state: fas } = useFas();
  const { state: reg } = useRegistry();
  const actions = useFasActions();
  const { staff } = useSession();
  const by = staff?.name ?? "School user";
  const mySchool = staff?.schoolCode ?? "";
  const schoolName = reg.schools.find((s) => s.code === mySchool)?.name ?? mySchool;

  const mine = useMemo(() => reg.students.filter((s) => schoolOfStudent(s, reg.classes) === mySchool), [reg.students, reg.classes, mySchool]);

  const schoolNameOf = (code: string) => reg.schools.find((x) => x.code === code)?.name ?? code;
  const schoolOfLevelName = (level: string) => schoolNameOf(schoolOfLevel(level as Level));
  // Section I lists every child the paper form names, across schools: this school's children are
  // highlighted, and a child at another school shows their school — their own school runs any SBFAS
  // review, because the review queue follows the child's school.
  const roster = useMemo(() => reg.students.map((s) => {
    const code = schoolOfStudent(s, reg.classes);
    const grant = fas.moefas[s.id];
    const app = latestAppFor(fas.apps, s.id);
    return { student: s, school: schoolNameOf(code), mineSchool: code === mySchool, grant, app, blocked: !!(grant || app) };
  }), [reg.students, reg.classes, reg.schools, fas.moefas, fas.apps, mySchool]);

  // One paper form at a time: the staff member works through a single form, keyed in by hand.
  // Section I mirrors the paper form's child table: however many children the form lists, that many
  // rows — the staff adds/removes rows to match it and keys each by hand with the form's own
  // columns — NRIC, name, current school, level. The NRIC is matched against the registry; children
  // already holding an application stay on the form too (the store keeps one application per child,
  // AC-031).
  const [childrenRows, setChildrenRows] = useState<ChildDraft[]>(() => [blankChild()]);
  // A hand-entered row becomes a child record through the NRIC — that is the match; everything else
  // on the row is transcription. Case and spacing differences are tolerated (normNric, shared with
  // the family lookup).
  const byNric = useMemo(() => new Map(roster.map((r) => [normNric(r.student.nric), r])), [roster]);
  const matchOf = (row: ChildDraft) => (row.nric.trim() ? byNric.get(normNric(row.nric)) : undefined);
  const rowFilled = (row: ChildDraft) => !!(row.nric.trim() || row.name.trim() || row.school.trim() || row.level.trim());
  const [applicant, setApplicant] = useState("");
  const [contact, setContact] = useState("");
  const [address, setAddress] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  // Section II mirrors the online family application exactly (Sprint 3 parity): the two fields the
  // parent declares on the paper form — money not in HOMES, and everyone living at home. The income
  // band itself is never keyed: it comes from HOMES like an online application.
  const [extraIncome, setExtraIncome] = useState("");
  const [residents, setResidents] = useState("");
  // Section III's declaration tick, plus the final read-only review page.
  const [declared, setDeclared] = useState(false);
  // The returned-copy cross-check: required whenever the family has an open draft (see draftOf) —
  // the staff member confirms they compared this entry against the printed form before submitting.
  const [checkedAgainst, setCheckedAgainst] = useState(false);
  // Where this form goes, chosen at the submit step: MOE for the MOEFAS-first assessment (flow 1), or
  // straight to this school's SBFAS queue as a separate request after a rejection (flow 2).
  const [submitMode, setSubmitMode] = useState<"moe" | "sbfas">("moe");
  // The final check: a separate read-only page with every field frozen — Submit only lives there.
  const [reviewing, setReviewing] = useState(false);
  // Submit asks once more in a dialog before the form leaves the staff member's hands.
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");

  // Flow 2 shares the same form: what changed since the rejected request, read off the new form.
  const [reason, setReason] = useState("");
  // Students whose latest SBFAS application was rejected (and nothing pending since) — the only children
  // a separate new request can be made for.
  const rejectedStudents = useMemo(() => mine.filter((s) => {
    const mine2 = fas.apps.filter((x) => x.studentId === s.id && x.status !== "Pending");
    return !fas.moefas[s.id] && !fas.apps.some((x) => x.studentId === s.id && x.status === "Pending") && mine2.some((x) => x.status === "Rejected");
  }), [mine, fas.apps, fas.moefas]);
  const rejectedIds = useMemo(() => new Set(rejectedStudents.map((s) => s.id)), [rejectedStudents]);
  // The request the new one replaces — context for the first eligible child on the form.
  const reFirstId = submitMode === "sbfas"
    ? childrenRows.flatMap((row) => {
        const m = matchOf(row);
        return m && rejectedIds.has(m.student.id) ? [m.student.id] : [];
      })[0] ?? ""
    : "";
  const reLast = useMemo(
    () => (reFirstId ? [...fas.apps].filter((x) => x.studentId === reFirstId && x.status === "Rejected").sort((a, b) => attemptOf(b) - attemptOf(a))[0] ?? null : null),
    [reFirstId, fas.apps],
  );

  const paperApps = useMemo(
    () => fas.familyApps.filter((f) => f.school === schoolName || f.school === mySchool),
    [fas.familyApps, schoolName, mySchool],
  );
  // History drill-down: each row navigates to its own page (see HardcopyDetailPage), so the list
  // stays scannable however long it gets.
  const navigate = useNavigate();
  // One entry form: the submit step decides where it goes (MOE-first, or straight to this school's
  // SBFAS queue after a rejection), then the two lists.
  // The refined flow starts one step before data entry: Issue form (print the pre-filled form for the
  // parent to check and sign) → New form (key in the returned copy) → Applications (history).
  type View = "issue" | "new" | "apps";
  // Returning from a paper-application page reopens the list the staff member came from.
  const initialView = (useLocation().state as { hardcopyView?: View } | null)?.hardcopyView;
  const [view, setView] = useState<View>(initialView ?? "issue");
  const views: [View, string][] = [
    ["issue", "Issue form"],
    ["new", "New form"],
    ["apps", "Applications"],
  ];

  // Sprint 3 refinement — the family lookup: the staff keys in the parent/guardian NRIC from the
  // paper form's declaration and the family comes back from the shared MOE registry. The registry
  // rows REPLACE whatever is on the form and lock (the database is the source of truth); the
  // applicant and contact details only fill blanks, so a newer number written on the form survives.
  const [lookupNric, setLookupNric] = useState("");
  const [looking, setLooking] = useState(false);
  const [lookedUp, setLookedUp] = useState<GuardianRecord | null>(null);
  const [lookupMiss, setLookupMiss] = useState(false);
  // The draft-code path (primary when a printed form exists): the staff types the DRF no. printed in
  // the returned paper's header and the WHOLE family comes off the draft record — the same registry
  // values the form was pre-filled with. The pre-printed fields lock; the staff keys in only what
  // the parent filled in by hand (Section II and the declaration).
  const [draftCode, setDraftCode] = useState("");
  const [draftFound, setDraftFound] = useState<FamilyDraft | null>(null);
  const [draftReturned, setDraftReturned] = useState<FamilyDraft | null>(null);
  const [draftMiss, setDraftMiss] = useState(false);
  const clearDraftLookup = () => {
    setDraftCode("");
    setDraftFound(null);
    setDraftReturned(null);
    setDraftMiss(false);
    setCheckedAgainst(false);
    setChildrenRows((rs) => (rs.some((r) => r.db) ? [blankChild()] : rs));
  };
  const pullDraft = () => {
    const found = draftByCode(fas.drafts, draftCode);
    setDraftMiss(false);
    setDraftReturned(null);
    setDraftFound(null);
    if (!found) {
      setDraftMiss(true);
      return;
    }
    if (found.status !== "draft") {
      setDraftReturned(found); // already keyed in once — nothing to enter again
      return;
    }
    setDraftFound(found);
    setChildrenRows(found.children.map((c) => ({ nric: c.nric, name: c.name, school: c.school, level: c.level, db: true })));
    setApplicant((v) => (v.trim() ? v : found.applicant));
    setContact(found.contact);
    setAddress(found.address);
    setEmail(found.email ?? "");
    // The two lookups are alternative entry paths — taking the draft clears the NRIC path.
    setLookupNric("");
    setLookedUp(null);
    setLookupMiss(false);
    setCheckedAgainst(false);
  };
  const lookupFamily = () => {
    const rec = guardianByNric(lookupNric);
    setLooking(true);
    setLookupMiss(false);
    setLookedUp(null);
    // Taking the NRIC path clears the draft path.
    setDraftCode("");
    setDraftFound(null);
    setDraftReturned(null);
    setDraftMiss(false);
    // Mock registry call: a short pause, then the family lands (or does not).
    window.setTimeout(() => {
      setLooking(false);
      if (!rec) {
        setLookupMiss(true);
        return;
      }
      setLookedUp(rec);
      const rows = rec.children.flatMap((name) => {
        const r = roster.find((x) => x.student.name === name);
        return r ? [{ nric: r.student.nric, name: r.student.name, school: r.school, level: r.student.level, db: true }] : [];
      });
      if (rows.length) setChildrenRows(rows);
      setApplicant((v) => (v.trim() ? v : rec.name));
      setContact((v) => (v.trim() ? v : rec.contact));
      setAddress((v) => (v.trim() ? v : rec.address));
      setEmail((v) => (v.trim() ? v : rec.email ?? ""));
    }, 500);
  };
  const clearLookup = () => {
    setLookupNric("");
    setLookedUp(null);
    setLookupMiss(false);
    setCheckedAgainst(false);
    // A cleared lookup releases the locked rows back to a blank, hand-keyed form.
    setChildrenRows((rs) => (rs.some((r) => r.db) ? [blankChild()] : rs));
  };

  // Issue-form tab (Sprint 3: print the form first, key in the returned copy): same registry, same
  // lookup — but the outcome is a PRINTED form for the parent plus a draft record, not an application.
  // The parent checks the pre-filled fields, declares the household (Section II) and signs (Section III).
  const [issueNric, setIssueNric] = useState("");
  const [issueLooking, setIssueLooking] = useState(false);
  const [issueFound, setIssueFound] = useState<GuardianRecord | null>(null);
  const [issueMiss, setIssueMiss] = useState(false);
  // The print popup was blocked — the draft is still recorded; "Print again" on the list recovers it.
  const [printMiss, setPrintMiss] = useState(false);
  const issueRows = useMemo(
    () => (issueFound ? issueFound.children.flatMap((name) => {
      const r = roster.find((x) => x.student.name === name);
      return r ? [r] : [];
    }) : []),
    [issueFound, roster],
  );
  const findForIssue = () => {
    const rec = guardianByNric(issueNric);
    setIssueLooking(true);
    setIssueFound(null);
    setIssueMiss(false);
    // Mock registry call: a short pause, then the family lands (or does not).
    window.setTimeout(() => {
      setIssueLooking(false);
      if (!rec) {
        setIssueMiss(true);
        return;
      }
      setIssueFound(rec);
    }, 500);
  };
  const issueForm = () => {
    if (!issueFound || !issueRows.length) return;
    // The draft record is mandatory (Sherly): printing the form and recording it are the same step,
    // so a form can never leave the school without the system remembering who holds it.
    const draft: FamilyDraft = {
      id: nextDraftId(fas.drafts),
      status: "draft",
      guardianNric: issueFound.nric,
      applicant: issueFound.name,
      contact: issueFound.contact,
      address: issueFound.address,
      email: issueFound.email,
      children: issueRows.map((r) => ({ studentId: r.student.id, name: r.student.name, nric: r.student.nric, school: r.school, level: r.student.level })),
      issuedAt: new Date().toISOString().slice(0, 10),
      issuedBy: by,
    };
    actions.issueDraft(draft);
    setPrintMiss(!openDraftPrint(draft, schoolName));
    setIssueFound(null);
    setIssueNric("");
  };

  // The returned-copy check (Sherly): when the family on the New form tab has an OPEN draft (a form
  // printed and still with the parent), the keyed-in entry must be cross-checked against it — both
  // came from the same registry record. A draft already marked "returned" belongs to an earlier
  // form; it is reported but re-issues nothing here.
  const draftOf = useMemo(
    () => (lookedUp ? fas.drafts.find((d) => d.status === "draft" && normNric(d.guardianNric) === normNric(lookedUp.nric)) ?? null : null),
    [lookedUp, fas.drafts],
  );
  const returnedOf = useMemo(
    () => (lookedUp ? fas.drafts.find((d) => d.status === "returned" && normNric(d.guardianNric) === normNric(lookedUp.nric)) ?? null : null),
    [lookedUp, fas.drafts],
  );

  const reset = () => {
    setChildrenRows([blankChild()]);
    setApplicant(""); setContact(""); setAddress(""); setEmail(""); setNote("");
    setExtraIncome(""); setResidents(""); setDeclared(false); setCheckedAgainst(false);
    setError(""); setSubmitMode("moe"); setReason(""); setReviewing(false);
    setLookupNric(""); setLookedUp(null); setLookupMiss(false); setLooking(false);
    setDraftCode(""); setDraftFound(null); setDraftReturned(null); setDraftMiss(false);
  };

  const setChildRow = (i: number, patch: Partial<ChildDraft>) =>
    setChildrenRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  // Sprint 3 parity with the online application: the two declared fields are recorded with the form,
  // but the band itself is never keyed — employment/trade income comes from HOMES (IRAS + CPF), a band
  // only. Mock: HOMES returns the SBFAS band, exactly like an online family submission.
  const bandFromForm = (): { band: Band; source: string } => ({
    band: BANDS[2],
    source: "retrieved from HOMES (IRAS + CPF) — the extra money and household size declared on the form are recorded with the application",
  });

  // Every gate the form must pass — shared by the entry to the review page and the final Submit there.
  const validate = (): string | null => {
    const rows = childrenRows.map((row, i) => ({ i, row, match: matchOf(row) })).filter((r) => rowFilled(r.row));
    const chosen = rows.flatMap((r) => (r.match ? [r.match] : []));
    const ids = chosen.map((r) => r.student.id);
    if (ids.length !== new Set(ids).size) return "The same child is listed twice — each child appears once on the form.";
    const unmatched = rows.find((r) => !r.match);
    if (unmatched) return `Row ${unmatched.i + 1} doesn't match a child in the registry — check the NRIC (BC/NRIC no.) and name against the form, or clear the row.`;
    // The returned copy must be cross-checked against the draft the form was issued as (mandatory —
    // both flows, MOE and the SBFAS queue): the staff member ticks the confirmation under the lookup.
    // Whichever way the draft was found — by its printed code, or by the family's NRIC.
    const checkRef = draftFound ?? draftOf;
    if ((draftFound || (lookedUp && draftOf)) && !checkedAgainst)
      return `Cross-check required: compare this entry against draft ${checkRef?.id} — the form issued to this family — and tick the confirmation under the family lookup.`;
    if (submitMode === "sbfas") {
      const eligible = chosen.filter((r) => rejectedIds.has(r.student.id));
      const notEligible = chosen.filter((r) => !rejectedIds.has(r.student.id));
      if (!eligible.length) return "A new SBFAS request needs a child on the form whose latest application was rejected — add them in Section I.";
      if (notEligible.length) return `${notEligible[0].student.name} cannot take a new SBFAS request — only a child whose latest application was rejected can. Submit to MOE instead, or clear that row.`;
      if (!reason.trim()) return "Say what changed since the rejected request.";
      return null;
    }
    // Section II: the two declared fields, validated exactly like the online application.
    if (!/^\d+(\.\d{1,2})?$/.test(extraIncome.trim()))
      return "Section II: enter the extra monthly money in dollars, or 0 if none.";
    const people = Number(residents.trim());
    if (!Number.isInteger(people) || people < 1 || people > 20)
      return "Section II: enter the number of people currently living in the home (a whole number from 1 to 20).";
    if (!chosen.length || !applicant.trim() || !contact.trim() || !address.trim() || !declared) {
      return "Complete Sections I–III: list at least one child, the contact and home address, and sign off the declaration with the parent/guardian name.";
    }
    const fresh = chosen.filter((r) => !r.blocked);
    if (!fresh.length) return "Every child on this form already holds an application or a MOEFAS grant — there is nothing new to submit (AC-031).";
    return null;
  };

  // The form freezes on a read-only page first; Submit only exists there.
  const startReview = () => {
    const err = validate();
    if (err) { setError(err); return; }
    setError("");
    setReviewing(true);
  };

  // Submit records the form and drops the staff member on the Applications list — the new record is
  // right there on top; the New form tab is back to a blank form for the next paper submission.
  const submit = () => {
    const err = validate();
    if (err) { setError(err); setReviewing(false); return; }
    setError("");
    setReviewing(false);
    const { band } = bandFromForm();
    const chosen = childrenRows.flatMap((row) => {
      const m = matchOf(row);
      return m && rowFilled(row) ? [m] : [];
    });
    // Flow 2: a separate request straight into this school's SBFAS queue — MOEFAS is not re-assessed.
    if (submitMode === "sbfas") {
      const eligible = chosen.filter((r) => rejectedIds.has(r.student.id));
      eligible.forEach((r) => actions.submitSbfasReapply({
        studentId: r.student.id, reason: reason.trim(), by,
        school: schoolName, applicant: applicant.trim(), contact: contact.trim(),
        guardianNric: draftFound?.guardianNric ?? lookedUp?.nric,
        draftId: draftFound?.id,
      }));
    } else {
      actions.submitHardcopy({
        studentIds: chosen.map((r) => r.student.id), band, school: schoolName, applicant: applicant.trim(), contact: contact.trim(), note,
        by, entryMode: "manual",
        address: address.trim(), email: email.trim() || undefined,
        extraIncome: Number(extraIncome) || 0,
        residents: Number(residents) || 0,
        declaredAt: declared ? new Date().toISOString().slice(0, 10) : undefined,
        guardianNric: draftFound?.guardianNric ?? lookedUp?.nric,
        draftId: draftFound?.id,
      });
    }
    reset();
    setView("apps");
  };

  return (
    <div className="space-y-4">
      <div role="group" aria-label="Hardcopy applications views" className="flex flex-wrap gap-2">
        {views.map(([k, label]) => (
          <Button key={k} size="sm" variant={view === k ? "primary" : "secondary"} aria-pressed={view === k} onClick={() => setView(k)}>
            {label}
          </Button>
        ))}
      </div>

      {view === "issue" && (
      <>
        <Card title="Issue a pre-filled MOE FAS form">
          <div className="space-y-3">
            <p className="text-[13px] text-on-surface-variant">
              Print the form first, key in the returned copy (Sprint 3 refinement): key in the parent/guardian NRIC, print the
              form the registry pre-fills, and hand it to the parent. The parent checks the pre-filled fields, declares the
              household income (Section II) and signs (Section III). When the signed form comes back, key it in on the{" "}
              <span className="font-semibold text-on-surface">New form</span> tab using the DRF no. printed in its header — the
              entry is checked against the draft recorded here.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <input
                className={`${inputClass} max-w-72`}
                aria-label="Parent or guardian NRIC (issue form)"
                placeholder="e.g. S1234567D"
                value={issueNric}
                onChange={(e) => setIssueNric(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && issueNric.trim() && !issueLooking) findForIssue(); }}
              />
              <Button size="sm" onClick={findForIssue} disabled={issueLooking || !issueNric.trim()}>
                {issueLooking ? "Searching…" : "Find the family"}
              </Button>
            </div>
            {issueFound && (
              <div className="space-y-2 rounded-control border border-line p-3">
                <p className="text-sm font-semibold text-on-surface">
                  {issueFound.name} <span className="font-normal text-on-surface-variant">({issueFound.relationship})</span>
                </p>
                <p className="text-[13px] text-on-surface-variant">
                  {issueFound.contact} · {issueFound.address}{issueFound.email ? ` · ${issueFound.email}` : ""}
                </p>
                <ul className="space-y-1.5">
                  {issueRows.map((r) => (
                    <li key={r.student.id} className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
                      <span className="font-medium text-on-surface">
                        {r.student.name} <span className="font-normal text-on-surface-variant">({r.student.level} · {r.school})</span>
                      </span>
                      <span className="flex items-center gap-1.5">
                        {r.mineSchool ? <Badge tone="primary">Your school</Badge> : <Badge tone="neutral">Other school</Badge>}
                        {r.blocked && <Badge tone="neutral">Already has an application</Badge>}
                      </span>
                    </li>
                  ))}
                </ul>
                {(() => {
                  const existing = fas.drafts.find((d) => d.status === "draft" && normNric(d.guardianNric) === normNric(issueFound.nric));
                  return existing ? (
                    <p className="text-[13px] text-on-surface-variant">
                      A form is already out with this family — {existing.id}, issued{" "}
                      {new Date(existing.issuedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} and still awaiting the signed copy.
                      Print it again from the register below, or issue a fresh copy if the first was lost.
                    </p>
                  ) : null;
                })()}
                <div className="flex justify-end">
                  <Button onClick={issueForm} disabled={!issueRows.length}>
                    <Printer size={16} weight="bold" aria-hidden="true" /> Generate &amp; print the pre-filled form
                  </Button>
                </div>
              </div>
            )}
            {issueMiss && (
              <p className="text-[13px] font-medium text-alert" role="alert">
                No family in the registry matches this NRIC — the parent fills a blank form by hand; key it in on the New form tab.
              </p>
            )}
            {printMiss && (
              <p className="text-[13px] font-medium text-alert" role="alert">
                The print window was blocked by the browser — the form is still recorded below; allow pop-ups and press
                &ldquo;Print again&rdquo; on its row.
              </p>
            )}
          </div>
        </Card>

        <Card title="Draft register — forms issued and awaiting return">
          {fas.drafts.length ? (
            <ul className="space-y-3">
              {fas.drafts.map((d) => (
                <li key={d.id} className="rounded-control border border-line px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold">{d.id} · {d.applicant}</p>
                      <p className="text-[13px] text-on-surface-variant">
                        Issued {new Date(d.issuedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} by {d.issuedBy}
                        {" "}· {d.children.length} {d.children.length > 1 ? "children" : "child"}
                        {d.status === "returned" && d.returnedAt
                          ? ` · returned ${new Date(d.returnedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`
                          : ""}
                      </p>
                    </div>
                    <span className="flex flex-wrap items-center gap-2">
                      {d.status === "draft"
                        ? <Badge tone="warning">Draft — awaiting return</Badge>
                        : <Badge tone="success">Returned — keyed in as {d.returnedAppId}</Badge>}
                      <Button size="sm" variant="secondary" onClick={() => { if (!openDraftPrint(d, schoolName)) setPrintMiss(true); }}>
                        <Printer size={16} weight="bold" aria-hidden="true" /> Print again
                      </Button>
                      {/* A returned draft is the audit trail of a live application — it cannot be voided. */}
                      {d.status === "draft" && (
                        <Button size="sm" variant="secondary" onClick={() => actions.voidDraft(d.id)}>
                          <X size={16} weight="bold" aria-hidden="true" /> Void
                        </Button>
                      )}
                    </span>
                  </div>
                  <ul className="mt-2 space-y-1.5">
                    {d.children.map((c) => (
                      <li key={c.studentId} className="text-[13px]">
                        <span className="font-medium text-on-surface">{c.name}</span>
                        <span className="text-on-surface-variant"> ({c.level} · {c.school})</span>
                      </li>
                    ))}
                  </ul>
                  {d.status === "draft" ? (
                    <p className="mt-2 text-[12px] text-on-surface-variant">
                      Waiting for the parent to check, declare and sign — the returned copy is keyed in on the New form tab and checked against this draft.
                    </p>
                  ) : (
                    <p className="mt-2 text-[12px] text-on-surface-variant">
                      The signed copy came back and was keyed in as {d.returnedAppId} — see the Applications tab for the outcome.
                    </p>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              title="No forms issued yet"
              hint="Look up a family above and print the pre-filled form — every printed form is recorded here as a draft, so the school always knows which children hold one."
            />
          )}
        </Card>
      </>
      )}

      {view === "new" && (
      <Card title="Submit a paper MOE FAS form">
        {reviewing ? (
        <div className="space-y-5">
          <div className="space-y-1 rounded-control border border-line bg-surface-container-low p-4">
            <p className="text-sm font-semibold text-on-surface">Check every field against the paper form</p>
            <p className="text-[13px] text-on-surface-variant">The fields are frozen on this page — go back to fix anything, then submit.</p>
          </div>
          <section className="space-y-2">
            <SectionTitle n="I" title="Particulars of the child" />
            <ul className="space-y-1.5">
              {childrenRows.map((row, i) => ({ row, i })).filter(({ row }) => rowFilled(row)).map(({ row, i }) => {
                const match = matchOf(row);
                return (
                  <li key={i} className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-medium text-on-surface">{i + 1}. {row.name || "—"}</span>
                    <span className="text-[13px] text-on-surface-variant">{row.nric || "—"} · {row.school || "—"} · {row.level || "—"}</span>
                    {row.db && <Badge tone="primary">From registry</Badge>}
                    {match && (match.mineSchool
                      ? <Badge tone="primary">Your school</Badge>
                      : <Badge tone="neutral">Other school</Badge>)}
                    {match?.blocked && <Badge tone="neutral">Already has an application</Badge>}
                  </li>
                );
              })}
            </ul>
            <p className="text-sm"><span className="text-on-surface-variant">Contact: </span><span className="font-medium">{contact.trim() || "—"}</span></p>
            <p className="text-sm"><span className="text-on-surface-variant">Home address: </span><span className="font-medium">{address.trim() || "—"}</span></p>
            <p className="text-sm"><span className="text-on-surface-variant">Email: </span><span className="font-medium">{email.trim() || "—"}</span></p>
            {(draftFound ?? draftOf) && (
              <p className="text-[13px] text-on-surface-variant">
                Returned copy of <span className="font-medium text-on-surface">{(draftFound ?? draftOf)!.id}</span>, issued{" "}
                {new Date((draftFound ?? draftOf)!.issuedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} — cross-checked against the draft.
              </p>
            )}
          </section>
          <section className="space-y-2 border-t border-line pt-4">
            <SectionTitle n="II" title="Household income" />
            <p className="text-sm">
              <span className="text-on-surface-variant">Extra monthly money (not in HOMES): </span>
              <span className="font-medium">S${extraIncome.trim() || "—"}</span>
            </p>
            <p className="text-sm">
              <span className="text-on-surface-variant">People currently living in the home: </span>
              <span className="font-medium">{residents.trim() || "—"}</span>
            </p>
            <p className="text-sm">
              <span className="text-on-surface-variant">Income band: </span>
              <span className="font-medium">{bandFromForm().band.label}</span>
              <span className="text-[13px] text-on-surface-variant"> — {bandFromForm().source}</span>
            </p>
          </section>
          <section className="space-y-2 border-t border-line pt-4">
            <SectionTitle n="III" title="Declaration and agreement by the applicant" />
            <p className="text-sm font-medium">{declared ? `Signed and dated by ${applicant.trim() || "the applicant"}` : "Not confirmed"}</p>
            {note.trim() && <p className="text-[13px] text-on-surface-variant">Note on the form: {note.trim()}</p>}
          </section>
          <section className="space-y-2 border-t border-line pt-4">
            <SectionTitle n="IV" title="Where this form goes" />
            <p className="text-sm font-medium">{submitMode === "moe" ? "To MOE for assessment — the first application" : "To this school's SBFAS review queue — a separate request"}</p>
            {submitMode === "sbfas" && reason.trim() && <p className="text-[13px] text-on-surface-variant">What changed: {reason.trim()}</p>}
          </section>
          {error && <p className="text-[13px] font-medium text-alert" role="alert">{error}</p>}
          <div className="flex justify-between gap-3">
            <Button variant="secondary" onClick={() => setReviewing(false)}>Back to edit</Button>
            <Button onClick={() => setConfirming(true)}>Submit</Button>
          </div>
        </div>
        ) : (
        <div className="space-y-5">
          {/* Sprint 3 — the returned form comes back with its own DRF no. printed in the header: keying
              that code in pulls the family off the draft and locks the pre-printed fields. The NRIC
              lookup below stays for forms the system never printed (hand-written). */}
          <section className="space-y-2 rounded-control border border-line bg-surface-container-low p-3">
            <p className="text-sm font-semibold text-on-surface">The returned form — enter its draft no.</p>
            <p className="text-[13px] text-on-surface-variant">
              Every printed form carries its DRF no. in the header. Pulling the draft fills the family and locks the pre-printed fields — you key in only what the parent filled in by hand: the Section II household declarations and the Section III signature.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <input
                className={`${inputClass} max-w-72`}
                aria-label="Draft no. printed on the returned form"
                placeholder="e.g. DRF-0001"
                value={draftCode}
                onChange={(e) => setDraftCode(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && draftCode.trim()) pullDraft(); }}
              />
              <Button size="sm" onClick={pullDraft} disabled={!draftCode.trim()}>
                Pull the form
              </Button>
              {draftFound && (
                <Button size="sm" variant="secondary" onClick={clearDraftLookup}>
                  Clear draft
                </Button>
              )}
            </div>
            {draftFound && (
              <p className="text-[13px] font-medium text-success" role="status">
                {draftFound.id} · {draftFound.applicant} — {draftFound.children.length}{" "}
                {draftFound.children.length > 1 ? "children" : "child"} pulled from the issued form. Section I and the contact details are locked (the printed form told the parent not to amend them); fill in Sections II–III from the signed paper.
              </p>
            )}
            {draftReturned && (
              <p className="text-[13px] text-on-surface-variant">
                {draftReturned.id} already came back — keyed in as {draftReturned.returnedAppId}. A form handed out again is a fresh issue on the Issue form tab.
              </p>
            )}
            {draftMiss && (
              <p className="text-[13px] font-medium text-alert" role="alert">
                No draft matches this code — check the DRF no. printed in the form header, or look the family up by NRIC below.
              </p>
            )}
            <div className="mt-3 space-y-2 border-t border-line pt-3">
              <p className="text-[13px] font-semibold text-on-surface">No printed form? Family lookup — parent / guardian NRIC</p>
              <p className="text-[13px] text-on-surface-variant">
                Take the NRIC from the paper form&apos;s declaration. The applicant, contact, address and every child come from the shared MOE registry — the child rows below arrive filled and locked (not editable). Nothing matches? Type the children in by hand in Section I.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  className={`${inputClass} max-w-72`}
                  aria-label="Parent or guardian NRIC"
                  placeholder="e.g. S1234567D"
                  value={lookupNric}
                  onChange={(e) => setLookupNric(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && lookupNric.trim() && !looking) lookupFamily(); }}
                />
                <Button size="sm" onClick={lookupFamily} disabled={looking || !lookupNric.trim()}>
                  {looking ? "Searching…" : "Look up family"}
                </Button>
                {lookedUp && (
                  <Button size="sm" variant="secondary" onClick={clearLookup}>
                    Clear lookup
                  </Button>
                )}
              </div>
              {lookedUp && (
                <p className="text-[13px] font-medium text-success" role="status">
                  {lookedUp.name} ({lookedUp.relationship}) — {lookedUp.children.length}{" "}
                  {lookedUp.children.length > 1 ? "children" : "child"} pulled from the registry. The rows in Section I are locked; if the paper form disagrees, the form was filled in wrongly.
                </p>
              )}
              {lookupMiss && (
                <p className="text-[13px] font-medium text-alert" role="alert">
                  No family in the registry matches this NRIC — key the children in by hand in Section I below.
                </p>
              )}
            </div>
            {(() => {
              // The cross-check reference: the draft pulled by its printed code, else the family's
              // open draft found through the NRIC lookup.
              const ref = draftFound ?? draftOf;
              if (!ref) return null;
              return (
                <div className="rounded-control border border-line bg-surface-container-low px-3 py-2 text-[13px]">
                  <p className="font-semibold text-on-surface">Check against the issued form — required before submitting</p>
                  <p className="text-on-surface-variant">
                    {ref.id} was printed for this family on{" "}
                    {new Date(ref.issuedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} by {ref.issuedBy}.
                    This entry is the returned copy — the child rows above came from the same registry record as the printed form; compare the parent&apos;s Section II declarations against the signed form before submitting.
                  </p>
                  <label className="mt-2 flex items-start gap-2.5">
                    <input type="checkbox" className="mt-0.5 size-4 accent-[#8A2538]" checked={checkedAgainst} onChange={(e) => setCheckedAgainst(e.target.checked)} />
                    <span>
                      I have compared this entry with the signed form and draft {ref.id} — the children match and Section II is as the parent declared.{" "}
                      <span className="text-alert" aria-hidden>*</span>
                    </span>
                  </label>
                </div>
              );
            })()}
            {lookedUp && !draftOf && !draftFound && (returnedOf ? (
              <p className="text-[13px] text-on-surface-variant">
                The form issued to this family ({returnedOf.id}) already came back — keyed in as {returnedOf.returnedAppId}. A new form would be a fresh issue on the Issue form tab.
              </p>
            ) : (
              <p className="text-[13px] text-on-surface-variant">
                No pre-filled form was issued for this family through the system — the parent may have written the form by hand.
              </p>
            ))}
          </section>
          <section className="space-y-3">
            <SectionTitle n="I" title="Particulars of the child" />
            <Field label="Children on the form" required>
              <div className="space-y-2 rounded-control border border-line p-3">
                <div className="hidden gap-2 sm:grid sm:grid-cols-[auto_1fr_1.3fr_1.3fr_0.6fr_auto]">
                  <span className="w-4" />
                  <span className="text-[12px] font-semibold leading-tight text-on-surface-variant">BC/NRIC No.</span>
                  <span className="text-[12px] font-semibold leading-tight text-on-surface-variant">Name (Underline Surname)</span>
                  <span className="text-[12px] font-semibold leading-tight text-on-surface-variant">Name of Current School</span>
                  <span className="text-[12px] font-semibold leading-tight text-on-surface-variant">Current Level</span>
                  <span />
                </div>
                {childrenRows.map((row, i) => {
                  const match = matchOf(row);
                  // A registry row (family lookup) is locked: editing it would be editing the student
                  // record, which this form must not do. Hand-keyed and OCR rows stay fully editable.
                  const locked = !!row.db;
                  return (
                    <div key={i} className="space-y-1.5 rounded-control border border-line px-3 py-2.5">
                      <div className="grid gap-2 sm:grid-cols-[auto_1fr_1.3fr_1.3fr_0.6fr_auto]">
                        <span className="flex min-h-11 items-center text-[13px] text-on-surface-variant" aria-hidden="true">{i + 1}</span>
                        <input className={`${inputClass} ${locked ? "bg-surface-container-low" : ""}`} aria-label={`Child ${i + 1} BC/NRIC no.`} aria-readonly={locked} placeholder="BC/NRIC no." value={row.nric} disabled={locked} onChange={(e) => setChildRow(i, { nric: e.target.value })} />
                        <input className={`${inputClass} ${locked ? "bg-surface-container-low" : ""}`} aria-label={`Child ${i + 1} name`} aria-readonly={locked} placeholder="Name" value={row.name} disabled={locked} onChange={(e) => setChildRow(i, { name: e.target.value })} />
                        <input
                          className={`${inputClass} ${locked ? "bg-surface-container-low" : ""}`}
                          aria-label={`Child ${i + 1} name of current school`}
                          aria-readonly={locked}
                          placeholder="Name of current school"
                          value={row.school}
                          disabled={locked}
                          onChange={(e) => setChildRow(i, { school: e.target.value })}
                        />
                        <input className={`${inputClass} ${locked ? "bg-surface-container-low" : ""}`} aria-label={`Child ${i + 1} current level`} aria-readonly={locked} placeholder="Level" value={row.level} disabled={locked} onChange={(e) => setChildRow(i, { level: e.target.value })} />
                        <Button
                          size="sm"
                          variant="secondary"
                          aria-label={`Remove child ${i + 1}`}
                          className="self-center"
                          onClick={() => setChildrenRows((rs) => rs.filter((_, j) => j !== i))}
                          disabled={locked || childrenRows.length === 1}
                        >
                          <X size={16} weight="bold" aria-hidden="true" />
                        </Button>
                      </div>
                      <div className="flex min-h-6 flex-wrap items-center gap-2 text-[13px] text-on-surface-variant">
                        {locked && <Badge tone="primary">From registry — locked</Badge>}
                        {match ? (
                          <>
                            {match.mineSchool
                              ? <Badge tone="primary">Your school</Badge>
                              : <Badge tone="neutral">Other school</Badge>}
                            {match.blocked && <Badge tone="neutral">Already has an application</Badge>}
                          </>
                        ) : rowFilled(row) ? (
                          <span className="font-medium text-alert">No child matches this row.</span>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Button size="sm" variant="secondary" onClick={() => setChildrenRows((rs) => [...rs, blankChild()])}>
                    <Plus size={16} weight="bold" aria-hidden="true" /> Add child
                  </Button>
                </div>
              </div>
            </Field>
            {/* From a pulled draft these are the values the form was PRINTED with — the parent was told
                not to amend them, so they lock like the registry rows above. */}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Contact number" required>
                <input
                  className={`${inputClass} ${draftFound ? "bg-surface-container-low" : ""}`}
                  value={contact}
                  aria-readonly={!!draftFound}
                  disabled={!!draftFound}
                  onChange={(e) => setContact(e.target.value)}
                  placeholder="+65 …"
                />
              </Field>
              <Field label="Email address">
                <input className={`${inputClass} ${draftFound ? "bg-surface-container-low" : ""}`} value={email} aria-readonly={!!draftFound} disabled={!!draftFound} onChange={(e) => setEmail(e.target.value)} placeholder="optional" />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Home address" required>
                <input className={`${inputClass} ${draftFound ? "bg-surface-container-low" : ""}`} value={address} aria-readonly={!!draftFound} disabled={!!draftFound} onChange={(e) => setAddress(e.target.value)} placeholder="Blk / street / postal code" />
              </Field>
            </div>
          </section>

          <section className="space-y-3 border-t border-line pt-4">
            <SectionTitle n="II" title="Household income" note="As declared on the paper form — the same two fields as the online application." />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field required label="Extra monthly money (S$)" hint="Income not in HOMES, e.g. rental, allowance or family support. Enter 0 if none.">
                <input
                  className={inputClass}
                  aria-label="Extra monthly money"
                  placeholder="e.g. 0"
                  inputMode="decimal"
                  value={extraIncome}
                  onChange={(e) => setExtraIncome(e.target.value)}
                />
              </Field>
              <Field required label="People currently living in your home" hint="Everyone who lives with you now, including you.">
                <input
                  className={inputClass}
                  aria-label="People currently living in the home"
                  type="number"
                  min={1}
                  max={20}
                  step={1}
                  inputMode="numeric"
                  value={residents}
                  onChange={(e) => setResidents(e.target.value)}
                />
              </Field>
            </div>
            <p className="text-[13px] text-on-surface-variant">
              The income band itself is retrieved from HOMES (IRAS + CPF) — a band only, never an exact income, exactly like an online application.
            </p>
          </section>

          <section className="space-y-3 border-t border-line pt-4">
            <SectionTitle n="III" title="Declaration and agreement by the applicant" />
            <ul className="list-disc space-y-1 pl-5 text-sm text-on-surface-variant">
              <li>No child on this form receives financial assistance from more than one MOE-funded school or institution.</li>
              <li>The applicant authorises monthly withdrawals from the child&apos;s Edusave account for school fees and approved expenses while on MOE FAS.</li>
              <li>MOE and the schools may verify the information, reassess the household, and share the data needed to administer the scheme.</li>
              <li>The information given is true — false information is an offence under Section 182 of the Penal Code 1871.</li>
            </ul>
            {/* The paper form collects the parent/guardian name only here — at the declaration the applicant signs. */}
            <Field label="Parent / guardian name (as signed on the declaration)" required>
              <input className={inputClass} value={applicant} onChange={(e) => setApplicant(e.target.value)} placeholder="Name as written on the form" />
            </Field>
            <label className="flex items-start gap-2.5 rounded-control border border-line px-3 py-2 text-sm">
              <input type="checkbox" className="mt-0.5 size-4 accent-[#8A2538]" checked={declared} onChange={(e) => setDeclared(e.target.checked)} />
              <span>
                The declaration is signed and dated on the paper form by <span className="font-semibold">{applicant.trim() || "the applicant"}</span>
              </span>
            </label>
            <Field label="Anything else on the form (optional)">
              <textarea rows={2} className={`${inputClass} py-2`} value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
          </section>

          <section className="space-y-3 border-t border-line pt-4">
            <SectionTitle n="IV" title="Where this form goes" />
            <div role="radiogroup" aria-label="Where this form goes" className="space-y-1.5">
              <label className="flex items-start gap-2.5 rounded-control border border-line px-3 py-2 text-sm cursor-pointer hover:bg-surface-container-low">
                <input type="radio" name="submit-to" className="mt-0.5 size-4 accent-[#8A2538]" checked={submitMode === "moe"} onChange={() => setSubmitMode("moe")} />
                <span>Submit to MOE for assessment — the first application (MOEFAS is assessed first)</span>
              </label>
              <label className="flex items-start gap-2.5 rounded-control border border-line px-3 py-2 text-sm cursor-pointer hover:bg-surface-container-low">
                <input type="radio" name="submit-to" className="mt-0.5 size-4 accent-[#8A2538]" checked={submitMode === "sbfas"} onChange={() => setSubmitMode("sbfas")} />
                <span>Submit to this school&apos;s SBFAS review queue — a separate request after a rejection</span>
              </label>
            </div>
            {submitMode === "sbfas" && (
              <>
                {reLast && (
                  <div className="rounded-control border border-line bg-surface-container-low p-3 text-[13px] text-on-surface-variant">
                    <p>
                      Previous request <span className="font-semibold text-on-surface">{reLast.id}</span> · rejected
                      {reLast.decidedAt ? ` on ${new Date(reLast.decidedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}` : ""}
                      {" "}· income band {reLast.incomeBand} · attempt {attemptOf(reLast)}
                    </p>
                    {reLast.justification && <p className="mt-1">&ldquo;{reLast.justification}&rdquo; — the school&apos;s reason at the time.</p>}
                    <p className="mt-1">The new request will be attempt {attemptOf(reLast) + 1} and keeps the same income band.</p>
                  </div>
                )}
                <Field label="What changed since the rejected request" required>
                  <textarea rows={2} className={`${inputClass} py-2`} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. a parent stopped working in August" />
                </Field>
              </>
            )}
          </section>

          {error && <p className="text-[13px] font-medium text-alert" role="alert">{error}</p>}
          <div className="flex justify-end">
            <Button onClick={startReview}>Review the form</Button>
          </div>
        </div>
        )}
      </Card>
      )}

      {view === "apps" && (
      <>
        <Card title={`Paper applications at ${schoolName}`}>
          {paperApps.length ? (
            <ul className="space-y-3">
              {paperApps.map((fa) => <PaperRow key={fa.id} fa={fa} apps={fas.apps} schoolOf={schoolOfLevelName} onOpen={() => navigate(`/admin/fas/hardcopy/${fa.id}`)} />)}
            </ul>
          ) : (
            <EmptyState title="No paper applications yet" hint="Scan or enter a paper MOE FAS form on the New form tab to see it here with the child's outcome." />
          )}
        </Card>
      </>
      )}

      <Modal
        open={confirming}
        onClose={() => setConfirming(false)}
        title="Submit this application?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirming(false)}>Cancel</Button>
            <Button onClick={() => { setConfirming(false); submit(); }}>Submit</Button>
          </>
        }
      >
        <p className="text-sm text-on-surface">
          One application for {childrenRows.filter(rowFilled).map((r) => r.name.trim() || "—").join(", ")} — it goes{" "}
          {submitMode === "moe"
            ? "to MOE for assessment: MOEFAS is decided instantly, and children outside the bands are referred to their school's SBFAS review queue."
            : "straight to this school's SBFAS review queue as a separate request after a rejection."}
        </p>
        <p className="mt-2 text-[13px] text-on-surface-variant">
          The submitted form becomes read-only, and the outcome is sent to the parent by SMS/email automatically once decided.
        </p>
      </Modal>
    </div>
  );
}

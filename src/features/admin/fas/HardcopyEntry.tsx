import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { CaretRight, FilePdf, Plus, UploadSimple, X } from "@phosphor-icons/react";
import { Badge, type BadgeTone } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { EmptyState } from "../../../components/ui/EmptyState";
import { Modal } from "../../../components/ui/Modal";
import { Field, inputClass } from "../../../components/ui/Field";
import { childOutcomeNow, outcomeNote, type ChildOutcomeNow, type FamilyApplication, type FamilyChild, type TransportMode } from "../../../data/familyApplications";
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
// children in by hand, as before. Both hardcopy flows share one entry form: (1) the FIRST form —
// looked up, scanned (OCR pre-fills the fields, the staff member checks them) or typed by hand —
// goes to MOE and runs the SAME assessment as an online one: MOEFAS first, then the SBFAS queue on
// referral. Like the paper form, Section I lists every child the form names — rows are added and
// removed to match it, keyed with the form's own columns, and the NRIC is matched against the
// registry — this school's children are tagged "Your school", a child at another school shows their
// school, and their own school receives any SBFAS referral. (2) after that application is rejected
// at SBFAS, the parent hands in a SEPARATE new request — at the submit step the form goes straight
// to the school's SBFAS queue as attempt 2, 3, ... The Applications tab keeps history.
//
// The entry form follows the six sections of the real MOE FAS application form (Sep 2025):
// I Child particulars · II Other household members · III Benefits · IV Transport · V IMDA device · VI Declaration.
// Section VII is the school's own step (not on the paper form): where the form goes — MOE or straight
// to the SBFAS queue — and the staff member's confirmation that every field was checked.

/** Mock OCR: what the scanner "read" off two sample paper forms. Every cell stays editable because
 *  the OCR can misread — the staff member checks them all on the review page before submitting.
 *  The Chua form lands in the SBFAS referral band; the Pereira form sits inside the MOEFAS bands,
 *  so MOE grants Tier 1 the moment it is submitted. */
type OcrForm = {
  file: string;
  applicant: string;
  contact: string;
  address: string;
  email: string;
  transportMode: TransportMode;
  note: string;
  imdaHardcopy: "yes" | "no";
  children: ChildDraft[];
  members: MemberDraft[];
};
const OCR_FORMS: Record<"sbfas" | "moefas", OcrForm> = {
  sbfas: {
    file: "MOE-FAS-form-chua-signed.pdf",
    applicant: "Benson Chua",
    contact: "+65 8112 9743",
    address: "Blk 315 Ang Mo Kio Ave 3, #07-221, Singapore 560315",
    email: "benson.chua@example.com",
    transportMode: "Public transport",
    note: "Second child entering Sec 1 next year; household income dropped after May.",
    imdaHardcopy: "yes", // the demo form asked for a hard copy of the IMDA application form
    // Section I rows the scanner read off the form's child table: one child at this school, one at
    // another. Child 2's school came back smudged ("Greenfield Secondary Schoo").
    children: [
      { nric: "T1504644E", name: "Ethan Lim Jun Hao", school: "Riverbank Primary School", level: "P5" },
      { nric: "T1203822J", name: "Chloe Lim Wen Xin", school: "Greenfield Secondary Schoo", level: "Sec 2" },
    ],
    // Section II rows the scanner read off the form (this household declared other administrative income).
    // They pre-fill the table and the staff member can fix every cell — the OCR can misread.
    members: [
      { name: "Benson Chua", nric: "S1234567D", relationship: "Father", age: "44", occupation: "Employed", gross: "2600", other: "0" },
      { name: "Jenny Chua", nric: "S9876543B", relationship: "Mother", age: "41", occupation: "Self-employed", gross: "1900", other: "120" },
    ],
  },
  moefas: {
    file: "MOE-FAS-form-seah-signed.pdf",
    applicant: "Catherine Seah",
    contact: "+65 9722 4085",
    address: "Blk 418 Jurong West St 42, #11-107, Singapore 650418",
    email: "catherine.seah@example.com",
    transportMode: "Public transport",
    note: "Father passed away in June; the mother runs a hawker stall and also declared dividend income.",
    imdaHardcopy: "no",
    // One child, at this school — the declared income sits inside the MOEFAS bands, so this form is
    // granted the moment it is submitted and never reaches the SBFAS queue.
    children: [
      { nric: "T1003548H", name: "Bernice Seah Xin Rong", school: "Greenfield Secondary School", level: "Sec 4" },
    ],
    // GHI S$1,390 ÷ 2 in the household = S$695 per person — "Up to $750 per person" → MOEFAS Tier 1.
    members: [
      { name: "Catherine Seah", nric: "S6908141C", relationship: "Mother", age: "41", occupation: "Self-employed", gross: "1300", other: "90" },
    ],
  },
};

const TRANSPORT_MODES: { mode: TransportMode; note: string; primaryOnly?: boolean }[] = [
  { mode: "Public transport", note: "S$21 per month transport subsidy" },
  { mode: "School bus", note: "70% of the monthly fare — primary level only", primaryOnly: true },
  { mode: "Own transport or walks", note: "No transport subsidy" },
];
/** Mock rendering of the scanned form for the click-to-view dialog. */
export const formDocImage = (file: string, applicant: string) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="700" height="760"><rect width="700" height="760" fill="#faf8f6"/><rect x="40" y="35" width="620" height="690" rx="6" fill="white" stroke="#e4dddd"/><text x="75" y="100" font-family="Arial" font-size="24" fill="#8a2538">Scanned MOE FAS form · SAMPLE</text><text x="75" y="155" font-family="Arial" font-size="15">File: ${file}</text><text x="75" y="200" font-family="Arial" font-size="17">Applicant: ${applicant || "—"}</text><text x="75" y="260" font-family="Arial" font-size="16">Sections I–VI as filled in by the parent</text><text x="75" y="310" font-family="Arial" font-size="14">Mock scan rendering — the OCR pre-filled the entry fields from it.</text><text x="75" y="340" font-family="Arial" font-size="14">Verify every field against this scan before submitting.</text></svg>`;
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
};
const OCCUPATIONS = ["Employed", "Self-employed", "Student", "Unemployed"] as const;
/** One Section II row as the staff types it (strings straight from the inputs). */
type MemberDraft = { name: string; nric: string; relationship: string; age: string; occupation: string; gross: string; other: string };
const blankMember = (): MemberDraft => ({ name: "", nric: "", relationship: "", age: "", occupation: "Employed", gross: "", other: "" });
/** One Section I row as the staff types it — the paper form's child table columns, keyed as on the form.
 *  `db` marks a row the family lookup pulled from the registry: every field on it is locked. */
type ChildDraft = { nric: string; name: string; school: string; level: string; db?: boolean };
const blankChild = (): ChildDraft => ({ nric: "", name: "", school: "", level: "" });

/** Tone for the live per-child outcome (childOutcomeNow): follows the school's SBFAS decision. */
const LIVE_TONE: Record<ChildOutcomeNow["kind"], BadgeTone> = { granted: "success", pending: "warning", rejected: "alert", neutral: "neutral" };

/** Section VII's one-line MOE verdict for a flow-1 form: the assessment ran at submission and is
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
                {/* Single live badge; MOE's instant verdict is told once, in Section VII of the detail page. */}
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
        <SectionTitle n="II" title="Information on other household members" />
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
      {fa.transportMode && (
        <section className="space-y-2 border-t border-line pt-4">
          <SectionTitle n="IV" title="Mode of transport between home and school" />
          <p className="text-sm font-medium">{fa.transportMode}</p>
        </section>
      )}
      {fa.imdaHardcopy && (
        <section className="space-y-2 border-t border-line pt-4">
          <SectionTitle n="V" title="Subsidised broadband and/or laptop/tablet" />
          <p className="text-sm"><span className="text-on-surface-variant">Hard copy of the DigitalAccess@Home form: </span><span className="font-medium">{fa.imdaHardcopy === "yes" ? "Yes" : "No"}</span></p>
        </section>
      )}
      <section className="space-y-2 border-t border-line pt-4">
        <SectionTitle n="VI" title="Declaration and agreement by the applicant" />
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
        <SectionTitle n="VII" title="Where this form goes" />
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

  // One paper form at a time: the staff member works through a single form, scanning it or typing it in.
  const [scanned, setScanned] = useState(false);
  const [scanning, setScanning] = useState(false);
  // Section I mirrors the paper form's child table: however many children the form lists, that many
  // rows — the staff adds/removes rows to match it and keys each by hand (or the scan pre-fills them)
  // with the form's own columns — NRIC, name, current school, level. The NRIC is matched against the
  // registry; children already holding an application stay on the form too (the store keeps one
  // application per child, AC-031).
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
  // Section II: HOMES-only by default; the household table opens only when administrative income is declared.
  const [adminIncome, setAdminIncome] = useState(false);
  const [homesOnly, setHomesOnly] = useState(false);
  // The uploaded form PDF itself (demo): the OCR read the fields off it — click the chip to view it,
  // remove it to start over with another file.
  const [formFile, setFormFile] = useState<string | null>(null);
  const [formView, setFormView] = useState(false);
  const [members, setMembers] = useState<MemberDraft[]>([blankMember()]);
  // Section IV & VI, plus Section V's hard-copy request.
  const [transportMode, setTransportMode] = useState<TransportMode | "">("");
  const [imdaCopy, setImdaCopy] = useState<"" | "yes" | "no">("");
  const [declared, setDeclared] = useState(false);
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
  type View = "new" | "apps";
  // Returning from a paper-application page reopens the list the staff member came from.
  const initialView = (useLocation().state as { hardcopyView?: View } | null)?.hardcopyView;
  const [view, setView] = useState<View>(initialView ?? "new");
  const views: [View, string][] = [
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
  const lookupFamily = () => {
    const rec = guardianByNric(lookupNric);
    setLooking(true);
    setLookupMiss(false);
    setLookedUp(null);
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
    // A cleared lookup releases the locked rows back to a blank, hand-keyed form.
    setChildrenRows((rs) => (rs.some((r) => r.db) ? [blankChild()] : rs));
  };

  const scan = (demo: OcrForm) => {
    setScanning(true);
    setError("");
    // Mock OCR: a short "reading the form" pause, then the fields pre-fill for verification.
    window.setTimeout(() => {
      setScanned(true);
      setScanning(false);
      setFormFile(demo.file);
      setApplicant(demo.applicant);
      setContact(demo.contact);
      setAddress(demo.address);
      setEmail(demo.email);
      setNote(demo.note);
      setTransportMode(demo.transportMode);
      setImdaCopy(demo.imdaHardcopy);
      setDeclared(true); // the declaration box is ticked on the paper form
      // The form declared other administrative income, so the scanner read the Section II rows too —
      // they pre-fill the table and every cell stays editable (the staff member checks the OCR reading).
      setAdminIncome(true);
      setHomesOnly(false);
      setMembers(demo.members.map((m) => ({ ...m })));
      // The scanner read the form's child table — the rows pre-fill and stay editable.
      setChildrenRows((rows) => (rows.some(rowFilled) ? rows : demo.children.map((c) => ({ ...c }))));
    }, 1200);
  };

  const reset = () => {
    setScanned(false); setChildrenRows([blankChild()]);
    setApplicant(""); setContact(""); setAddress(""); setEmail(""); setNote("");
    setAdminIncome(false); setHomesOnly(false);
    setMembers([blankMember()]); setTransportMode(""); setImdaCopy(""); setDeclared(false);
    setError(""); setSubmitMode("moe"); setReason(""); setReviewing(false);
    setFormFile(null); setFormView(false);
    setLookupNric(""); setLookedUp(null); setLookupMiss(false); setLooking(false);
  };

  const setChildRow = (i: number, patch: Partial<ChildDraft>) =>
    setChildrenRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const setMember = (i: number, patch: Partial<MemberDraft>) =>
    setMembers((ms) => ms.map((m, j) => (j === i ? { ...m, ...patch } : m)));

  // The form itself carries no band: for employment/trade income MOE retrieves it from HOMES
  // (IRAS + CPF); when other administrative income is declared, it is computed from the Section II
  // table (GHI ÷ household members = per-capita income). Both are mocked here.
  const bandFromForm = (): { band: Band; source: string } => {
    if (adminIncome) {
      const named = members.filter((m) => m.name.trim());
      if (named.length) {
        const ghi = named.reduce((t, m) => t + (Number(m.gross) || 0) + (Number(m.other) || 0), 0);
        const size = named.length + childrenRows.filter((row) => matchOf(row)).length; // declared members + the children matched on the form
        const pci = ghi / Math.max(1, size);
        const band = pci <= 750 ? BANDS[0] : pci <= 1000 ? BANDS[1] : pci <= 1500 ? BANDS[2] : BANDS[3];
        return { band, source: `declared in Section II — GHI S$${ghi.toLocaleString("en-SG")} ÷ ${size} in the household = S$${Math.round(pci).toLocaleString("en-SG")} per person` };
      }
    }
    return { band: BANDS[2], source: "retrieved from HOMES (IRAS + CPF) — employment/trade income only" };
  };

  // Every gate the form must pass — shared by the entry to the review page and the final Submit there.
  const validate = (): string | null => {
    const rows = childrenRows.map((row, i) => ({ i, row, match: matchOf(row) })).filter((r) => rowFilled(r.row));
    const chosen = rows.flatMap((r) => (r.match ? [r.match] : []));
    const ids = chosen.map((r) => r.student.id);
    if (ids.length !== new Set(ids).size) return "The same child is listed twice — each child appears once on the form.";
    const unmatched = rows.find((r) => !r.match);
    if (unmatched) return `Row ${unmatched.i + 1} doesn't match a child in the registry — check the NRIC (BC/NRIC no.) and name against the form, or clear the row.`;
    if (submitMode === "sbfas") {
      const eligible = chosen.filter((r) => rejectedIds.has(r.student.id));
      const notEligible = chosen.filter((r) => !rejectedIds.has(r.student.id));
      if (!eligible.length) return "A new SBFAS request needs a child on the form whose latest application was rejected — add them in Section I.";
      if (notEligible.length) return `${notEligible[0].student.name} cannot take a new SBFAS request — only a child whose latest application was rejected can. Submit to MOE instead, or clear that row.`;
      if (!reason.trim()) return "Say what changed since the rejected request.";
      return null;
    }
    if (!chosen.length || !applicant.trim() || !contact.trim() || !address.trim() || !declared) {
      return "Complete Sections I and VI: list at least one child, the contact and home address, and sign off the declaration with the parent/guardian name.";
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
        entryMode: scanned ? "ocr" : "manual",
      }));
    } else {
      actions.submitHardcopy({
        studentIds: chosen.map((r) => r.student.id), band, school: schoolName, applicant: applicant.trim(), contact: contact.trim(), note,
        by, entryMode: scanned ? "ocr" : "manual",
        address: address.trim(), email: email.trim() || undefined, transportMode: transportMode || undefined,
        hasAdminIncome: adminIncome,
        household: adminIncome ? members.filter((m) => m.name.trim()).map((m) => ({
          name: m.name.trim(), nric: m.nric.trim() || undefined, relationship: m.relationship.trim(), age: Number(m.age) || 0, occupation: m.occupation,
          gross: Number(m.gross) || 0, other: Number(m.other) || 0,
        })) : undefined,
        homesOnly: homesOnly || undefined,
        imdaHardcopy: imdaCopy || undefined,
        declaredAt: declared ? new Date().toISOString().slice(0, 10) : undefined,
        formFile: scanned ? formFile ?? undefined : undefined,
      });
    }
    reset();
    setView("apps");
  };

  // School bus is a primary-level subsidy and follows THIS school's children on the form — a
  // primary-level child at another school does not unlock it here (their own school handles them).
  const schoolBusAllowed = childrenRows.some((row) => {
    const m = matchOf(row);
    return !!m?.mineSchool && m.student.level.startsWith("P");
  });
  const totalGhi = members.reduce((t, m) => t + (Number(m.gross) || 0) + (Number(m.other) || 0), 0);

  return (
    <div className="space-y-4">
      <div role="group" aria-label="Hardcopy applications views" className="flex flex-wrap gap-2">
        {views.map(([k, label]) => (
          <Button key={k} size="sm" variant={view === k ? "primary" : "secondary"} aria-pressed={view === k} onClick={() => setView(k)}>
            {label}
          </Button>
        ))}
      </div>

      {view === "new" && (
      <Card
        title="Submit a paper MOE FAS form"
        action={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button size="sm" variant="secondary" onClick={() => scan(OCR_FORMS.sbfas)} disabled={scanning || reviewing}><UploadSimple size={16} weight="bold" aria-hidden="true" />{scanning ? "Reading the PDF…" : "Upload form PDF · SBFAS band (demo OCR)"}</Button>
            <Button size="sm" variant="secondary" onClick={() => scan(OCR_FORMS.moefas)} disabled={scanning || reviewing}><UploadSimple size={16} weight="bold" aria-hidden="true" />{scanning ? "Reading the PDF…" : "Upload form PDF · MOEFAS band (demo OCR)"}</Button>
          </div>
        }
      >
        {reviewing ? (
        <div className="space-y-5">
          <div className="space-y-1 rounded-control border border-line bg-surface-container-low p-4">
            <p className="text-sm font-semibold text-on-surface">Check every field against the paper form</p>
            <p className="text-[13px] text-on-surface-variant">The fields are frozen on this page — go back to fix anything, then submit.</p>
            {formFile && (
              <p className="text-[13px]">
                <button
                  type="button"
                  onClick={() => setFormView(true)}
                  className="rounded font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  View the uploaded scan ({formFile})
                </button>
              </p>
            )}
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
          </section>
          <section className="space-y-2 border-t border-line pt-4">
            <SectionTitle n="II" title="Information on other household members" />
            {adminIncome ? (
              <ul className="space-y-1">
                {members.filter((m) => m.name.trim()).map((m, i) => (
                  <li key={i} className="text-sm">
                    <span className="font-medium">{m.name}</span>
                    <span className="text-[13px] text-on-surface-variant"> · {m.nric || "—"} · {m.relationship} · {m.age} · {m.occupation} · gross S${m.gross || 0} · other S${m.other || 0}</span>
                  </li>
                ))}
                <li className="text-sm"><span className="text-on-surface-variant">Total GHI: </span><span className="font-medium">S${totalGhi.toLocaleString("en-SG")} / month</span></li>
              </ul>
            ) : homesOnly ? (
              <p className="text-sm text-on-surface-variant">
                Only employment and/or trade income — Section II is not required; the bands come from HOMES (IRAS + CPF).
              </p>
            ) : (
              <p className="text-sm text-on-surface-variant">Employment/trade income only — nothing keyed in.</p>
            )}
            <p className="text-sm">
              <span className="text-on-surface-variant">Income band (derived): </span>
              <span className="font-medium">{bandFromForm().band.label}</span>
              <span className="text-[13px] text-on-surface-variant"> — {bandFromForm().source}</span>
            </p>
          </section>
          <section className="space-y-2 border-t border-line pt-4">
            <SectionTitle n="IV" title="Mode of transport between home and school" />
            <p className="text-sm font-medium">{transportMode || "—"}</p>
          </section>
          <section className="space-y-2 border-t border-line pt-4">
            <SectionTitle n="V" title="Subsidised broadband and/or laptop/tablet" />
            <p className="text-sm"><span className="text-on-surface-variant">Hard copy of the DigitalAccess@Home form: </span><span className="font-medium">{imdaCopy === "yes" ? "Yes" : imdaCopy === "no" ? "No" : "—"}</span></p>
          </section>
          <section className="space-y-2 border-t border-line pt-4">
            <SectionTitle n="VI" title="Declaration and agreement by the applicant" />
            <p className="text-sm font-medium">{declared ? `Signed and dated by ${applicant.trim() || "the applicant"}` : "Not confirmed"}</p>
            {note.trim() && <p className="text-[13px] text-on-surface-variant">Note on the form: {note.trim()}</p>}
          </section>
          <section className="space-y-2 border-t border-line pt-4">
            <SectionTitle n="VII" title="Where this form goes" />
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
          {formFile && (
            <div className="flex flex-wrap items-center gap-2 rounded-control border border-line bg-surface-container-low px-3 py-2 text-[13px]">
              <span className="text-on-surface-variant">Uploaded form:</span>
              <button
                type="button"
                onClick={() => setFormView(true)}
                className="inline-flex items-center gap-1.5 rounded-control px-1.5 py-0.5 font-medium text-primary hover:bg-primary-fixed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <FilePdf size={14} weight="bold" aria-hidden="true" /> {formFile}
              </button>
              <span className="text-on-surface-variant">· fields pre-filled by OCR — verify every one</span>
              <button
                type="button"
                aria-label="Remove the uploaded form"
                className="rounded-control p-1 hover:bg-surface-container-lowest"
                onClick={reset}
              >
                <X size={14} weight="bold" aria-hidden="true" />
              </button>
            </div>
          )}
          {/* Sprint 3 refinement — step 0: the parent/guardian NRIC keys the whole family out of the
              shared MOE registry. No match = the staff types the children in by hand, as before. */}
          <section className="space-y-2 rounded-control border border-line bg-surface-container-low p-3">
            <p className="text-sm font-semibold text-on-surface">Family lookup — parent / guardian NRIC</p>
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
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Contact number" required>
              <input
                className={inputClass}
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="+65 …"
              />
              </Field>
              <Field label="Email address">
                <input className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="optional" />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Home address" required>
                <input className={inputClass} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Blk / street / postal code" />
              </Field>
            </div>
          </section>

          <section className="space-y-3 border-t border-line pt-4">
            <SectionTitle n="II" title="Information on other household members" />
            <label className="flex items-start gap-2.5 rounded-control border border-line px-3 py-2 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 size-4 accent-[#8A2538]"
                checked={homesOnly}
                onChange={(e) => {
                  setHomesOnly(e.target.checked);
                  if (e.target.checked) setAdminIncome(false);
                }}
              />
              <span>
                The household has only employment and/or trade income — no other administrative income
                {homesOnly && (
                  <span className="block text-[13px] text-on-surface-variant">
                    Section II is not required — MOE retrieves the gross household income and per-capita income from HOMES (IRAS + CPF records).
                  </span>
                )}
              </span>
            </label>
            <label className="flex items-start gap-2.5 rounded-control border border-line px-3 py-2 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 size-4 accent-[#8A2538]"
                checked={adminIncome}
                onChange={(e) => {
                  setAdminIncome(e.target.checked);
                  if (e.target.checked) setHomesOnly(false);
                }}
              />
              <span>
                The household also has other administrative income (rental, dividends, taxable investment income)
              </span>
            </label>
            {adminIncome && (
                  <div className="space-y-2 rounded-control border border-line p-3">
                    <div className="hidden gap-2 sm:grid sm:grid-cols-[auto_1.1fr_0.9fr_1.2fr_0.5fr_1.3fr_1fr_1fr_auto]">
                      <span className="w-4 text-[12px] font-semibold leading-tight text-on-surface-variant">S/ No.</span>
                      <span className="text-[12px] font-semibold leading-tight text-on-surface-variant">Name</span>
                      <span className="text-[12px] font-semibold leading-tight text-on-surface-variant">BC/NRIC No.</span>
                      <span className="text-[12px] font-semibold leading-tight text-on-surface-variant">Relationship &amp; Marital Status</span>
                      <span className="text-[12px] font-semibold leading-tight text-on-surface-variant">Age</span>
                      <span className="text-[12px] font-semibold leading-tight text-on-surface-variant">Occupation Status (e.g. Student/ Self-employed/ Employed/ Unemployed)</span>
                      <span className="text-[12px] font-semibold leading-tight text-on-surface-variant">Gross Monthly Income (from employment and/or trade)</span>
                      <span className="text-[12px] font-semibold leading-tight text-on-surface-variant">Other Administrative Income (e.g. rental income, dividends and taxable investment income)</span>
                      <span />
                    </div>
                    {members.map((m, i) => (
                      <div key={i} className="grid gap-2 sm:grid-cols-[auto_1.1fr_0.9fr_1.2fr_0.5fr_1.3fr_1fr_1fr_auto]">
                        <span className="flex min-h-11 items-center text-[13px] text-on-surface-variant" aria-hidden="true">{i + 1}</span>
                        <input className={inputClass} aria-label={`Member ${i + 1} name`} placeholder="Name" value={m.name} onChange={(e) => setMember(i, { name: e.target.value })} />
                        <input className={inputClass} aria-label={`Member ${i + 1} NRIC no.`} placeholder="NRIC no." value={m.nric} onChange={(e) => setMember(i, { nric: e.target.value })} />
                        <input className={inputClass} aria-label={`Member ${i + 1} relationship`} placeholder="Relationship" value={m.relationship} onChange={(e) => setMember(i, { relationship: e.target.value })} />
                        <input className={inputClass} aria-label={`Member ${i + 1} age`} placeholder="Age" inputMode="numeric" value={m.age} onChange={(e) => setMember(i, { age: e.target.value })} />
                        <select className={inputClass} aria-label={`Member ${i + 1} occupation status`} value={m.occupation} onChange={(e) => setMember(i, { occupation: e.target.value })}>
                          {OCCUPATIONS.map((o) => <option key={o}>{o}</option>)}
                        </select>
                        <input className={inputClass} aria-label={`Member ${i + 1} gross monthly income`} placeholder="Gross / mth" inputMode="decimal" value={m.gross} onChange={(e) => setMember(i, { gross: e.target.value })} />
                        <input
                          className={inputClass}
                          aria-label={`Member ${i + 1} other administrative income`}
                          placeholder="Other income"
                          inputMode="decimal"
                          value={m.other}
                          onChange={(e) => setMember(i, { other: e.target.value })}
                        />
                        <Button size="sm" variant="secondary" aria-label={`Remove member ${i + 1}`} onClick={() => setMembers((ms) => ms.filter((_, j) => j !== i))} disabled={members.length === 1}>
                          <X size={16} weight="bold" aria-hidden="true" />
                        </Button>
                      </div>
                    ))}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Button size="sm" variant="secondary" onClick={() => setMembers((ms) => [...ms, blankMember()])}>
                        <Plus size={16} weight="bold" aria-hidden="true" /> Add member
                      </Button>
                      <p className="text-[13px] text-on-surface-variant">
                        Total gross household income (12-month average): <span className="font-semibold text-on-surface">S${totalGhi.toLocaleString("en-SG")}</span> / month
                      </p>
                    </div>
                  </div>
                )}
          </section>

          <section className="space-y-2 border-t border-line pt-4">
            <SectionTitle n="III" title="Benefits under MOE FAS" />
            <p className="text-sm text-on-surface-variant">
              Full subsidy of school fees and miscellaneous fees. At the primary and secondary levels: free textbooks and
              school attire (2 sets of uniforms, 2 sets of PE attire, shoes and socks), and a school meals subsidy. The
              school will tell the parent when and where to collect.
            </p>
          </section>

          <section className="space-y-2 border-t border-line pt-4">
            <SectionTitle n="IV" title="Mode of transport between home and school" />
            <div className="space-y-1.5">
              {TRANSPORT_MODES.map(({ mode, note, primaryOnly }) => {
                const off = primaryOnly && !schoolBusAllowed;
                return (
                  <label key={mode} className={`flex items-start gap-2.5 rounded-control border border-line px-3 py-2 text-sm ${off ? "opacity-50" : "cursor-pointer hover:bg-surface-container-low"}`}>
                    <input
                      type="radio"
                      name="transport"
                      className="mt-0.5 size-4 accent-[#8A2538]"
                      disabled={off}
                      checked={transportMode === mode}
                      onChange={() => setTransportMode(mode)}
                    />
                    <span>
                      {mode}
                      <span className="block text-[13px] text-on-surface-variant">{off ? "Primary level only" : note}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </section>

          <section className="space-y-2 border-t border-line pt-4">
            <SectionTitle n="V" title="Subsidised broadband and/or laptop/tablet" />
            <p className="text-sm text-on-surface-variant">
              If the family is interested, they can apply at digitalaccess.gov.sg, call 6377 3800, or ask this school
              for a hard copy of that application form.
            </p>
            <div className="space-y-1.5" role="radiogroup" aria-label="Hard copy of the DigitalAccess@Home application form">
              {([
                ["yes", "Yes — hand the parent a hard copy of that application form"],
                ["no", "No — the family will apply on their own"],
              ] as const).map(([v, label]) => (
                <label key={v} className="flex items-start gap-2.5 rounded-control border border-line px-3 py-2 text-sm cursor-pointer hover:bg-surface-container-low">
                  <input
                    type="radio"
                    name="imda-copy"
                    className="mt-0.5 size-4 accent-[#8A2538]"
                    checked={imdaCopy === v}
                    onChange={() => setImdaCopy(v)}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </section>

          <section className="space-y-3 border-t border-line pt-4">
            <SectionTitle n="VI" title="Declaration and agreement by the applicant" />
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
            <SectionTitle n="VII" title="Where this form goes" />
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
        open={formView && !!formFile}
        onClose={() => setFormView(false)}
        title={formFile ?? "Scanned form"}
        footer={
          <>
            <Button variant="secondary" onClick={() => { setFormView(false); reset(); }}>Remove & upload another</Button>
            <Button onClick={() => setFormView(false)}>Close</Button>
          </>
        }
      >
        {formFile && (
          <>
            <p className="mb-3 text-[13px] text-on-surface-variant">
              The OCR pre-filled the entry fields from this scan — applicant: <span className="font-semibold text-on-surface">{applicant.trim() || "—"}</span>. Removing the file clears the form for a fresh upload.
            </p>
            <img src={formDocImage(formFile, applicant)} alt="Sample scanned MOE FAS form" className="max-h-[60vh] w-full rounded-control border border-line object-contain" />
          </>
        )}
      </Modal>

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

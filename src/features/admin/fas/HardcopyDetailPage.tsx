import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft, PencilSimple, Printer } from "@phosphor-icons/react";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { EmptyState } from "../../../components/ui/EmptyState";
import { Field, inputClass } from "../../../components/ui/Field";
import { useFas } from "../../../data/fasStore";
import { useFasActions } from "../../../data/fasActions";
import { schoolOfLevel } from "../../../data/schoolMgmt";
import { useRegistry } from "../../../data/registryStore";
import type { Level } from "../../../data/students";
import type { FamilyApplication } from "../../../data/familyApplications";
import { useSession } from "../../../session";
import { PaperDetail } from "./HardcopyEntry";
import { openVerificationPrint } from "./draftPrint";

/** A submitted paper form as its own page: clicking a history row navigates here instead of
 *  expanding the list, so the list stays scannable no matter how many applications there are.
 *
 *  The page also closes the checking loop after key-in: "Print for the parent to check" prints a
 *  verification copy of the keyed-in record, and when the parent comes back with something still
 *  wrong, "Edit this application" fixes THIS record in place — the children, the HOMES band and
 *  every decision stay as they are, and no second application is ever created.
 *
 *  After this school REJECTS a child's SBFAS request, everything happens on the review page
 *  instead: the parent's re-request returns the same application to the queue as its next round,
 *  reason logged — a recorded decision is never changed in place (one application per child per
 *  year; see ReviewPage). */

/** The in-place correction: only the data the school keyed in is editable, pre-filled with the
 *  record's current values. Saving fixes the same FAS record — never a new application — and
 *  stamps the correction on it for the audit trail. */
function PaperCorrect({ fa, by, onDone, onCancel }: { fa: FamilyApplication; by: string; onDone: () => void; onCancel: () => void }) {
  const actions = useFasActions();
  const [contact, setContact] = useState(fa.contact);
  const [address, setAddress] = useState(fa.address ?? "");
  const [extraIncome, setExtraIncome] = useState(fa.extraIncome !== undefined ? String(fa.extraIncome) : "");
  const [residents, setResidents] = useState(fa.residents !== undefined ? String(fa.residents) : "");
  const [note, setNote] = useState(fa.note ?? "");
  const [error, setError] = useState<{ where: "contact" | "address" | "extra" | "residents"; message: string } | null>(null);

  const save = () => {
    if (!contact.trim()) return setError({ where: "contact", message: "Enter the contact number for the record." });
    if (!address.trim()) return setError({ where: "address", message: "Enter the home address for the record." });
    if (!/^\d+(\.\d{1,2})?$/.test(extraIncome.trim())) return setError({ where: "extra", message: "Enter the extra monthly money in dollars, or 0 if none." });
    const people = Number(residents.trim());
    if (!Number.isInteger(people) || people < 1 || people > 20)
      return setError({ where: "residents", message: "Enter the number of people currently living in the home (a whole number from 1 to 20)." });
    setError(null);
    actions.correctFamilyApp({ id: fa.id, contact: contact.trim(), address: address.trim(), extraIncome: Number(extraIncome) || 0, residents: people, note: note.trim(), by });
    onDone();
  };

  return (
    <div className="space-y-4">
      <p className="rounded-control border border-line bg-surface-container-low p-3 text-[13px] text-on-surface-variant">
        The parent checked the printed copy and something is still wrong — fix this record in place. The children, the HOMES
        band and every decision stay exactly as they are; nothing is re-filed.
      </p>
      <Field required label="Contact number" error={error?.where === "contact" ? error.message : undefined}>
        <input
          className={inputClass}
          aria-label="Contact number"
          value={contact}
          onChange={(e) => { setContact(e.target.value); if (error?.where === "contact") setError(null); }}
        />
      </Field>
      <Field required label="Home address" error={error?.where === "address" ? error.message : undefined}>
        <input
          className={inputClass}
          aria-label="Home address"
          value={address}
          onChange={(e) => { setAddress(e.target.value); if (error?.where === "address") setError(null); }}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field required label="Extra monthly money (S$)" error={error?.where === "extra" ? error.message : undefined}>
          <input
            className={inputClass}
            aria-label="Extra monthly money"
            inputMode="decimal"
            value={extraIncome}
            onChange={(e) => { setExtraIncome(e.target.value); if (error?.where === "extra") setError(null); }}
          />
        </Field>
        <Field required label="People currently living in the home" error={error?.where === "residents" ? error.message : undefined}>
          <input
            className={inputClass}
            aria-label="People currently living in the home"
            type="number"
            min={1}
            max={20}
            step={1}
            inputMode="numeric"
            value={residents}
            onChange={(e) => { setResidents(e.target.value); if (error?.where === "residents") setError(null); }}
          />
        </Field>
      </div>
      <Field label="Anything else on the form (optional)">
        <textarea rows={2} className={`${inputClass} py-2`} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button onClick={save}>Save the correction</Button>
      </div>
    </div>
  );
}

export default function HardcopyDetailPage() {
  const { faId = "" } = useParams();
  const navigate = useNavigate();
  const { state: fas } = useFas();
  const { state: reg } = useRegistry();
  const { staff } = useSession();
  const mySchool = staff?.schoolCode ?? "";
  const schoolName = reg.schools.find((s) => s.code === mySchool)?.name ?? mySchool;
  // The correction view on this page: opened by "Edit this application", closed by save or cancel.
  const [editing, setEditing] = useState(false);
  const [printMiss, setPrintMiss] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [faId]);

  const fa = fas.familyApps.find((f) => f.id === faId && (f.school === schoolName || f.school === mySchool));
  const linked = fa ? fas.apps.filter((x) => x.familyAppId === fa.id) : [];
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

  // Saving the correction closes the form: the detail shows the fixed values, and the corrected
  // stamp at the top of the record is the confirmation that it was this same application.
  return (
    <div className="space-y-4">
      {backLink}
      <Card
        title={editing ? `Correct ${fa.id} · ${fa.applicant}` : `${fa.id} · ${fa.applicant}`}
        action={editing ? undefined : (
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              size="sm"
              variant="secondary"
              icon={<Printer size={14} weight="bold" aria-hidden="true" />}
              onClick={() => setPrintMiss(!openVerificationPrint(fa, linked, fa.school))}
            >
              Print for the parent to check
            </Button>
            <Button
              size="sm"
              variant="secondary"
              icon={<PencilSimple size={14} weight="bold" aria-hidden="true" />}
              onClick={() => { setEditing(true); setPrintMiss(false); }}
            >
              Edit this application
            </Button>
          </div>
        )}
      >
        {printMiss && (
          <p role="alert" className="mb-3 text-[13px] font-medium text-alert">
            The print window was blocked — allow popups for this site, then press Print again.
          </p>
        )}
        {editing ? (
          <PaperCorrect fa={fa} by={staff?.name ?? "School user"} onDone={() => setEditing(false)} onCancel={() => setEditing(false)} />
        ) : (
          <PaperDetail fa={fa} linked={linked} schoolOf={schoolOf} />
        )}
      </Card>
    </div>
  );
}

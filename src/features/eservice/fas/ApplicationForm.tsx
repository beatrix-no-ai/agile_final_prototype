import { DownloadSimple, PaperPlaneTilt, Sparkle } from "@phosphor-icons/react";
import { useRef, useState, type FormEvent } from "react";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { Field, inputClass } from "../../../components/ui/Field";
import { household } from "../../../data/familyFas";
import type { FamilyApplication } from "../../../data/familySubmission";
import { children } from "../../../data/parent";
import { fmtDate } from "../overview/shared";
import { validateForm, type FormValues } from "./logic";
import { AssumptionTag } from "../../../components/ui/AssumptionTag";
import { TODAY } from "./shared";

type Props = { values: FormValues; onChange: (v: FormValues) => void; filledNote: string; onAskAi: () => void; onSubmit: () => void; family: FamilyApplication | null };

export function ApplicationForm({ values, onChange, filledNote, onAskAi, onSubmit, family }: Props) {
  const [tried, setTried] = useState(false);
  const [consent, setConsent] = useState(false);
  const [sentOn, setSentOn] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // After the first submit attempt, errors re-evaluate live, so they also clear when the AI helper fills a field.
  const errors = tried ? validateForm(values, consent) : {};
  const set = (k: keyof FormValues) => (e: { target: { value: string } }) => {
    setSentOn(null);
    onChange({ ...values, [k]: e.target.value });
  };

  function submit(e: FormEvent) {
    e.preventDefault();
    setTried(true);
    const first = Object.keys(validateForm(values, consent))[0]; // key order = field order on screen
    setSentOn(first ? null : TODAY);
    if (first) (formRef.current?.elements.namedItem(first) as HTMLElement | null)?.focus();
    else onSubmit(); // one family submission per session creates the per-child applications in the school queue
  }

  return (
    <Card
      title="Family application details"
      action={<Button size="sm" variant="secondary" icon={<Sparkle size={16} weight="bold" aria-hidden="true" />} onClick={onAskAi}>Ask AI helper</Button>}
    >
      <p className="text-sm text-on-surface-variant">
        One form for the whole family{family ? ` (${family.appIds[0]})` : ""}. Update the details the bursar needs; submit once — the school reviews each child from this one application. <AssumptionTag />
      </p>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-control border border-line bg-surface-container-low p-3">
        <div>
          <p className="text-sm font-semibold">Prefer a paper application?</p>
          <p className="mt-1 text-[13px] text-on-surface-variant">Download the official 7-page MOE FAS form, complete it and submit it to your child&apos;s school.</p>
        </div>
        <a
          href="/forms/moe-fas-application-form.pdf"
          download="MOE-FAS-Application-Form.pdf"
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-control border border-line bg-surface-container-lowest px-4 text-sm font-semibold text-primary motion-safe:transition-colors hover:bg-primary-fixed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <DownloadSimple size={18} weight="bold" aria-hidden="true" />
          Download PDF form
        </a>
      </div>
      <p role="status" className={filledNote ? "mt-3 rounded-control bg-primary-fixed px-3 py-2 text-[13px] font-medium text-on-primary-fixed" : ""}>{filledNote}</p>
      <form ref={formRef} noValidate onSubmit={submit} className="mt-4 space-y-4">
        <section aria-labelledby="section-one">
          <h3 id="section-one" className="border-b border-line pb-2 text-sm font-bold">Section I: Particulars of child or children</h3>
          <p className="mt-2 text-[13px] text-on-surface-variant">Please indicate the details of each child studying in a Government or Government-aided school.</p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-[13px]">
              <thead className="border-b border-line text-on-surface-variant">
                <tr><th className="px-2 py-2 font-medium">BC/NRIC No.</th><th className="px-2 py-2 font-medium">Name (underline surname)</th><th className="px-2 py-2 font-medium">Name of current school</th><th className="px-2 py-2 font-medium">Current level</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {children.map((child) => (
                  <tr key={child.id}><td className="px-2 py-2 text-on-surface-variant">S****{child.id === "c1" ? "881A" : "442B"}</td><td className="px-2 py-2 font-medium">{child.name}</td><td className="px-2 py-2">{child.school}</td><td className="px-2 py-2">{child.level}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <Field required label="Home address" error={errors.mailingAddress}><input name="homeAddress" value={values.mailingAddress} onChange={set("mailingAddress")} className={inputClass} autoComplete="street-address" /></Field>
            <Field required label="Email address"><input type="email" value="rachel.lim@example.com" readOnly className={`${inputClass} bg-surface-container-low`} /></Field>
          </div>
        </section>

        <section aria-labelledby="section-two" className="border-t border-line pt-4">
          <h3 id="section-two" className="text-sm font-bold">Section II: Information on other household members</h3>
          <p className="mt-2 text-[13px] text-on-surface-variant">Include all related household members living at the same address, including spouse, siblings, parents and grandparents.</p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-[13px]">
              <thead className="border-b border-line text-on-surface-variant">
                <tr><th className="px-2 py-2 font-medium">S/N</th><th className="px-2 py-2 font-medium">Name &amp; BC/NRIC No.</th><th className="px-2 py-2 font-medium">Relationship &amp; marital status</th><th className="px-2 py-2 font-medium">Age</th><th className="px-2 py-2 font-medium">Occupation status</th><th className="px-2 py-2 font-medium">Gross monthly income</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {household.filter((member) => member.role !== "Child").map((member, index) => (
                  <tr key={member.id}><td className="px-2 py-2">{index + 1}</td><td className="px-2 py-2 font-medium">{member.name}<span className="block text-[12px] text-on-surface-variant">{member.detail}</span></td><td className="px-2 py-2">{member.role}</td><td className="px-2 py-2">—</td><td className="px-2 py-2">Employed</td><td className="px-2 py-2">Provided via SingPass</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 rounded-control bg-surface-container-low p-3 text-[13px] text-on-surface-variant">MOE will retrieve the household gross and per capita income from the Government Household Means Eligibility System (HOMES) after consent.</p>
        </section>

        <Field required label="Contact number" error={errors.contact} hint="Singapore number, e.g. +65 9123 4567">
          <input name="contact" type="tel" autoComplete="tel" className={inputClass} value={values.contact} onChange={set("contact")} />
        </Field>
        <Field required label="Mailing address" error={errors.mailingAddress}>
          <input name="mailingAddress" autoComplete="street-address" className={inputClass} value={values.mailingAddress} onChange={set("mailingAddress")} />
        </Field>
        <Field label="Anything else the bursar should know? (optional)">
          <textarea name="note" rows={3} className={`${inputClass} py-2`} value={values.note} onChange={set("note")} />
        </Field>
        <section aria-labelledby="section-three" className="border-t border-line pt-4">
          <h3 id="section-three" className="text-sm font-bold">Section III: Declaration and agreement</h3>
          <ol className="mt-2 list-decimal space-y-2 pl-5 text-[13px] text-on-surface-variant">
            <li>I declare that the information provided in this application is true and complete.</li>
            <li>I authorise MOE and the relevant school or schools to verify the information and assess this application.</li>
            <li>I understand that false or misleading information may result in the assistance being withdrawn or recovered.</li>
          </ol>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <Field label="Name, NRIC No. and signature"><input value="Rachel Lim · S****567A" readOnly className={`${inputClass} bg-surface-container-low`} /></Field>
            <Field label="Date"><input value={TODAY} readOnly className={`${inputClass} bg-surface-container-low`} /></Field>
          </div>
        </section>
        <div className="rounded-control border border-line p-3">
          <label className="flex min-h-11 items-start gap-3 text-sm">
            <input
              type="checkbox"
              name="consent"
              checked={consent}
              aria-invalid={Boolean(errors.consent)}
              aria-describedby={errors.consent ? "consent-err" : undefined}
              onChange={(e) => { setConsent(e.target.checked); setSentOn(null); }}
              className="mt-0.5 size-5 shrink-0 accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            />
            I agree to MOE retrieving my household income band from SingPass and sharing this application with my children's schools for assessment. <span aria-hidden className="text-alert">*</span>
          </label>
          {errors.consent && <p id="consent-err" role="alert" className="mt-1.5 text-[13px] font-medium text-alert">{errors.consent}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="submit"
            disabled={!consent}
            className={!consent ? "border-line bg-surface-container-high text-on-surface-variant" : ""}
            icon={<PaperPlaneTilt size={18} weight="bold" aria-hidden="true" />}
          >
            Submit application
          </Button>
          <p role="status" className="text-sm font-medium text-success">{family ? `Submitted on ${fmtDate(family.submittedOn)}. The school is reviewing each child.` : sentOn && `Submitted on ${fmtDate(sentOn)}. Review continues.`}</p>
        </div>
      </form>
    </Card>
  );
}

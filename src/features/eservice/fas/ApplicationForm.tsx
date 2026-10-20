import { PaperPlaneTilt } from "@phosphor-icons/react";
import { useRef, useState, type FormEvent } from "react";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { Field, inputClass } from "../../../components/ui/Field";
import { validateForm, type FormValues } from "./logic";
import { TODAY } from "./shared";

const MAX_BYTES = 5 * 1024 * 1024;

type Props ={ values: FormValues; onChange: (v: FormValues) => void; applicant: string; onSubmit: () => void };

/** The family application: extra income and residents (for GHI and PCI), contact details, an optional note, the declaration and consent. The household and income band come from HOMES in the section above. */
export function ApplicationForm({ values, onChange, applicant, onSubmit }: Props) {
  const [tried, setTried] = useState(false);
  const [consent, setConsent] = useState(false);
  const [docs, setDocs] = useState<File[]>([]); // ponytail: held in the form only, not sent anywhere (no backend)
  const formRef = useRef<HTMLFormElement>(null);

  // After the first submit attempt, errors re-evaluate live.
  const errors = tried ? validateForm(values, consent) : {};
  const set = (k: keyof FormValues) => (e: { target: { value: string } }) => onChange({ ...values, [k]: e.target.value });

  function submit(e: FormEvent) {
    e.preventDefault();
    setTried(true);
    const first = Object.keys(validateForm(values, consent))[0]; // key order = field order on screen
    if (first) (formRef.current?.elements.namedItem(first) as HTMLElement | null)?.focus();
    else onSubmit();
  }

  return (
    <Card title="Your FAS application">
      <p className="text-sm text-on-surface-variant">One application covers the whole family. Tell us about your household, check your contact details, then submit.</p>
      <form ref={formRef} noValidate onSubmit={submit} className="mt-4 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field required label="Extra monthly money (S$)" error={errors.extraIncome} hint="Income not in HOMES, e.g. rental, allowance or family support. Enter 0 if none.">
            <input name="extraIncome" inputMode="decimal" className={inputClass} value={values.extraIncome} onChange={set("extraIncome")} />
          </Field>
          <Field required label="People currently living in your home" error={errors.residents} hint="Everyone who lives with you now, including you.">
            <input name="residents" type="number" min={1} max={20} step={1} inputMode="numeric" className={inputClass} value={values.residents} onChange={set("residents")} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field required label="Contact number" error={errors.contact} hint="Singapore number, e.g. +65 9123 4567">
            <input name="contact" type="tel" autoComplete="tel" className={inputClass} value={values.contact} onChange={set("contact")} />
          </Field>
          <Field required label="Mailing address" error={errors.mailingAddress}>
            <input name="mailingAddress" autoComplete="street-address" className={inputClass} value={values.mailingAddress} onChange={set("mailingAddress")} />
          </Field>
        </div>
        <Field label="Anything else the bursar should know? (optional)">
          <textarea name="note" rows={3} className={`${inputClass} py-2`} value={values.note} onChange={set("note")} />
        </Field>
        <Field label="Supporting documents (optional)" hint="e.g. payslips, retrenchment letter, medical bills. PDF, JPG or PNG, up to 5 MB each.">
          <input
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png"
            className={`${inputClass} py-2 file:mr-3 file:rounded-control file:border-0 file:bg-surface-container-low file:px-3 file:py-1 file:font-medium file:text-primary`}
            onChange={(e) => {
              const picked = Array.from(e.target.files ?? []).filter((f) => f.size <= MAX_BYTES);
              setDocs((d) => [...d, ...picked]);
              e.target.value = ""; // allow re-picking the same file
            }}
          />
        </Field>
        {docs.length > 0 && (
          <ul className="divide-y divide-line rounded-control border border-line text-[13px]">
            {docs.map((f, i) => (
              <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="truncate">{f.name} <span className="text-on-surface-variant">({Math.max(1, Math.round(f.size / 1024))} KB)</span></span>
                <button type="button" aria-label={`Remove ${f.name}`} className="min-h-8 px-2 font-medium text-primary" onClick={() => setDocs((d) => d.filter((_, j) => j !== i))}>Remove</button>
              </li>
            ))}
          </ul>
        )}
        <section aria-labelledby="declaration" className="rounded-control border border-line bg-surface-container-low p-4">
          <h3 id="declaration" className="text-sm font-bold">Declaration</h3>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-[13px] text-on-surface-variant">
            <li>The information in this application is true and complete.</li>
            <li>MOE and the schools may verify it and assess this application.</li>
            <li>False or misleading information may lead to the assistance being withdrawn or recovered.</li>
          </ol>
          <p className="mt-3 text-[13px] text-on-surface-variant">Declared by <strong className="text-on-surface">{applicant}</strong> on {TODAY}.</p>
        </section>
        <div>
          <label className="flex min-h-11 items-start gap-3 text-sm">
            <input
              type="checkbox"
              name="consent"
              checked={consent}
              aria-invalid={Boolean(errors.consent)}
              aria-describedby={errors.consent ? "consent-err" : undefined}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-0.5 size-5 shrink-0 accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            />
            I agree to MOE retrieving my household income from HOMES and sharing this application with my children's schools for assessment. <span aria-hidden className="text-alert">*</span>
          </label>
          {errors.consent && <p id="consent-err" role="alert" className="mt-1.5 text-[13px] font-medium text-alert">{errors.consent}</p>}
        </div>
        <Button type="submit" disabled={!consent} icon={<PaperPlaneTilt size={18} weight="bold" aria-hidden="true" />}>Submit application</Button>
      </form>
    </Card>
  );
}

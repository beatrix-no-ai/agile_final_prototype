import { autoFillSource, type Band } from "../../../data/familyFas";

export type SyncStatus = "idle" | "loading" | "success" | "error";
export type FormValues = { contact: string; mailingAddress: string; note: string };
export type FormErrors = Partial<Record<keyof FormValues | "consent", string>>;

export type ChildResult = { scheme: "MOEFAS" | "SBFAS" | null; tier?: string; status: "Indicative" | "School decides" | "Not eligible"; note: string };

/**
 * ASSUMPTION (precedence): MOEFAS is checked first. SBFAS is only considered when MOEFAS is not granted,
 * so a child never holds both. A child's result is derived from the family's income band only.
 */
export function assess(band: Band): ChildResult {
  if (band.tier === "MOEFAS Tier 1" || band.tier === "MOEFAS Tier 2") {
    return { scheme: "MOEFAS", tier: band.tier.replace("MOEFAS ", ""), status: "Indicative", note: "Granted automatically by criteria once review completes. SBFAS does not apply." };
  }
  if (band.tier === "SBFAS") {
    return { scheme: "SBFAS", status: "School decides", note: "Not in a MOEFAS band, so your child's school decides on SBFAS." };
  }
  return { scheme: null, status: "Not eligible", note: "Income band is above both schemes. Speak to your school if your situation has changed." };
}

export type StepState = "Done" | "In progress" | "To do" | "Waiting" | "Failed";
export type Step = { name: string; state: StepState };

/**
 * Tracker states follow the income sync and the school's review. Review phase: "not-submitted" (no family
 * application yet), "pending" (the school is deciding the per-child SBFAS applications) or "decided"
 * (every child application has a decision). Disbursement only moves once something is granted.
 */
export function trackerSteps(sync: SyncStatus, hasBand: boolean, review: "not-submitted" | "pending" | "decided", granted = false): Step[] {
  const income: StepState = sync === "loading" ? "In progress" : sync === "error" ? "Failed" : hasBand ? "Done" : "To do";
  const submission: StepState = review === "not-submitted" ? "To do" : "Done";
  const reviewState: StepState = review === "decided" ? "Done" : review === "pending" && income === "Done" ? "In progress" : "Waiting";
  const disbursement: StepState = review === "decided" && granted ? "In progress" : "Waiting";
  return [
    { name: "Submission", state: submission },
    { name: "Income sync", state: income },
    { name: "Review", state: reviewState },
    { name: "Disbursement", state: disbursement },
  ];
}

// ASSUMPTION: Singapore mobile/landline, 8 digits starting 3, 6, 8 or 9, optional +65.
const sgNumber = /^(\+?65)?[\s-]?[3689]\d{3}[\s-]?\d{4}$/;

export function validateForm(v: FormValues, consent: boolean): FormErrors {
  const e: FormErrors = {};
  if (!v.contact.trim()) e.contact = "Enter a contact number.";
  else if (!sgNumber.test(v.contact.trim())) e.contact = "Enter a valid Singapore number, e.g. +65 9123 4567.";
  if (!v.mailingAddress.trim()) e.mailingAddress = "Enter a mailing address.";
  if (!consent) e.consent = "Tick the box to consent before submitting.";
  return e;
}

/** ASSUMPTION: mock AI auto-fill with fixed data. Only empty fields are filled; `count` says how many. */
export function autoFill(cur: FormValues): { values: FormValues; count: number } {
  const values = { ...cur };
  let count = 0;
  for (const k of Object.keys(autoFillSource) as (keyof FormValues)[]) {
    if (!cur[k].trim()) {
      values[k] = autoFillSource[k];
      count++;
    }
  }
  return { values, count };
}

/** "different" leaves the field as typed so the parent can enter their own value. */
export function answersToForm(a: Partial<Record<"mailing" | "contact", string>>, cur: FormValues): FormValues {
  return {
    ...cur,
    mailingAddress: a.mailing === "same" ? autoFillSource.mailingAddress : cur.mailingAddress,
    contact: a.contact === "same" ? autoFillSource.contact : cur.contact,
  };
}

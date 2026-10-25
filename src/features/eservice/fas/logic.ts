import { type Band } from "../../../data/familyFas";
import type { FasStage } from "../../../data/parentStore";

export type SyncStatus = "idle" | "loading" | "success" | "error";
/** extraIncome and residents feed the GHI (gross household income) and PCI (per capita income) calculation later. */
export type FormValues = { extraIncome: string; residents: string; contact: string; mailingAddress: string; note: string };
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

/** Three stages for the parent: prepare the information, submit, then disbursement (which only starts after MOE has reviewed the application, and is done once every child's application is decided). */
export function trackerSteps(stage: FasStage, decided = false): Step[] {
  return [
    { name: "Prepare info", state: stage === "submitted" ? "Done" : stage === "preparing" ? "In progress" : "To do" },
    { name: "Submission", state: stage === "submitted" ? "Done" : stage === "preparing" ? "To do" : "Waiting" },
    { name: "Disbursement", state: stage === "submitted" && decided ? "Done" : "Waiting" },
  ];
}
// ASSUMPTION: Singapore mobile/landline, 8 digits starting 3, 6, 8 or 9, optional +65.
const sgNumber = /^(\+?65)?[\s-]?[3689]\d{3}[\s-]?\d{4}$/;

export function validateForm(v: FormValues, consent: boolean): FormErrors {
  const e: FormErrors = {}; // key order = field order on screen
  if (!/^\d+(\.\d{1,2})?$/.test(v.extraIncome.trim())) e.extraIncome = "Enter an amount in dollars, or 0 if none.";
  const n = Number(v.residents.trim());
  if (!Number.isInteger(n) || n < 1 || n > 20) e.residents = "Enter a whole number from 1 to 20.";
  if (!v.contact.trim()) e.contact = "Enter a contact number.";
  else if (!sgNumber.test(v.contact.trim())) e.contact = "Enter a valid Singapore number, e.g. +65 9123 4567.";
  if (!v.mailingAddress.trim()) e.mailingAddress = "Enter a mailing address.";
  if (!consent) e.consent = "Tick the box to consent before submitting.";
  return e;
}

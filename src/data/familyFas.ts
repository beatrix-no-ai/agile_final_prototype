// ASSUMPTION: all mock data for the family FAS application (Req 10). Children come from the school side (lib/family.ts); nothing is duplicated.
import { fasStatus, profile, type Child } from "./parent";

export type Member = { id: string; name: string; role: "Applicant" | "Spouse" | "Child"; detail: string };

// ASSUMPTION: the spouse is invented; MOE would read household members from SingPass / MyInfo.
export const householdOf = (children: Child[]): Member[] => [
  { id: "m1", name: profile.name, role: "Applicant", detail: `NRIC ${profile.nric}` },
  { id: "m2", name: "David Lim", role: "Spouse", detail: "NRIC S****214C" },
  ...children.map((c): Member => ({ id: c.id, name: c.name, role: "Child", detail: `${c.level}, ${c.school}` })),
];

export type Band = { id: string; label: string; tier: "MOEFAS Tier 1" | "MOEFAS Tier 2" | "SBFAS" | null };

// ASSUMPTION: bands and tier cut-offs are invented (per-person monthly household income). Only the band is ever stored or shown, never an exact income.
export const BANDS: Band[] = [
  { id: "b1", label: "Up to $750 per person", tier: "MOEFAS Tier 1" },
  { id: "b2", label: "$751 - $1,000 per person", tier: "MOEFAS Tier 2" },
  { id: "b3", label: "$1,001 - $1,500 per person", tier: "SBFAS" },
  { id: "b4", label: "Above $1,500 per person", tier: null },
];

/** Band already on file from the application submitted on 18 Sep (see fasStatus). */
export const initialBandId = "b2";

export const application = { id: fasStatus.applicationId, submittedOn: fasStatus.submittedOn };

// ASSUMPTION: mock AI helper. Canned questions, one at a time; answers are picked from options.
export type Question = { id: "mailing" | "contact"; text: string; options: { value: string; label: string }[] };

export const questions: Question[] = [
  {
    id: "mailing",
    text: "Should we send letters to your registered address?",
    options: [
      { value: "same", label: "Yes, same address" },
      { value: "different", label: "No, I will type another" },
    ],
  },
  {
    id: "contact",
    text: "Which number should the school use to reach you?",
    options: [
      { value: "same", label: "The number on my profile" },
      { value: "different", label: "A different number" },
    ],
  },
];

export const autoFillSource = {
  contact: profile.contact,
  mailingAddress: profile.mailingAddress,
  note: "Household income reduced since August; two children in school.",
};

import type { SbfasTier } from "./sbfasApplications";

export const ACADEMIC_YEAR = "AY 2026";

export type Level = "Primary" | "Secondary";
export type LevelBudget = { id: Level; budget: number; used: number; beneficiaries: number };

/** School (SBFAS) budget, school-funded. 74,800 / 120,000 = 62.3%. */
export const SBFAS = { budget: 120000, absorbed: 74800 };

/** 148 beneficiaries in total. */
export const SBFAS_BY_TIER = [
  { label: "Tier 1", value: 52 },
  { label: "Tier 2", value: 44 },
  { label: "Tier 3", value: 32 },
  { label: "Tier 4", value: 20 },
];

export const SBFAS_GOVERNANCE = [
  "SBFAS only applies where MOEFAS is not granted; the school decides tier and amount.",
  "Absorbed cost is reported to MOE HQ every quarter.",
  "Unused SBFAS budget does not roll over to the next financial year.",
];

/** MOE HQ view (MOEFAS). Only Primary and Secondary: Education Accounts cover ages 7-16. Beneficiaries (9,300 in total) are a subset of the dashboard "Total Student" (12,480). Secondary is deliberately over budget (Review Focus 2). Total allocated: S$38,000,000. */
export const MOEFAS_BY_LEVEL: LevelBudget[] = [
  { id: "Primary", budget: 20000000, used: 17400000, beneficiaries: 5200 },
  { id: "Secondary", budget: 18000000, used: 18900000, beneficiaries: 4100 },
];

// ASSUMPTION: MOEFAS tier names and the split of the 9,300 students across them are mock values; confirm with MOE.
export const MOEFAS_BY_TIER = [
  { label: "Tier 1", value: 3600 },
  { label: "Tier 2", value: 2700 },
  { label: "Tier 3", value: 1900 },
  { label: "Tier 4", value: 1100 },
];

// ASSUMPTION: what happens when spend exceeds budget is an open question. The UI only displays it
// (capped bar + "Over budget" badge); nothing blocks payouts or triggers an approval step.
export const OVER_BUDGET_NOTE = "When spend exceeds budget it is shown for review only; payouts are not blocked.";

// ASSUMPTION: the SBFAS amount for a tier is a fixed annual mock value (Tier 1 = most support); confirm with MOE.
export const SBFAS_TIER_AMOUNT: Record<SbfasTier, number> = { "Tier 1": 3000, "Tier 2": 2200, "Tier 3": 1500, "Tier 4": 800 };

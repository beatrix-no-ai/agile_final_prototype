import type { SbfasTier } from "./sbfasApplications";

export const ACADEMIC_YEAR = "Academic Year 2026";

export type Level = "Primary" | "Secondary";
export type LevelBudget = { id: Level; budget: number; used: number; beneficiaries: number };

/** School (SBFAS) budget, school-funded. 74,800 / 120,000 = 62.3%. */
export const SBFAS = { budget: 120000, absorbed: 74800 };

/** 148 beneficiaries in total. */
export const SBFAS_BY_TIER = [
  // per class, in LEVELS order (P1 ... Sec 4)
  { label: "Tier 1", byClass: [6, 5, 5, 5, 6, 5, 5, 5, 5, 5] },
  { label: "Tier 2", byClass: [5, 4, 4, 5, 4, 4, 5, 4, 5, 4] },
  { label: "Tier 3", byClass: [3, 3, 3, 4, 3, 3, 3, 4, 3, 3] },
  { label: "Tier 4", byClass: [2, 2, 2, 2, 2, 2, 2, 2, 2, 2] },
];

/** MOE HQ view (MOEFAS). Only Primary and Secondary: Education Accounts cover ages 7-16. Beneficiaries (9,300 in total) are a subset of the dashboard "Total Student" (12,480). Secondary is deliberately over budget (Review Focus 2). Total allocated: S$38,000,000. */
export const MOEFAS_BY_LEVEL: LevelBudget[] = [
  { id: "Primary", budget: 20000000, used: 17400000, beneficiaries: 5200 },
  { id: "Secondary", budget: 18000000, used: 18900000, beneficiaries: 4100 },
];

// ASSUMPTION: yearly package value of MOEFAS by tier (fees, textbooks, uniform, meals, transport); mock values.
export const MOEFAS_TIER_AMOUNT: Partial<Record<SbfasTier, number>> = { "Tier 1": 4000, "Tier 2": 3000, "Tier 3": 2000, "Tier 4": 1000 };

// ASSUMPTION: MOEFAS tier names and the split of the 9,300 students across them are mock values; confirm with MOE.
export const MOEFAS_BY_TIER = [
  // per class across all schools, in LEVELS order (P1 ... Sec 4); Primary / Secondary totals 2000/1600, 1500/1200, 1100/800, 600/500
  { label: "Tier 1", byClass: [340, 335, 335, 330, 330, 330, 420, 400, 400, 380] },
  { label: "Tier 2", byClass: [260, 255, 250, 250, 245, 240, 320, 300, 300, 280] },
  { label: "Tier 3", byClass: [190, 185, 185, 180, 180, 180, 210, 200, 200, 190] },
  { label: "Tier 4", byClass: [105, 100, 100, 100, 100, 95, 130, 125, 125, 120] },
];

// ASSUMPTION: what happens when spend exceeds budget is an open question. The UI only displays it
// (capped bar + "Over budget" badge); nothing blocks payouts or triggers an approval step.
export const OVER_BUDGET_NOTE = "When spend exceeds budget it is shown for review only; payouts are not blocked.";

// ASSUMPTION: the SBFAS amount for a tier is a fixed annual mock value (Tier 1 = most support); confirm with MOE.
export const SBFAS_TIER_AMOUNT: Partial<Record<SbfasTier, number>> = { "Tier 1": 3000, "Tier 2": 2200, "Tier 3": 1500, "Tier 4": 800 };

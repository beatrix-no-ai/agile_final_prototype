/**
 * Real MOE FAS / SBFAS scheme structure (MOE reference, Oct 2026).
 * MOE FAS is a standard national package applied uniformly to government / government-aided schools;
 * SBFAS is school-managed from internal funds (alumni, charity, PTA) for families just above the MOE FAS
 * threshold or hit by sudden hardship — the menu depends on each school's rules and budget.
 */

export type Benefits = { title: string; primary: string[]; secondary: string[] };

export const MOE_FAS_BENEFITS: Benefits = {
  title: "MOE FAS standard package",
  primary: [
    "School & Misc fees: 100% waiver",
    "Textbooks: full free textbook list",
    "School uniform: 2 sets + 2 PE sets (+ socks/shoes in Primary)",
    "Meal allowance: 7 meals/week (school days)",
    "Transport: 70% school-bus discount OR S$21/month public transport credit",
    "National exam fees: PSLE free",
  ],
  secondary: [
    "School & Misc fees: 100% waiver",
    "Textbooks: full free textbook list",
    "School uniform: 2 sets + 2 PE sets",
    "Meal allowance: 10 meals/week (school days)",
    "Transport: S$21/month EZ-Link / SimplyGo credit",
    "National exam fees: GCE N/O-Level free",
  ],
};

/** Typical SBFAS menu — the school board decides what it actually funds. */
export const SBFAS_PACKAGE = {
  title: "SBFAS school-defined package",
  items: [
    "School & misc fees: 100% waiver or 50-75% reduction",
    "Textbooks & uniform: vouchers or partial/full sponsorship",
    "Meals: coupons or card top-up (typically fewer / smaller than MOE FAS)",
    "Personal Learning Device: partial subsidy for secondary students",
    "Enrichment / field trips / CCA / camps: funded case by case",
  ],
  funding: "Internal school funds: alumni fund, charity, PTA contributions",
};

/**
 * Parents approved after already buying books/uniforms keep the receipts and claim reimbursement
 * at the school's General Office — surfaced wherever a grant is shown.
 */
export const REIMBURSEMENT_NOTE =
  "Already bought books or a uniform before approval? Keep the receipts and claim reimbursement at the school General Office.";

export const benefitsFor = (level: string): string[] =>
  level.startsWith("Sec") ? MOE_FAS_BENEFITS.secondary : MOE_FAS_BENEFITS.primary;

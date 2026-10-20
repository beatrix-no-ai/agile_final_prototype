// School-defined SBFAS package (Requirement 4, school side): each school decides which tiers it offers
// and the subsidy rate per tier, from its own internal funds. MOE never configures this — contrast with
// the HQ-managed MOEFAS rules. Rates are percentages (0–100).
//
// On top of the tiers, the school groups the NATIONAL income bands (GHI and PCI, set by MOE) into need
// levels (HIGH / MED / LOW). Bands the ACTIVE MOEFAS policy already auto-grants are locked out of the
// grouping: those families get MOEFAS and can never hold SBFAS at the same time.
import { TODAY } from "../lib/fees";
import { SBFAS_TIERS, SBFAS_TIER_RATES, type SbfasTier } from "./sbfasApplications";
import { activeRuleOf, HOUSEHOLD_BANDS, PER_CAPITA_BANDS, type FasRule } from "./moefasRules";

export type SbfasRuleTier = { tier: SbfasTier; active: boolean; rate: number };
/** Need level a school assigns to an income band. Drives the AI suggestion; not a decision on its own. */
export type RiskLevel = "HIGH" | "MED" | "LOW";
export const RISK_LEVELS: RiskLevel[] = ["HIGH", "MED", "LOW"];

export type SbfasRule = {
  school: string;
  updated: string;
  tiers: SbfasRuleTier[];
  /** The school's level per national band (GHI then PCI, low → high); null = Not grouped. */
  grouping: { ghi: (RiskLevel | null)[]; pci: (RiskLevel | null)[] };
  /** The SBFAS tier each level recommends when a grouped band applies; null = no tier suggested. */
  levelTiers: Record<RiskLevel, SbfasTier | null>;
};

// ASSUMPTION: the default grouping mirrors the seeded Active MOEFAS rule (GHI ≤ band 2, PCI ≤ band 2 are
// MOEFAS territory) and groups the remaining bands by need. Schools adjust from here.
const DEFAULT_GROUPING = (): SbfasRule["grouping"] => ({
  ghi: HOUSEHOLD_BANDS.map((_, i) => (i <= 2 ? null : "LOW")) as (RiskLevel | null)[],
  pci: PER_CAPITA_BANDS.map((_, i) => (i <= 2 ? null : i === 3 ? "HIGH" : "MED")) as (RiskLevel | null)[],
});
const DEFAULT_LEVEL_TIERS = (): SbfasRule["levelTiers"] => ({ HIGH: "Tier 1", MED: "Tier 2", LOW: "Tier 3" });

// ASSUMPTION: default package mirrors the national reference (75/65/55/50); schools adjust from here.
export const defaultSbfasRule = (school: string, updated = "2026-09-01"): SbfasRule => ({
  school,
  updated,
  tiers: SBFAS_TIERS.map((t) => ({ tier: t, active: true, rate: Math.round(SBFAS_TIER_RATES[t] * 100) })),
  grouping: DEFAULT_GROUPING(),
  levelTiers: DEFAULT_LEVEL_TIERS(),
});

/** The school's rule, or the default package until the school saves its own. */
export const ruleForSchool = (rules: Record<string, SbfasRule>, school: string): SbfasRule =>
  rules[school] ?? defaultSbfasRule(school);

/**
 * Fractional rate applied to charges for a student decided at this tier (0.75 = 75%). Returned even when
 * the tier was later switched off: `active` gates new assignments, decisions already made keep their rate.
 */
export const tierRate = (rule: SbfasRule, tier: SbfasTier): number | undefined => {
  const t = rule.tiers.find((x) => x.tier === tier);
  return t ? t.rate / 100 : undefined;   // per-component subsidy rounds to cents in makeCharge
};

/** Band indexes the ACTIVE MOEFAS policy auto-grants — locked out of the school's grouping. */
export function moefasCoveredBands(rules: FasRule[]): { ghi: number[]; pci: number[] } {
  const rule = activeRuleOf(rules);
  if (!rule || !rule.tiers.length) return { ghi: [], pci: [] };
  const h = Math.max(...rule.tiers.map((t) => t.household));
  const p = Math.max(...rule.tiers.map((t) => t.perCapita));
  return {
    ghi: HOUSEHOLD_BANDS.map((_, i) => i).filter((i) => i <= h),
    pci: PER_CAPITA_BANDS.map((_, i) => i).filter((i) => i <= p),
  };
}

const NEED: Record<RiskLevel, number> = { HIGH: 3, MED: 2, LOW: 1 };

/** The needier of the two band levels wins — the same match-any spirit as the MOEFAS criteria. Null when neither band is grouped. */
export function levelForBands(rule: SbfasRule, ghi: number | null, pci: number | null): RiskLevel | null {
  const g = ghi != null ? (rule.grouping.ghi[ghi] ?? null) : null;
  const p = pci != null ? (rule.grouping.pci[pci] ?? null) : null;
  if (!g && !p) return null;
  if (!g) return p;
  if (!p) return g;
  return NEED[g] >= NEED[p] ? g : p;
}

/** The tier the school's grouping suggests for a family's bands; null = no tier to give (the school decides). */
export function tierForBands(rule: SbfasRule, ghi: number | null, pci: number | null): SbfasTier | null {
  const level = levelForBands(rule, ghi, pci);
  return level ? (rule.levelTiers[level] ?? null) : null;
}

/** Editing state; rates stay strings until save. grouping/levelTiers are optional so tier-only callers keep compiling. */
export type SbfasRuleDraft = {
  tiers: { active: boolean; rate: string }[];
  grouping?: { ghi: (RiskLevel | null)[]; pci: (RiskLevel | null)[] };
  levelTiers?: Record<RiskLevel, SbfasTier | null>;
};
export type SbfasRuleErrors = { tiers?: string; grouping?: string; rows: Record<number, string> };

export const draftOfSbfasRule = (rule: SbfasRule): SbfasRuleDraft => ({
  tiers: rule.tiers.map((t) => ({ active: t.active, rate: String(t.rate) })),
  grouping: { ghi: [...rule.grouping.ghi], pci: [...rule.grouping.pci] },
  levelTiers: { ...rule.levelTiers },
});

/** Every tier needs a rate of 0–100 (max 2 decimals), the school must keep at least one tier offered, and at least one band must be grouped. */
export function validateSbfasRule(d: SbfasRuleDraft): SbfasRuleErrors {
  const errors: SbfasRuleErrors = { rows: {} };
  d.tiers.forEach((t, i) => {
    if (!/^\d{1,3}(\.\d{1,2})?$/.test(t.rate.trim()) || Number(t.rate) < 0 || Number(t.rate) > 100) {
      errors.rows[i] = "Enter a rate between 0 and 100 (max 2 decimals).";
    }
  });
  if (!d.tiers.some((t) => t.active)) errors.tiers = "Keep at least one tier offered.";
  if (d.grouping && ![...d.grouping.ghi, ...d.grouping.pci].some(Boolean)) {
    errors.grouping = "Group at least one income band into a level before saving.";
  }
  return errors;
}

export const sbfasRuleOk = (e: SbfasRuleErrors) => !e.tiers && !e.grouping && !Object.keys(e.rows).length;

export function toSbfasRule(d: SbfasRuleDraft, school: string, updated = TODAY): SbfasRule {
  return {
    school,
    updated,
    tiers: d.tiers.map((t, i) => ({ tier: SBFAS_TIERS[i], active: t.active, rate: Number(t.rate) })),
    grouping: d.grouping ?? DEFAULT_GROUPING(),
    levelTiers: d.levelTiers ?? DEFAULT_LEVEL_TIERS(),
  };
}

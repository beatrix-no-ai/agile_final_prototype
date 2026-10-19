// School-defined SBFAS package (Requirement 4, school side): each school decides which tiers it offers
// and the subsidy rate per tier, from its own internal funds. MOE never configures this — contrast with
// the HQ-managed MOEFAS rules. Rates are percentages (0–100).
import { TODAY } from "../lib/fees";
import { SBFAS_TIERS, SBFAS_TIER_RATES, type SbfasTier } from "./sbfasApplications";

export type SbfasRuleTier = { tier: SbfasTier; active: boolean; rate: number };
export type SbfasRule = { school: string; updated: string; tiers: SbfasRuleTier[] };

// ASSUMPTION: default package mirrors the national reference (75/65/55/50); schools adjust from here.
export const defaultSbfasRule = (school: string, updated = "2026-09-01"): SbfasRule => ({
  school,
  updated,
  tiers: SBFAS_TIERS.map((t) => ({ tier: t, active: true, rate: Math.round(SBFAS_TIER_RATES[t] * 100) })),
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

/** Editing state; rates stay strings until save. */
export type SbfasRuleDraft = { tiers: { active: boolean; rate: string }[] };
export type SbfasRuleErrors = { tiers?: string; rows: Record<number, string> };

export const draftOfSbfasRule = (rule: SbfasRule): SbfasRuleDraft => ({
  tiers: rule.tiers.map((t) => ({ active: t.active, rate: String(t.rate) })),
});

/** Every tier needs a rate of 0–100 (max 2 decimals) and the school must keep at least one tier offered. */
export function validateSbfasRule(d: SbfasRuleDraft): SbfasRuleErrors {
  const errors: SbfasRuleErrors = { rows: {} };
  d.tiers.forEach((t, i) => {
    if (!/^\d{1,3}(\.\d{1,2})?$/.test(t.rate.trim()) || Number(t.rate) < 0 || Number(t.rate) > 100) {
      errors.rows[i] = "Enter a rate between 0 and 100 (max 2 decimals).";
    }
  });
  if (!d.tiers.some((t) => t.active)) errors.tiers = "Keep at least one tier offered.";
  return errors;
}

export const sbfasRuleOk = (e: SbfasRuleErrors) => !e.tiers && !Object.keys(e.rows).length;

export function toSbfasRule(d: SbfasRuleDraft, school: string, updated = TODAY): SbfasRule {
  return { school, updated, tiers: d.tiers.map((t, i) => ({ tier: SBFAS_TIERS[i], active: t.active, rate: Number(t.rate) })) };
}

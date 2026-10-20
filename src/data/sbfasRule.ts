// School-defined SBFAS package (Requirement 4, school side): each school decides how many tiers it offers
// and each tier's subsidy — a percentage of the fee or a fixed S$ amount — from its own internal funds.
// MOE never configures this — contrast with the HQ-managed MOEFAS rules.
//
// On top of the tiers, the school groups the NATIONAL income bands (GHI and PCI, set by MOE) into need
// levels (HIGH / MED / LOW). Bands the ACTIVE MOEFAS policy already auto-grants are locked out of the
// grouping: those families get MOEFAS and can never hold SBFAS at the same time.
import { TODAY } from "../lib/fees";
import { SBFAS_TIERS, SBFAS_TIER_RATES, type SbfasTier } from "./sbfasApplications";
import { activeRuleOf, HOUSEHOLD_BANDS, PER_CAPITA_BANDS, type FasRule } from "./moefasRules";

/** What a tier's `rate` means: a percentage of each fee, or a fixed S$ amount off each fee. */
export type SubsidyBasis = "percent" | "fixed";
export type SbfasRuleTier = { tier: SbfasTier; basis?: SubsidyBasis; rate: number };
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
  tiers: SBFAS_TIERS.map((t) => ({ tier: t, basis: "percent", rate: Math.round((SBFAS_TIER_RATES[t] ?? 0) * 100) })),
  grouping: DEFAULT_GROUPING(),
  levelTiers: DEFAULT_LEVEL_TIERS(),
});

/** The school's rule, or the default package until the school saves its own. */
export const ruleForSchool = (rules: Record<string, SbfasRule>, school: string): SbfasRule =>
  rules[school] ?? defaultSbfasRule(school);

/**
 * Subsidy definition of one tier as saved: a percent of the fee (0–100) or a fixed S$ amount. Undefined
 * when the rule has no such tier (e.g. a decision referencing a tier the school later removed).
 */
export const tierSubsidy = (rule: SbfasRule, tier: SbfasTier): { basis: SubsidyBasis; value: number } | undefined => {
  const t = rule.tiers.find((x) => x.tier === tier);
  return t ? { basis: t.basis ?? "percent", value: t.rate } : undefined;
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
  tiers: { basis: SubsidyBasis; rate: string }[];
  grouping?: { ghi: (RiskLevel | null)[]; pci: (RiskLevel | null)[] };
  levelTiers?: Record<RiskLevel, SbfasTier | null>;
};
export type SbfasRuleErrors = { tiers?: string; grouping?: string; rows: Record<number, string>; levelRows?: Record<RiskLevel, string> };

export const draftOfSbfasRule = (rule: SbfasRule): SbfasRuleDraft => ({
  tiers: rule.tiers.map((t) => ({ basis: t.basis ?? "percent", rate: String(t.rate) })),
  grouping: { ghi: [...rule.grouping.ghi], pci: [...rule.grouping.pci] },
  levelTiers: { ...rule.levelTiers },
});

/**
 * Each tier needs a valid value for its basis — a rate of 0–100 (max 2 decimals) when percent, an amount
 * of at least 0 (max 2 decimals) when fixed. The school must keep at least one tier, at least one band
 * must be grouped, and every level must point at a tier that still exists.
 */
export function validateSbfasRule(d: SbfasRuleDraft): SbfasRuleErrors {
  const errors: SbfasRuleErrors = { rows: {} };
  d.tiers.forEach((t, i) => {
    const re = t.basis === "fixed" ? /^\d{1,6}(\.\d{1,2})?$/ : /^\d{1,3}(\.\d{1,2})?$/;
    if (!re.test(t.rate.trim()) || Number(t.rate) < 0 || (t.basis !== "fixed" && Number(t.rate) > 100)) {
      errors.rows[i] = t.basis === "fixed"
        ? "Enter an amount of at least 0 (max 2 decimals)."
        : "Enter a rate between 0 and 100 (max 2 decimals).";
    }
  });
  if (!d.tiers.length) errors.tiers = "Keep at least one tier.";
  if (d.grouping && ![...d.grouping.ghi, ...d.grouping.pci].some(Boolean)) {
    errors.grouping = "Group at least one income band into a level before saving.";
  }
  if (d.levelTiers) {
    for (const l of RISK_LEVELS) {
      const t = d.levelTiers[l];
      if (t && !d.tiers.some((_, i) => `Tier ${i + 1}` === t)) {
        errors.levelRows = { ...errors.levelRows, [l]: "Pick the tier this level suggests." } as Record<RiskLevel, string>;
      }
    }
  }
  return errors;
}

export const sbfasRuleOk = (e: SbfasRuleErrors) =>
  !e.tiers && !e.grouping && !Object.keys(e.rows).length && !Object.values(e.levelRows ?? {}).some(Boolean);

export function toSbfasRule(d: SbfasRuleDraft, school: string, updated = TODAY): SbfasRule {
  return {
    school,
    updated,
    tiers: d.tiers.map((t, i) => ({ tier: `Tier ${i + 1}` as SbfasTier, basis: t.basis, rate: Number(t.rate) })),
    grouping: d.grouping ?? DEFAULT_GROUPING(),
    levelTiers: d.levelTiers ?? DEFAULT_LEVEL_TIERS(),
  };
}

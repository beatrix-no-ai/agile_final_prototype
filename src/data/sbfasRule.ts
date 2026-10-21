// School-defined SBFAS package (Requirement 4, school side): each school decides how many tiers it offers
// and each tier's subsidy — a percentage of the fee or a fixed S$ amount — from its own internal funds.
// MOE never configures this — contrast with the HQ-managed MOEFAS rules.
//
// On top of the tiers, the school groups the NATIONAL income bands (GHI and PCI, set by MOE) into need
// levels (HIGH / MED / LOW). Tiers HQ assigns to MOEFAS are locked out of the
// grouping: those families get MOEFAS and can never hold SBFAS at the same time.
import { TODAY } from "../lib/fees";
import { SBFAS_TIERS, SBFAS_TIER_RATES, type SbfasTier } from "./sbfasApplications";
import { defaultTiers, type TierConfig, type TierKind } from "./moefas";

/** What a tier's `rate` means: a percentage of each fee, or a fixed S$ amount off each fee. */
export type SubsidyBasis = "percent" | "fixed";
/** Per fee-component rates for a tier (same basis as the tier); absent = the flat `rate` applies to every component. */
export type ComponentRates = Record<string, number>;
export type SbfasRuleTier = { tier: SbfasTier; basis?: SubsidyBasis; rate: number; components?: ComponentRates };
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

// ASSUMPTION: the default grouping follows HQ's default income tiers (MOEFAS tiers stay ungrouped) and groups the
// SBFAS tiers by need: GHI all LOW; PCI first tier HIGH, the rest MED. Schools adjust from here.
const DEFAULT_GROUPING = (): SbfasRule["grouping"] => {
  const t = defaultTiers();
  const level = (k: TierKind, i: number): RiskLevel | null =>
    t[k].schemes[i] === "MOEFAS" ? null : k === "ghi" ? "LOW" : t[k].schemes[i - 1] === "MOEFAS" ? "HIGH" : "MED";
  return { ghi: t.ghi.ranges.map((_, i) => level("ghi", i)), pci: t.pci.ranges.map((_, i) => level("pci", i)) };
};
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

/**
 * Human summary of a tier's subsidy across fee components — "75%" when uniform (or no per-component rates),
 * a "50–75%" range when components differ. Used wherever one line must describe the tier.
 */
export const subsidySummary = (t: { basis?: SubsidyBasis; rate?: number; components?: ComponentRates }): string => {
  const vals = t.components && Object.keys(t.components).length ? Object.values(t.components) : t.rate != null ? [t.rate] : [];
  if (!vals.length) return "";
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  if (lo === hi) return t.basis === "fixed" ? `S$${lo}` : `${lo}%`;
  return t.basis === "fixed" ? `S$${lo}–${hi}` : `${lo}–${hi}%`;
};

/** Tier indexes HQ assigns to MOEFAS — those families are auto-granted, so they are locked out of the school's grouping. */
export function moefasCoveredBands(tiers: TierConfig): { ghi: number[]; pci: number[] } {
  const covered = (k: TierKind) => tiers[k].schemes.flatMap((s, i) => (s === "MOEFAS" ? [i] : []));
  return { ghi: covered("ghi"), pci: covered("pci") };
}

const NEED: Record<RiskLevel, number> = { HIGH: 3, MED: 2, LOW: 1 };

/** SBFAS tiers are RANKS on screen — never "Tier N", which is the MOE income-band vocabulary. */
export const rankOf = (t: SbfasTier | null | undefined) => (t ? `Rank ${String(t).replace(/\D/g, "")}` : "");

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
  tiers: { basis: SubsidyBasis; rate: string; components?: Record<string, string> }[];
  grouping?: { ghi: (RiskLevel | null)[]; pci: (RiskLevel | null)[] };
  levelTiers?: Record<RiskLevel, SbfasTier | null>;
};
export type SbfasRuleErrors = { tiers?: string; grouping?: string; rows: Record<number, string>; levelRows?: Record<RiskLevel, string> };

/** Draft of a saved rule; per-component rates default to the tier's flat rate for any component it does not set. */
export const draftOfSbfasRule = (rule: SbfasRule, compNames: string[] = []): SbfasRuleDraft => ({
  tiers: rule.tiers.map((t) => ({
    basis: t.basis ?? "percent",
    rate: String(t.rate),
    ...(compNames.length ? { components: Object.fromEntries(compNames.map((n) => [n, String(t.components?.[n] ?? t.rate)])) } : {}),
  })),
  grouping: { ghi: [...rule.grouping.ghi], pci: [...rule.grouping.pci] },
  levelTiers: { ...rule.levelTiers },
});

/**
 * Each tier needs a valid value for its basis — a rate of 0–100 (max 2 decimals) when percent, an amount
 * of at least 0 (max 2 decimals) when fixed — for the flat rate and every per-component rate. The school
 * must keep at least one tier, at least one band must be grouped, and every level must point at a tier
 * that still exists.
 */
export function validateSbfasRule(d: SbfasRuleDraft): SbfasRuleErrors {
  const errors: SbfasRuleErrors = { rows: {} };
  const valid = (v: string, basis: SubsidyBasis) => {
    const re = basis === "fixed" ? /^\d{1,6}(\.\d{1,2})?$/ : /^\d{1,3}(\.\d{1,2})?$/;
    return re.test(v.trim()) && Number(v) >= 0 && (basis === "fixed" || Number(v) <= 100);
  };
  d.tiers.forEach((t, i) => {
    const bad = [t.rate, ...Object.values(t.components ?? {})].some((v) => !valid(v, t.basis));
    if (bad) {
      errors.rows[i] = t.basis === "fixed"
        ? "Enter an amount of at least 0 (max 2 decimals) for every component."
        : "Enter a rate between 0 and 100 (max 2 decimals) for every component.";
    }
  });
  if (!d.tiers.length) errors.tiers = "Keep at least one rank.";
  if (d.grouping && ![...d.grouping.ghi, ...d.grouping.pci].some(Boolean)) {
    errors.grouping = "Group at least one income band into a level before saving.";
  }
  if (d.levelTiers) {
    for (const l of RISK_LEVELS) {
      const t = d.levelTiers[l];
      if (t && !d.tiers.some((_, i) => `Tier ${i + 1}` === t)) {
        errors.levelRows = { ...errors.levelRows, [l]: "Pick the rank this level suggests." } as Record<RiskLevel, string>;
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
    tiers: d.tiers.map((t, i) => ({
      tier: `Tier ${i + 1}` as SbfasTier,
      basis: t.basis,
      rate: Number(t.rate),
      ...(t.components ? { components: Object.fromEntries(Object.entries(t.components).map(([n, v]) => [n, Number(v)])) } : {}),
    })),
    grouping: d.grouping ?? DEFAULT_GROUPING(),
    levelTiers: d.levelTiers ?? DEFAULT_LEVEL_TIERS(),
  };
}

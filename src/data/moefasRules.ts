// MOEFAS HQ policy and family applications (Requirement 4), ported from the standalone MOEFAS_UI mock
// and wired to this app's real data: MOE master fee types (MFT-*), schools and the mock calendar.
import { TODAY } from "../lib/fees";
import { FEE_TYPES, MASTER, type FeeType } from "./fees";
import { SCHOOLS } from "./schools";
import { schoolOfLevel } from "./schoolMgmt";
import type { Level } from "./students";
import { formatSGD } from "../lib/format";

/** Gross monthly household income bands (S$), ordered low → high. Only the index is stored, never exact income. */
export const HOUSEHOLD_BANDS = ["Up to S$1,500", "S$1,501 - S$2,500", "S$2,501 - S$4,000", "Above S$4,000"] as const;
/** Per-capita monthly income bands (S$), ordered low → high. */
export const PER_CAPITA_BANDS = ["Up to S$450", "S$451 - S$750", "S$751 - S$1,000", "S$1,001 - S$1,500", "Above S$1,500"] as const;

export const bandLabel = (bands: readonly string[], i: number | null) => (i == null ? "Unavailable" : bands[i]);

export type RuleStatus = "Active" | "Inactive" | "Draft";
export type IncomeLogic = "AND" | "OR";
/** One eligibility tier: the highest accepted band for household and per-capita income; all lower bands also pass. */
export type TierRule = { household: number; perCapita: number };
export type SubsidyBasis = "percent" | "fixed";
/** One subsidised component of one MOE master fee type, with one amount per tier. */
export type RuleLine = { ftId: string; component: string; basis: SubsidyBasis; amounts: number[] };
export type FasRule = {
  id: string;
  name: string;
  status: RuleStatus;
  from: string;
  to: string;
  logic: IncomeLogic;
  tiers: TierRule[];
  lines: RuleLine[];
};

/** MOE master fee types eligible for MOEFAS subsidies; school-created fee types never are. */
export const masterFeeTypes = (): FeeType[] => FEE_TYPES.filter((f) => f.school === MASTER);
export const feeTypeOf = (ftId: string) => FEE_TYPES.find((f) => f.id === ftId);

const T2: TierRule[] = [{ household: 0, perCapita: 0 }, { household: 2, perCapita: 2 }];

// ASSUMPTION: seeded rules mirror the demo policy (one Active per year); percentages and amounts are invented.
export const FAS_RULES: FasRule[] = [
  {
    id: "FASR9001", name: "MOEFAS 2026 — Standard assistance", status: "Active",
    from: "2026-01-01", to: "2026-12-31", logic: "AND", tiers: T2.map((t) => ({ ...t })),
    lines: [
      { ftId: "MFT-01", component: "Tuition Fee", basis: "percent", amounts: [80, 50] },
      { ftId: "MFT-01", component: "Miscellaneous Fee", basis: "fixed", amounts: [20, 10] },
      { ftId: "MFT-02", component: "Tuition Fee", basis: "percent", amounts: [80, 50] },
      { ftId: "MFT-02", component: "Miscellaneous Fee", basis: "fixed", amounts: [20, 10] },
    ],
  },
  {
    id: "FASR9002", name: "MOEFAS 2025 — Standard assistance", status: "Inactive",
    from: "2025-01-01", to: "2025-12-31", logic: "AND", tiers: T2.map((t) => ({ ...t })),
    lines: [
      { ftId: "MFT-01", component: "Examination Fee", basis: "percent", amounts: [75, 40] },
      { ftId: "MFT-02", component: "Examination Fee", basis: "percent", amounts: [75, 40] },
    ],
  },
  {
    id: "FASR9003", name: "MOEFAS 2027 — Proposed assistance", status: "Draft",
    from: "2027-01-01", to: "2027-12-31", logic: "OR", tiers: T2.map((t) => ({ ...t })),
    lines: [
      { ftId: "MFT-03", component: "Math Enrichment", basis: "percent", amounts: [60, 30] },
      { ftId: "MFT-04", component: "Miscellaneous Fee", basis: "fixed", amounts: [15, 8] },
    ],
  },
];

/** Income as retrieved from the third-party API: band indexes only, null while the sync has not returned them. */
export type FamilyIncome = { household: number | null; perCapita: number | null; syncedOn: string; failed: boolean };
export type MoefasChild = {
  name: string;
  level: Level;
  /** Enrolment record still incomplete — the assessment waits even when the family's income is in. */
  missingInfo?: boolean;
};
export type MoefasFamily = {
  id: string;
  parent: string;
  spouse: string;
  contact: string;
  address: string;
  /** "Additional information" the parent attached to the submission. */
  note: string;
  submittedOn: string;
  income: FamilyIncome;
  children: MoefasChild[];
};

// ASSUMPTION: families 2-4 are invented demo data (family 1 mirrors the parent e-Service demo account).
// Schools are derived from each child's level, so every name matches this app's S001/S002 universe.
export const MOEFAS_FAMILIES: MoefasFamily[] = [
  {
    id: "FAS20260001", parent: "Rachel Lim", spouse: "David Lim", contact: "+65 9123 4567",
    address: "Blk 214 Bishan Street 23, #08-112, Singapore 570214",
    note: "Household income reduced since August; two children in school.",
    submittedOn: "2026-10-08", income: { household: 2, perCapita: 2, syncedOn: "2026-10-08", failed: false },
    children: [{ name: "Ethan Lim", level: "P5" }, { name: "Chloe Lim", level: "Sec 2" }],
  },
  {
    id: "FAS20260002", parent: "Nur Aisyah Binte Abdullah", spouse: "Muhammad Farhan", contact: "+65 9234 5678",
    address: "Blk 512 Tampines Central 1, #05-118, Singapore 520512", note: "No additional information provided.",
    submittedOn: "2026-10-08", income: { household: 3, perCapita: 3, syncedOn: "2026-10-08", failed: false },
    children: [{ name: "Adam Muhammad", level: "P4" }],
  },
  {
    id: "FAS20260003", parent: "Priya Nair", spouse: "Arun Nair", contact: "+65 9345 6789",
    address: "Blk 301 Clementi Avenue 4, #07-102, Singapore 120301", note: "No additional information provided.",
    submittedOn: "2026-10-08", income: { household: null, perCapita: null, syncedOn: "2026-10-08", failed: true },
    children: [{ name: "Arjun Nair", level: "Sec 1" }],
  },
  {
    id: "FAS20260004", parent: "Michelle Tan", spouse: "Daniel Tan", contact: "+65 9456 7890",
    address: "Blk 118 Toa Payoh Lorong 1, #09-210, Singapore 310118", note: "No additional information provided.",
    submittedOn: "2026-10-08", income: { household: 2, perCapita: 2, syncedOn: "2026-10-08", failed: false },
    children: [{ name: "Lucas Tan Wei Jie", level: "P6" }, { name: "Emma Tan Hui Min", level: "Sec 3", missingInfo: true }],
  },
];

export const activeRuleOf = (rules: FasRule[]) => rules.find((r) => r.status === "Active") ?? null;

/** A tier accepts its chosen household/per-capita band and every lower band; AND needs both conditions, OR either. */
export function tierAccepts(logic: IncomeLogic, t: TierRule, household: number, perCapita: number): boolean {
  return logic === "AND"
    ? household <= t.household && perCapita <= t.perCapita
    : household <= t.household || perCapita <= t.perCapita;
}

export type ChildOutcome =
  | { kind: "granted"; tier: number } // 0-based tier index
  | { kind: "sbfas" }
  | { kind: "awaiting"; reason: "income" | "student-info" };

/** First matching tier wins (Tier 1 is the strongest package). No active policy → the school decides on SBFAS. */
export function assessChild(rule: FasRule | null, income: FamilyIncome, child: MoefasChild): ChildOutcome {
  if (child.missingInfo) return { kind: "awaiting", reason: "student-info" };
  if (income.failed || income.household == null || income.perCapita == null) return { kind: "awaiting", reason: "income" };
  if (rule) {
    for (let i = 0; i < rule.tiers.length; i++) {
      if (tierAccepts(rule.logic, rule.tiers[i], income.household, income.perCapita)) return { kind: "granted", tier: i };
    }
  }
  return { kind: "sbfas" };
}

export type FamilyOutcome = "MOEFAS granted" | "SBFAS review" | "Awaiting income data" | "Mixed outcomes";

/** Family headline: every child with the same result → that label; any mix → Mixed outcomes. */
export function familyOutcome(outcomes: ChildOutcome[]): FamilyOutcome {
  const only = (k: ChildOutcome["kind"]) => outcomes.length > 0 && outcomes.every((o) => o.kind === k);
  if (only("granted")) return "MOEFAS granted";
  if (only("sbfas")) return "SBFAS review";
  if (only("awaiting")) return "Awaiting income data";
  return "Mixed outcomes";
}

/** The child's school name (P-levels → Riverbank Primary S002, Sec → Greenfield Secondary S001). */
export const schoolNameOf = (level: Level) => SCHOOLS.find((s) => s.code === schoolOfLevel(level))?.name ?? "—";

export type ImpactRow = { label: string; detail: string; source: "MOE master" | "School-created"; fee: number; subsidy: number };
export type FeeImpact = { rows: ImpactRow[]; fee: number; subsidy: number; payable: number };

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Preview of one child's next charge under the granted tier: MOE master components subsidised by the rule,
 * plus the school's own fee type, which MOEFAS never subsidises. A preview only — no charge is issued.
 */
export function feeImpact(rule: FasRule, level: Level, tier: number): FeeImpact {
  const scope = level.startsWith("P") ? "Primary" : "Secondary";
  const master = FEE_TYPES.find((f) => f.school === MASTER && f.scope === scope && f.name.startsWith("School Fees"));
  const schoolFt = FEE_TYPES.find((f) => f.school === schoolOfLevel(level) && !f.level);
  const rows: ImpactRow[] = [];
  if (master) {
    for (const c of master.components) {
      const line = rule.lines.find((l) => l.ftId === master.id && l.component === c.name);
      const subsidy = line
        ? line.basis === "percent"
          ? r2((c.amount * line.amounts[tier]) / 100)
          : Math.min(line.amounts[tier], c.amount)
        : 0;
      rows.push({
        label: c.name,
        detail: line
          ? `${line.basis === "percent" ? `${line.amounts[tier]}%` : formatSGD(line.amounts[tier])} · ${master.id}`
          : "No subsidy mapping",
        source: "MOE master",
        fee: c.amount,
        subsidy,
      });
    }
  }
  if (schoolFt) {
    rows.push({
      label: schoolFt.name,
      detail: `${schoolFt.id} · school-created`,
      source: "School-created",
      fee: r2(schoolFt.components.reduce((t, c) => t + c.amount, 0)),
      subsidy: 0,
    });
  }
  const fee = r2(rows.reduce((t, x) => t + x.fee, 0));
  const subsidy = r2(rows.reduce((t, x) => t + x.subsidy, 0));
  return { rows, fee, subsidy, payable: r2(fee - subsidy) };
}

/** Editing state for the rule form; amounts stay strings until save. */
export type RuleLineDraft = { ftId: string; component: string; basis: SubsidyBasis; amounts: string[] };
export type RuleDraft = { name: string; from: string; to: string; logic: IncomeLogic; tiers: TierRule[]; lines: RuleLineDraft[] };
export type RuleErrors = { name?: string; period?: string; lines?: string; rows: Record<number, string> };

const DEFAULT_DRAFT: RuleDraft = {
  name: "MOEFAS", from: "2026-01-01", to: "2026-12-31", logic: "AND",
  tiers: T2.map((t) => ({ ...t })), lines: [],
};

export const draftOf = (rule: FasRule | null): RuleDraft =>
  rule
    ? {
        name: rule.name, from: rule.from, to: rule.to, logic: rule.logic,
        tiers: rule.tiers.map((t) => ({ ...t })),
        lines: rule.lines.map((l) => ({ ...l, amounts: l.amounts.map(String) })),
      }
    : structuredClone(DEFAULT_DRAFT);

/** Unticked rows are ignored by the save; each line needs a component and a valid amount for every tier. */
export function validateRule(d: RuleDraft): RuleErrors {
  const errors: RuleErrors = { rows: {} };
  if (!d.name.trim()) errors.name = "Enter a rule name.";
  if (!d.from || !d.to) errors.period = "Enter the effective period.";
  else if (d.from > d.to) errors.period = "Effective to must be on or after effective from.";
  if (!d.lines.length) errors.lines = "Select at least one MOE master fee type.";
  d.lines.forEach((l, i) => {
    if (!l.component) {
      errors.rows[i] = "Select a component.";
      return;
    }
    const amount = l.basis === "percent" ? "Enter 0 – 100 for every tier (max 2 decimals)." : "Enter an amount of at least 0 (max 2 decimals).";
    if (l.amounts.some((a) => !/^\d{1,9}(\.\d{1,2})?$/.test(a.trim())) || l.amounts.some((a) => Number(a) < 0)) errors.rows[i] = amount;
    else if (l.basis === "percent" && l.amounts.some((a) => Number(a) > 100)) errors.rows[i] = amount;
  });
  return errors;
}

export const ruleOk = (e: RuleErrors) => !e.name && !e.period && !e.lines && !Object.keys(e.rows).length;

/** Saves a draft back into a FasRule; the status never changes on save (new rules start as Draft). */
export function toRule(d: RuleDraft, id: string, status: RuleStatus): FasRule {
  return {
    id, name: d.name.trim(), status, from: d.from, to: d.to, logic: d.logic,
    tiers: d.tiers.map((t) => ({ ...t })),
    lines: d.lines.map((l) => ({ ftId: l.ftId, component: l.component, basis: l.basis, amounts: l.amounts.map(Number) })),
  };
}

export const nextRuleId = (rules: Pick<FasRule, "id">[]) =>
  `FASR${String(rules.reduce((m, r) => Math.max(m, Number(r.id.replace(/\D/g, "")) || 0), 9000) + 1).padStart(4, "0")}`;

/** Insert or update in place; the status is whatever the caller saved with. */
export function saveRule(rules: FasRule[], rule: FasRule): FasRule[] {
  return rules.some((r) => r.id === rule.id) ? rules.map((r) => (r.id === rule.id ? rule : r)) : [...rules, rule];
}

/**
 * Only one rule can be Active at a time: activating makes the previous Active rule Inactive, and previous
 * application outcomes stay unchanged. Rejected when today falls outside the rule's effective period.
 */
export function activateRule(rules: FasRule[], id: string, today = TODAY): { ok: true; rules: FasRule[] } | { ok: false; error: string } {
  const next = rules.find((r) => r.id === id);
  if (!next) return { ok: false, error: "Rule not found." };
  if (next.status === "Active") return { ok: false, error: "This rule is already Active." };
  if (today < next.from || today > next.to) {
    return { ok: false, error: "Activation requires today to be inside the rule's effective period. Edit the dates first." };
  }
  return {
    ok: true,
    rules: rules.map((r) => (r.id === id ? { ...r, status: "Active" } : r.status === "Active" ? { ...r, status: "Inactive" } : r)),
  };
}

/** Simulated MyInfo retry: the bands come back in the Tier 2 range, so the family is reassessed automatically. */
export function refreshIncome(families: MoefasFamily[], familyId: string, today = TODAY): MoefasFamily[] {
  return families.map((f) => (f.id === familyId ? { ...f, income: { household: 2, perCapita: 2, syncedOn: today, failed: false } } : f));
}

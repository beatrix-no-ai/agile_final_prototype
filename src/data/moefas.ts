import { useState } from "react";

// MOEFAS (HQ): central income tiers, the FAS rules built on them, and family applications assessed against a rule. All values are demo mock data.

// ---- Income tiers (GHI = household income, PCI = per-capita income) ----

export type Range = [number, number];
export type Scheme = "MOEFAS" | "SBFAS";
export type TierKind = "ghi" | "pci";
export type TierSet = { ranges: Range[]; schemes: Scheme[] };
export type TierConfig = Record<TierKind, TierSet>;

export const TIER_LIMIT = 999_999_999;
export const MAX_TIERS = 14;
export const SCHEMES: Scheme[] = ["MOEFAS", "SBFAS"];

const set = (ranges: Range[], moefas = 4): TierSet => ({ ranges, schemes: ranges.map((_, i) => (i < moefas ? "MOEFAS" : "SBFAS")) });
export const defaultTiers = (): TierConfig => ({
  ghi: set([[0, 2000], [2001, 3000], [3001, 4000], [4001, 4500], [4501, 5000], [5001, 5500], [5501, 6000], [6001, 6500], [6501, 7000], [7001, 7500], [7501, 9000], [9001, 10500], [10501, 12000], [12001, TIER_LIMIT]]),
  pci: set([[0, 500], [501, 750], [751, 1000], [1001, 1125], [1126, 1250], [1251, 1375], [1376, 1500], [1501, 1625], [1626, 1750], [1751, 1876], [1877, 2250], [2251, 2625], [2626, 3000], [3001, TIER_LIMIT]]),
});

const TIER_KEY = "moe-central-income-tiers-v2";
const validShape = (d: unknown): d is TierConfig =>
  !!d && (["ghi", "pci"] as const).every((k) => {
    const s = (d as TierConfig)[k];
    return Array.isArray(s?.ranges) && s.ranges.length > 0 && Array.isArray(s.schemes) && s.schemes.length === s.ranges.length;
  });

/** Tiers live in localStorage so edits survive a reload; falls back to the defaults. */
export function useTiers() {
  const [tiers, setState] = useState<TierConfig>(() => {
    try {
      const d = JSON.parse(localStorage.getItem(TIER_KEY) ?? "null");
      if (validShape(d)) return d;
    } catch { /* private mode / bad JSON: use the defaults */ }
    return defaultTiers();
  });
  const setTiers = (next: TierConfig): boolean => {
    try { localStorage.setItem(TIER_KEY, JSON.stringify(next)); } catch { return false; }
    setState(next);
    return true;
  };
  return [tiers, setTiers] as const;
}

/** Index of another tier whose range overlaps [lo, hi], or -1. NaN bounds never overlap. */
export function tierOverlap(ranges: Range[], i: number, lo: number, hi: number): number {
  if (![lo, hi].every(Number.isFinite)) return -1;
  return ranges.findIndex(([a, b], j) => j !== i && lo <= b && hi >= a);
}

/** Why a tier set cannot be saved, or "" when it can. */
export function tierProblem(cfg: TierConfig): string {
  for (const k of ["ghi", "pci"] as const) {
    const { ranges, schemes } = cfg[k], K = k.toUpperCase();
    if (ranges.length > MAX_TIERS) return `${K}: at most ${MAX_TIERS} tiers.`;
    if (!ranges.length || schemes.length !== ranges.length || schemes.some((s) => !SCHEMES.includes(s))) return `${K}: assign MOEFAS or SBFAS to every tier.`;
    for (let i = 0; i < ranges.length; i++) {
      const [lo, hi] = ranges[i];
      if (![lo, hi].every((x) => Number.isFinite(x) && x >= 0 && x <= TIER_LIMIT && Number.isInteger(x)) || lo > hi)
        return `${K} Tier ${i + 1}: enter valid amounts from 0 to 999,999,999, in whole dollars. Minimum cannot exceed maximum.`;
      const o = tierOverlap(ranges, i, lo, hi);
      if (o >= 0 && o < i) return `${K} Tier ${i + 1}: overlaps Tier ${o + 1}. Each range can only be configured once.`;
      if (i && lo <= ranges[i - 1][1]) return `${K} Tier ${i + 1}: ranges must be ascending and must not overlap.`;
    }
  }
  return "";
}

/** Kinds whose tiers leave some income amounts uncovered (a gap, or no tier from 0 or up to the limit). */
export const tierGaps = (cfg: TierConfig): TierKind[] =>
  (["ghi", "pci"] as const).filter((k) => {
    const a = cfg[k].ranges;
    return a[0][0] > 0 || a.at(-1)![1] < TIER_LIMIT || a.some((r, i) => i && r[0] > a[i - 1][1] + 1);
  });

export const tierAssigned = (s: TierSet, scheme: Scheme) =>
  s.schemes.flatMap((x, i) => (x === scheme ? [`Tier ${i + 1}`] : [])).join(", ") || "No tiers assigned";

/** Indexes of the tiers assigned to MOEFAS: the only ones a rule condition may use. */
export const allowedIds = (cfg: TierConfig, k: TierKind) => cfg[k].schemes.flatMap((s, i) => (s === "MOEFAS" ? [i] : []));

// ---- Fee components ----

export type FeeKind = "School fee" | "Miscellaneous fee" | "Examination fee";
export const FEE_KINDS: FeeKind[] = ["School fee", "Miscellaneous fee", "Examination fee"];
/** MOE master fee components. School-created components cannot be subsidised. */
export const CATALOGUE: { id: string; type: FeeKind; name: string; fee: number }[] = [
  { id: "MFC-001", type: "School fee", name: "Tuition", fee: 100 },
  { id: "MFC-002", type: "Miscellaneous fee", name: "Standard miscellaneous", fee: 20 },
  { id: "MFC-003", type: "Examination fee", name: "Examination", fee: 30 },
  { id: "MFC-004", type: "Miscellaneous fee", name: "Supplementary miscellaneous", fee: 10 },
];
export const componentName = (id: string) => CATALOGUE.find((c) => c.id === id)?.name ?? id;

// ---- FAS rules ----

export type Basis = "percent" | "fixed";
/** One subsidy row; one amount per condition. `id` is "" until the user picks a component for the fee type. */
export type RuleComponent = { id: string; type: FeeKind; basis: Basis; amounts: (number | "")[] };
/** Pending = activated with a future effective date; it becomes Active on that date. */
export type RuleStatus = "Active" | "Inactive" | "Draft" | "Pending" | "Canceled";
/** A child matches a condition when GHI OR PCI falls in the chosen tier. -1 = not chosen yet (drafts only). */
export type Condition = { ghi: number; pci: number };
/** `effectiveFrom` (YYYY-MM-DD): activating with a future date schedules the rule (Pending) until that date. */
export type Rule = { id: string; name: string; effectiveFrom?: string; status: RuleStatus; conditions: Condition[]; components: RuleComponent[] };

const comp = (id: string, basis: Basis, amounts: number[]): RuleComponent => ({ id, type: CATALOGUE.find((c) => c.id === id)!.type, basis, amounts });
const CONDITIONS = (): Condition[] => [{ ghi: 0, pci: 0 }, { ghi: 1, pci: 1 }];

export const blankRule = (id: string): Rule => ({ id, name: "", status: "Draft", conditions: CONDITIONS(), components: [] });

export const SEED: Rule[] = [
  { id: "FASR26100001", name: "MOEFAS 2026 — Standard assistance", effectiveFrom: "2026-01-01", status: "Active", conditions: CONDITIONS(), components: [comp("MFC-001", "percent", [80, 50]), comp("MFC-002", "fixed", [20, 10])] },
  { id: "FASR26100002", name: "MOEFAS 2025 — Standard assistance", effectiveFrom: "2025-01-01", status: "Inactive", conditions: CONDITIONS(), components: [comp("MFC-003", "percent", [75, 40])] },
  { id: "FASR26100003", name: "MOEFAS 2027 — Proposed assistance", effectiveFrom: "2027-01-01", status: "Pending", conditions: CONDITIONS(), components: [comp("MFC-001", "percent", [85, 55]), comp("MFC-002", "fixed", [20, 10])] },
  { id: "FASR26100004", name: "MOEFAS 2027 — Cancelled scheduled assistance", effectiveFrom: "2027-02-01", status: "Canceled", conditions: CONDITIONS(), components: [comp("MFC-001", "percent", [85, 55]), comp("MFC-002", "fixed", [20, 10])] },
];

const KEY = "moefas-conditions-or-v4";

/** Rules live in localStorage so edits survive a reload; falls back to the seed. */
export function useRules() {
  const [rules, set] = useState<Rule[]>(() => {
    try {
      const d = JSON.parse(localStorage.getItem(KEY) ?? "null");
      if (Array.isArray(d) && d.length && d.every((r) => Array.isArray(r?.conditions))) return promoteDue(d, sgToday());
    } catch { /* private mode / bad JSON: use the seed */ }
    return SEED;
  });
  const setRules = (next: Rule[]) => {
    set(next);
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* session only */ }
  };
  return [rules, setRules] as const;
}

/** Today in Singapore as YYYY-MM-DD. */
export const sgToday = (now = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Singapore" }).format(now);

/** Pending rules whose effective date has come become Active, the latest-dated one last so it wins. */
export const promoteDue = (rules: Rule[], today: string): Rule[] =>
  rules.filter((r) => r.status === "Pending" && (r.effectiveFrom ?? "") <= today)
    .sort((a, b) => (a.effectiveFrom ?? "").localeCompare(b.effectiveFrom ?? ""))
    .reduce((acc, r) => activateRule(acc, r.id), rules);

/** Only one rule is Active: activating one makes the previous Active rule Inactive. */
export const activateRule = (rules: Rule[], id: string): Rule[] =>
  rules.map((r) => ({ ...r, status: r.id === id ? "Active" : r.status === "Active" ? "Inactive" : r.status }));

/** FASR + YYMM (Singapore) + 4-digit sequence within the month. */
export function nextRuleId(rules: Rule[], now = new Date()): string {
  const p = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Singapore", year: "2-digit", month: "2-digit" }).formatToParts(now);
  const prefix = "FASR" + p.find((x) => x.type === "year")!.value + p.find((x) => x.type === "month")!.value;
  const n = Math.max(0, ...rules.filter((r) => r.id.startsWith(prefix)).map((r) => Number(r.id.slice(-4)))) + 1;
  if (n > 9999) throw new Error("Monthly rule ID limit reached.");
  return prefix + String(n).padStart(4, "0");
}

/** Why the conditions are invalid, or "". `partial` (drafts) lets a tier be left unchosen. */
export function conditionProblem(conds: Condition[], tiers: TierConfig, partial = false): string {
  if (!conds.length) return "Add at least one condition.";
  for (const k of ["ghi", "pci"] as const) {
    const label = k.toUpperCase(), seen = new Map<number, number>();
    for (let i = 0; i < conds.length; i++) {
      const id = conds[i][k];
      if (id < 0) { if (partial) continue; return `Condition ${i + 1}: select a ${label} tier.`; }
      if (!allowedIds(tiers, k).includes(id)) return `Condition ${i + 1}: ${label} Tier ${id + 1} is not available for MOEFAS.`;
      const prev = seen.get(id);
      if (prev) return `Condition ${prev} and Condition ${i + 1} both use ${label} Tier ${id + 1}. Each tier can only be used in one condition.`;
      seen.set(id, i + 1);
    }
  }
  return "";
}

/** Why a rule cannot be saved (draft = lenient) or activated (full), or "". */
export function ruleProblem(r: Rule, tiers: TierConfig, draft = false): string {
  if (!r.name.trim()) return "Enter a rule name.";
  const c = conditionProblem(r.conditions, tiers, draft);
  if (c || draft) return c;
  if (!r.components.length || r.components.some((x) => !x.id || !CATALOGUE.some((f) => f.id === x.id))) return "Choose MOE fee components for all rows.";
  if (r.components.some((x) => x.amounts.some((a) => typeof a !== "number" || !Number.isFinite(a) || a < 0 || (x.basis === "percent" && a > 100)))) return "Enter valid subsidy values (0–100 for percentage).";
  return "";
}

/** Saving tiers must not move or re-assign a tier that a saved rule's condition already uses. Returns the message or "". */
export function tierInUse(rules: Rule[], draft: TierConfig, saved: TierConfig): string {
  for (const r of rules) for (const c of r.conditions) for (const k of ["ghi", "pci"] as const) {
    const id = c[k];
    if (id >= 0 && (draft[k].schemes[id] !== "MOEFAS" || JSON.stringify(draft[k].ranges[id]) !== JSON.stringify(saved[k].ranges[id])))
      return `This tier is used by ${r.id}. Remove its rule reference before changing the range or scheme.`;
  }
  return "";
}

// ---- Family applications ----

export type Income = { g: Range; p: Range };
export type Family = {
  id: string; parent: string; spouse: string; children: string[]; schools: string[]; levels: string[];
  contact: string; address: string; income: Income;
  /** Policy snapshot each child was assessed against (defaults to the first). */
  snapshots?: string[];
  /** No supporting documents were submitted. */
  noDocs?: boolean;
  /** Final per-child result once the school has decided SBFAS (overrides the automatic assessment). */
  results?: ChildOutcome[];
};

/** Rule conditions as they stood when the child was assessed (mock: the real rules can change later). */
export type Snapshot = { id: string; conditions: { g: Range; p: Range }[] };
const SNAPSHOTS: Snapshot[] = [
  { id: "FASR26100001", conditions: [{ g: [0, 2000], p: [0, 500] }, { g: [2000.01, 3000], p: [500.01, 750] }] },
  { id: "FASR26100002", conditions: [{ g: [0, 500], p: [0, 100] }, { g: [2000.01, 3000], p: [500.01, 750] }] },
];

export const FAMILIES: Family[] = [
  { id: "FAS20260001", parent: "Rachel Lim", spouse: "David Lim", children: ["Ethan Lim Jun Hao", "Chloe Lim Wen Xin"], schools: ["Riverbank Primary School", "Greenfield Secondary School"], levels: ["Primary 5", "Secondary 2"], contact: "+65 9123 4567", address: "Blk 214 Bishan Street 23, #08-112, Singapore 570214", income: { g: [1000, 1800], p: [600, 700] } },
  { id: "FAS20260002", parent: "Nur Aisyah Binte Abdullah", spouse: "Muhammad Farhan", children: ["Adam Muhammad"], schools: ["Riverbank Primary School"], levels: ["Primary 4"], contact: "+65 9234 5678", address: "Blk 512 Tampines Central 1, #05-118, Singapore 520512", income: { g: [5001, 6000], p: [1250.01, 1500] }, noDocs: true },
  { id: "FAS20260004", parent: "Michelle Tan", spouse: "Daniel Tan", children: ["Lucas Tan Wei Jie", "Emma Tan Hui Min"], schools: ["Riverbank Primary School", "Greenfield Secondary School"], levels: ["Primary 6", "Secondary 3"], contact: "+65 9456 7890", address: "Blk 118 Toa Payoh Lorong 1, #09-210, Singapore 310118", income: { g: [1000, 1800], p: [450, 520] }, snapshots: ["FASR26100001", "FASR26100002"] },
  { id: "FAS20260005", parent: "Lee Chee Meng", spouse: "—", children: ["Lee Kai En"], schools: ["Sunrise Primary School"], levels: ["Primary 1"], contact: "—", address: "—", income: { g: [5001, 6000], p: [1250.01, 1500] }, results: ["SBFAS granted"] },
  { id: "FAS20260006", parent: "Ahmad bin Hassan", spouse: "—", children: ["Aiman Ahmad", "Aisyah Ahmad"], schools: ["Sunrise Primary School", "Greenfield Secondary School"], levels: ["Primary 1", "Secondary 1"], contact: "—", address: "—", income: { g: [5001, 6000], p: [1250.01, 1500] }, results: ["SBFAS granted", "SBFAS granted"] },
  { id: "FAS20260007", parent: "Teo Kok Hwa", spouse: "—", children: ["Teo Zhi Hao", "Teo Zhi Ying"], schools: ["Riverbank Primary School", "Greenfield Secondary School"], levels: ["Primary 1", "Secondary 1"], contact: "—", address: "—", income: { g: [5001, 6000], p: [1250.01, 1500] }, results: ["Rejected", "Rejected"] },
  { id: "FAS20260009", parent: "Wong Kian Seng", spouse: "—", children: ["Wong Jia Hui", "Wong Jia Le"], schools: ["Sunrise Primary School", "Sunrise Primary School"], levels: ["Primary 1", "Primary 4"], contact: "—", address: "—", income: { g: [5001, 6000], p: [1250.01, 1500] }, results: ["Rejected", "SBFAS granted"] },
  { id: "FAS20260010", parent: "Lim Teck Soon", spouse: "—", children: ["Lim Kai Ling", "Lim Kai Xuan"], schools: ["Riverbank Primary School", "Greenfield Secondary School"], levels: ["Primary 1", "Secondary 1"], contact: "—", address: "—", income: { g: [5001, 6000], p: [1250.01, 1500] }, results: ["Pending SBFAS review", "Pending SBFAS review"] },
];

export const snapshotFor = (f: Family, i: number): Snapshot => SNAPSHOTS.find((s) => s.id === (f.snapshots?.[i] ?? SNAPSHOTS[0].id)) ?? SNAPSHOTS[0];

/** An income range is inside a policy range only if both ends are. */
export const matchRange = (v: Range, r: Range) => v[0] >= r[0] && v[1] <= r[1];
/** GHI OR PCI matching is enough. Returns the first matching condition index, or -1. */
export const matchedCondition = (f: Family, i: number) => snapshotFor(f, i).conditions.findIndex((c) => matchRange(f.income.g, c.g) || matchRange(f.income.p, c.p));

export type ChildOutcome = "MOEFAS granted" | "Pending SBFAS review" | "SBFAS granted" | "Rejected";
export const childResult = (f: Family, i: number): ChildOutcome => f.results?.[i] ?? (matchedCondition(f, i) >= 0 ? "MOEFAS granted" : "Pending SBFAS review");

export type Outcome = "MOEFAS Granted" | "SBFAS Review" | "Mixed Outcomes" | "SBFAS Granted" | "Rejected";
export const OUTCOMES: Outcome[] = ["MOEFAS Granted", "SBFAS Review", "Mixed Outcomes", "SBFAS Granted", "Rejected"];
export function applicationStatus(f: Family): Outcome {
  const r = f.children.map((_, i) => childResult(f, i));
  const all = (x: ChildOutcome) => r.every((y) => y === x);
  if (all("MOEFAS granted")) return "MOEFAS Granted";
  if (all("Pending SBFAS review")) return "SBFAS Review";
  if (all("SBFAS granted")) return "SBFAS Granted";
  if (all("Rejected")) return "Rejected";
  return "Mixed Outcomes";
}

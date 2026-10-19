import { useState } from "react";

// MOEFAS (HQ): family applications assessed against the Active FAS rule, and the rules themselves. All values are demo mock data.

export const HH_BANDS = ["Up to S$1,500", "S$1,501–S$2,500", "S$2,501–S$4,000", "Above S$4,000"];
export const PC_BANDS = ["Up to S$450", "S$451–S$750", "S$751–S$1,000", "S$1,001–S$1,500", "Above S$1,500"];

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

export type Basis = "percent" | "fixed";
/** One subsidy row. `id` is "" until the user picks a component for the fee type. */
export type RuleComponent = { id: string; type: FeeKind; basis: Basis; amounts: (number | "")[] };
export type RuleStatus = "Active" | "Inactive" | "Draft";
export type Rule = {
  id: string; name: string; from: string; to: string; logic: "AND" | "OR"; status: RuleStatus;
  tiers: { hh: number; pc: number }[];
  components: RuleComponent[];
};

const comp = (id: string, basis: Basis, amounts: number[]): RuleComponent => ({ id, type: CATALOGUE.find((c) => c.id === id)!.type, basis, amounts });
const TIERS = () => [{ hh: 0, pc: 0 }, { hh: 2, pc: 2 }];

export const blankRule = (id: string): Rule => ({ id, name: "", from: "2026-01-01", to: "2026-12-31", logic: "AND", status: "Draft", tiers: TIERS(), components: [] });

const SEED: Rule[] = [
  { id: "FASR9001", name: "MOEFAS 2026 — Standard assistance", status: "Active", from: "2026-01-01", to: "2026-12-31", logic: "AND", tiers: TIERS(), components: [comp("MFC-001", "percent", [80, 50]), comp("MFC-002", "fixed", [20, 10])] },
  { id: "FASR9002", name: "MOEFAS 2025 — Standard assistance", status: "Inactive", from: "2025-01-01", to: "2025-12-31", logic: "AND", tiers: TIERS(), components: [comp("MFC-003", "percent", [75, 40])] },
  { id: "FASR9003", name: "MOEFAS 2027 — Proposed assistance", status: "Draft", from: "2027-01-01", to: "2027-12-31", logic: "AND", tiers: TIERS(), components: [comp("MFC-002", "fixed", [15, 8]), comp("MFC-004", "percent", [60, 30])] },
];

const KEY = "moefas-rules-v1";

/** Rules live in localStorage so edits survive a reload; falls back to the seed. */
export function useRules() {
  const [rules, set] = useState<Rule[]>(() => {
    try {
      const d = JSON.parse(localStorage.getItem(KEY) ?? "null");
      if (Array.isArray(d) && d.length) return d;
    } catch { /* private mode / bad JSON: use the seed */ }
    return SEED;
  });
  const setRules = (next: Rule[]) => {
    set(next);
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* session only */ }
  };
  return [rules, setRules] as const;
}

/** Only one rule is Active: activating one makes the previous Active rule Inactive. */
export const activateRule = (rules: Rule[], id: string): Rule[] =>
  rules.map((r) => ({ ...r, status: r.id === id ? "Active" : r.status === "Active" ? "Inactive" : r.status }));

export const nextRuleId = (rules: Rule[]) => "FASR" + String(Math.max(0, ...rules.map((r) => Number(r.id.slice(4)))) + 1).padStart(4, "0");

/** Today in Singapore as YYYY-MM-DD. */
export const todaySg = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Singapore", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

/** Why a rule cannot be saved, or "" when it can. */
export function ruleProblem(r: Rule): string {
  if (!r.name.trim()) return "Enter a rule name.";
  if (r.from > r.to) return "Effective to must be on or after effective from.";
  if (!r.components.length || r.components.some((c) => !c.id)) return "Select a MOE component for every fee type row.";
  return "";
}

export type ChildResult = "Granted" | "Not granted" | "Awaiting data";
export type Family = {
  id: string; parent: string; spouse: string; children: string[]; schools: string[]; levels: string[];
  outcome: "MOEFAS granted" | "SBFAS review" | "Awaiting income data" | "Mixed outcomes";
  band: string; pci: string; sync: string; contact: string; address: string;
  status: ChildResult[];
  /** Child indexes whose student record is incomplete, so refreshing income does not help. */
  missingInfo?: number[];
};

export const FAMILIES: Family[] = [
  { id: "FAS20260001", parent: "Rachel Lim", spouse: "David Lim", children: ["Ethan Lim Jun Hao", "Chloe Lim Wen Xin"], schools: ["Riverbank Primary School", "Greenfield Secondary School"], levels: ["Primary 5", "Secondary 2"], outcome: "MOEFAS granted", band: "S$2,501–S$4,000", pci: "S$751–S$1,000", sync: "18 Oct 2026", contact: "+65 9123 4567", address: "Blk 214 Bishan Street 23, #08-112, Singapore 570214", status: ["Granted", "Granted"] },
  { id: "FAS20260002", parent: "Nur Aisyah Binte Abdullah", spouse: "Muhammad Farhan", children: ["Adam Muhammad"], schools: ["Riverbank Primary School"], levels: ["Primary 4"], outcome: "SBFAS review", band: "Above S$4,000", pci: "S$1,001–S$1,500", sync: "18 Oct 2026", contact: "+65 9234 5678", address: "Blk 512 Tampines Central 1, #05-118, Singapore 520512", status: ["Not granted"] },
  { id: "FAS20260003", parent: "Priya Nair", spouse: "Arun Nair", children: ["Arjun Nair"], schools: ["Greenfield Secondary School"], levels: ["Secondary 1"], outcome: "Awaiting income data", band: "Unavailable", pci: "Unavailable", sync: "Sync failed", contact: "+65 9345 6789", address: "Blk 301 Clementi Avenue 4, #07-102, Singapore 120301", status: ["Awaiting data"] },
  { id: "FAS20260004", parent: "Michelle Tan", spouse: "Daniel Tan", children: ["Lucas Tan Wei Jie", "Emma Tan Hui Min"], schools: ["Riverbank Primary School", "Greenfield Secondary School"], levels: ["Primary 6", "Secondary 3"], outcome: "Mixed outcomes", band: "S$2,501–S$4,000", pci: "S$751–S$1,000", sync: "18 Oct 2026", contact: "+65 9456 7890", address: "Blk 118 Toa Payoh Lorong 1, #09-210, Singapore 310118", status: ["Granted", "Awaiting data"], missingInfo: [1] },
];

export const OUTCOMES: Family["outcome"][] = ["MOEFAS granted", "SBFAS review", "Awaiting income data", "Mixed outcomes"];

/** Simulated income-API retry: income arrives, so every waiting child that has complete records is assessed and granted. */
export function refreshIncome(f: Family): Family {
  const status = f.status.map((s, i) => (s === "Awaiting data" && !f.missingInfo?.includes(i) ? "Granted" : s));
  const outcome = status.every((s) => s === "Granted") ? "MOEFAS granted" : f.outcome;
  return { ...f, band: "S$2,501–S$4,000", pci: "S$751–S$1,000", sync: "19 Oct 2026", status, outcome };
}

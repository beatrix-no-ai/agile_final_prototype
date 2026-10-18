import { createContext, useContext, useReducer, type Dispatch, type ReactNode } from "react";
import { applyDecision, isGranted, type Action, type Draft } from "../features/admin/fas/review";
import { sbfasUsage } from "../lib/budget";
import { MOEFAS_BY_LEVEL, MOEFAS_BY_TIER, SBFAS, SBFAS_BY_TIER, SBFAS_TIER_AMOUNT, type LevelBudget } from "./budgets";
import { SBFAS_APPLICATIONS, type SbfasApplication } from "./sbfasApplications";

// ASSUMPTION: FAS decisions and budgets live in memory only and reset on reload (no backend), like the fee store.
export type BudgetScope = "MOEFAS" | "SBFAS";
export type BudgetChange = { id: string; scope: BudgetScope; target: string; from: number; to: number; by: string; at: string };
export type FasState = { apps: SbfasApplication[]; sbfasBudget: number; levels: LevelBudget[]; history: BudgetChange[] };
export type FasAction =
  | { type: "decide"; id: string; action: Action; draft: Draft; at: string }
  | { type: "setBudget"; scope: BudgetScope; target: string; amount: number; by: string; at: string };

export const initialFasState = (): FasState => ({ apps: SBFAS_APPLICATIONS, sbfasBudget: SBFAS.budget, levels: MOEFAS_BY_LEVEL, history: [] });

/** Pure. A decision is always recorded, even when the budget is already used up (overspend only warns). */
export function fasReducer(state: FasState, a: FasAction): FasState {
  if (a.type === "decide") {
    const apps = applyDecision(state.apps, a.id, a.action, a.draft).map((x) => (x.id === a.id ? { ...x, decidedAt: a.at } : x));
    return { ...state, apps };
  }
  const from = a.scope === "SBFAS" ? state.sbfasBudget : (state.levels.find((l) => l.id === a.target)?.budget ?? 0);
  const entry: BudgetChange = { id: `BC-${state.history.length + 1}`, scope: a.scope, target: a.target, from, to: a.amount, by: a.by, at: a.at };
  return {
    ...state,
    sbfasBudget: a.scope === "SBFAS" ? a.amount : state.sbfasBudget,
    levels: a.scope === "MOEFAS" ? state.levels.map((l) => (l.id === a.target ? { ...l, budget: a.amount } : l)) : state.levels,
    history: [entry, ...state.history],
  };
}

const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);

/** School view. The seeded figures are what was granted before this queue; live decisions add on top. */
export function selectSbfas(s: FasState) {
  const live = sbfasUsage(s.apps);
  const used = SBFAS.absorbed + live.amount;
  return {
    budget: s.sbfasBudget,
    used,
    remaining: s.sbfasBudget - used,
    helped: sum(SBFAS_BY_TIER.map((t) => t.value)) + live.count,
    byTier: SBFAS_BY_TIER.map((t) => ({ label: t.label, value: t.value + (live.byTier[t.label as keyof typeof live.byTier] ?? 0) })),
  };
}

/** HQ view. MOEFAS spend is seeded (the app has no live MOEFAS grants yet). */
export function selectMoefas(s: FasState) {
  const budget = sum(s.levels.map((l) => l.budget));
  const used = sum(s.levels.map((l) => l.used));
  return { levels: s.levels, budget, used, remaining: budget - used, helped: sum(s.levels.map((l) => l.beneficiaries)), byTier: MOEFAS_BY_TIER };
}

/** The school's latest SBFAS grants, newest first. Only decided, granted applications appear. */
export function selectRecentGrants(s: FasState, limit = 5) {
  return s.apps
    .filter((a) => isGranted(a) && a.sbfasTier && a.decidedAt)
    .sort((x, y) => y.decidedAt!.localeCompare(x.decidedAt!))
    .slice(0, limit)
    .map((a) => ({ id: a.id, studentId: a.studentId, student: a.student, level: a.level, tier: a.sbfasTier!, amount: SBFAS_TIER_AMOUNT[a.sbfasTier!], at: a.decidedAt! }));
}

/** Same shape the dashboard Budget Usage card always used. */
export function selectBudgets(s: FasState) {
  const m = selectMoefas(s);
  const b = selectSbfas(s);
  return [
    { name: "MOEFAS", owner: "MOE HQ", used: m.used, budget: m.budget },
    { name: "SBFAS", owner: "School", used: b.used, budget: b.budget },
  ];
}

const Ctx = createContext<{ state: FasState; dispatch: Dispatch<FasAction> } | null>(null);

export function FasProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(fasReducer, undefined, initialFasState);
  return <Ctx.Provider value={{ state, dispatch }}>{children}</Ctx.Provider>;
}

export function useFas() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useFas must be used inside FasProvider");
  return c;
}

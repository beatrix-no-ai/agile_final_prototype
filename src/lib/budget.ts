import { SBFAS_TIER_AMOUNT } from "../data/budgets";
import { BUDGET_ALERT_PCT } from "../data/dashboard";
import { SBFAS_TIERS, type SbfasApplication, type SbfasTier } from "../data/sbfasApplications";
import { formatSGD } from "./format";

export function budgetUsage(used: number, budget: number): { pct: number; over: boolean; barPct: number } {
  const pct = budget > 0 ? Math.round((used / budget) * 100) : 0;
  return { pct, over: pct > 100, barPct: Math.min(100, pct) };
}

export type BudgetState = "ok" | "near" | "reached" | "over";

/** ok below the alert line, near from BUDGET_ALERT_PCT, reached at exactly 100%, over above. No budget set = ok. */
export function budgetStatus(used: number, budget: number, alertPct = BUDGET_ALERT_PCT): BudgetState {
  if (budget <= 0) return "ok";
  if (used > budget) return "over";
  if (used === budget) return "reached";
  return (used / budget) * 100 >= alertPct ? "near" : "ok";
}

const money = (n: number) => formatSGD(n, { compact: n >= 1e6 });

/** The warning line for a budget, or null when nothing needs saying. Overspend never blocks a grant. */
export function budgetAlertText(name: string, used: number, budget: number): string | null {
  const status = budgetStatus(used, budget);
  if (status === "ok") return null;
  if (status === "near") return `${name} budget is ${budgetUsage(used, budget).pct}% used, ${money(budget - used)} left.`;
  if (status === "reached") return `${name} budget is fully used. New grants are still recorded.`;
  return `${name} budget exceeded by ${money(used - budget)}. Grants are still recorded; review spending.`;
}

/** What approved SBFAS applications add up to, using each one's tier amount. */
export function sbfasUsage(apps: readonly Pick<SbfasApplication, "status" | "sbfasTier">[]) {
  const byTier = Object.fromEntries(SBFAS_TIERS.map((t) => [t, 0])) as Record<SbfasTier, number>;
  let amount = 0;
  let count = 0;
  for (const a of apps) {
    if (a.status !== "Approved" || !a.sbfasTier) continue;
    amount += SBFAS_TIER_AMOUNT[a.sbfasTier];
    byTier[a.sbfasTier] += 1;
    count += 1;
  }
  return { amount, count, byTier };
}

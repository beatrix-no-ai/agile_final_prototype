import { describe, expect, it } from "vitest";
import { formatSGD } from "../lib/format";
import { budgetUsage } from "../lib/budget";
import { MOEFAS_BY_LEVEL, SBFAS } from "./budgets";
import { BUDGET_ALERT_PCT, budgets, fasByTier, receivedFas, stats, topUps } from "./dashboard";

describe("dashboard mock data is internally consistent", () => {
  it("MOEFAS + SBFAS equals received", () => {
    expect(receivedFas.moefas + receivedFas.sbfas).toBe(1284);
    expect(receivedFas.moefas + receivedFas.sbfas).toBe(receivedFas.received);
  });

  it("tiers sum to received", () => {
    expect(fasByTier.reduce((s, t) => s + t.count, 0)).toBe(receivedFas.received);
  });

  it("top-up months sum to S$4.43M", () => {
    expect(formatSGD(topUps.months.reduce((s, m) => s + m.amount, 0), { compact: true })).toBe("S$4.43M");
  });

  it("received / applicants is 37.5%", () => {
    expect(((receivedFas.received / receivedFas.applicants) * 100).toFixed(1)).toBe("37.5");
  });
});

describe("dashboard agrees with the Budgets screen data", () => {
  it("Budget Usage is derived from data/budgets.ts", () => {
    const [moefas, sbfas] = budgets;
    expect(moefas.budget).toBe(38_000_000);
    expect(moefas.used).toBe(MOEFAS_BY_LEVEL.reduce((s, l) => s + l.used, 0));
    expect(sbfas).toMatchObject({ used: SBFAS.absorbed, budget: SBFAS.budget });
  });

  it("MOEFAS is past the alert line, SBFAS is not", () => {
    const [moefas, sbfas] = budgets;
    expect(budgetUsage(moefas.used, moefas.budget).pct).toBeGreaterThanOrEqual(BUDGET_ALERT_PCT);
    expect(budgetUsage(sbfas.used, sbfas.budget).pct).toBeLessThan(BUDGET_ALERT_PCT);
  });

  it("per-level beneficiaries fit inside Total Student", () => {
    const total = stats.find((s) => s.key === "students")!.value;
    expect(MOEFAS_BY_LEVEL.reduce((s, l) => s + l.beneficiaries, 0)).toBeLessThanOrEqual(total);
  });
});

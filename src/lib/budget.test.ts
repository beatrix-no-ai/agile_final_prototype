import { expect, test } from "vitest";
import { budgetUsage } from "./budget";

test("budgetUsage", () => {
  expect(budgetUsage(2.4e6, 3e6)).toEqual({ pct: 80, over: false, barPct: 80 });
  expect(budgetUsage(120, 100)).toEqual({ pct: 120, over: true, barPct: 100 });
  expect(budgetUsage(5, 0).pct).toBe(0);
});

import { budgetAlertText, budgetStatus, sbfasUsage } from "./budget";
import { SBFAS_TIER_AMOUNT } from "../data/budgets";

test("budgetStatus: ok below the alert line, near from 80%, reached at 100%, over above", () => {
  expect(budgetStatus(79, 100)).toBe("ok");
  expect(budgetStatus(80, 100)).toBe("near");
  expect(budgetStatus(100, 100)).toBe("reached");
  expect(budgetStatus(101, 100)).toBe("over");
});

test("budgetStatus: no budget set is never a warning", () => {
  expect(budgetStatus(5000, 0)).toBe("ok");
});

test("budgetAlertText: silent when ok, names the budget and the money when not", () => {
  expect(budgetAlertText("SBFAS", 50, 100)).toBeNull();
  expect(budgetAlertText("SBFAS", 85, 100)).toMatch(/SBFAS.*85%.*S\$15\.00 left/);
  expect(budgetAlertText("SBFAS", 100, 100)).toMatch(/fully used/);
  const over = budgetAlertText("MOEFAS", 130, 100);
  expect(over).toMatch(/exceeded by S\$30\.00/);
  expect(over).toMatch(/still recorded/);
});

test("sbfasUsage: only approved and overridden applications count, at their tier amount", () => {
  const apps = [
    { status: "Approved", sbfasTier: "Tier 1" },
    { status: "Overridden", sbfasTier: "Tier 3" },
    { status: "Rejected" },
    { status: "Pending" },
  ] as const;
  const u = sbfasUsage(apps);
  expect(u.count).toBe(2);
  expect(u.amount).toBe(SBFAS_TIER_AMOUNT["Tier 1"] + SBFAS_TIER_AMOUNT["Tier 3"]);
  expect(u.byTier).toEqual({ "Tier 1": 1, "Tier 2": 0, "Tier 3": 1, "Tier 4": 0 });
});

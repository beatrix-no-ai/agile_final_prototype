import { describe, expect, it } from "vitest";
import { SBFAS, SBFAS_BY_TIER, SBFAS_TIER_AMOUNT } from "./budgets";
import { fasReducer, initialFasState, selectBudgets, selectMoefas, selectSbfas } from "./fasStore";

const first = (s = initialFasState()) => s.apps[0]; // SBFAS-2041, recommended Tier 1
const approve = (s = initialFasState()) => fasReducer(s, { type: "decide", id: first(s).id, action: "approve", draft: { justification: "", tier: first(s).recommendedTier } });

describe("SBFAS stats follow real decisions", () => {
  it("starts at the seeded baseline", () => {
    const s = selectSbfas(initialFasState());
    expect(s).toMatchObject({ budget: SBFAS.budget, used: SBFAS.absorbed, remaining: SBFAS.budget - SBFAS.absorbed });
    expect(s.helped).toBe(SBFAS_BY_TIER.reduce((t, x) => t + x.value, 0));
  });

  it("approving an application adds its tier amount and one student helped", () => {
    const s = selectSbfas(approve());
    expect(s.used).toBe(SBFAS.absorbed + SBFAS_TIER_AMOUNT["Tier 1"]);
    expect(s.helped).toBe(148 + 1);
    expect(s.byTier.find((t) => t.label === "Tier 1")!.value).toBe(52 + 1);
  });

  it("rejecting adds nothing", () => {
    const s0 = initialFasState();
    const s = fasReducer(s0, { type: "decide", id: first(s0).id, action: "reject", draft: { justification: "", tier: "Tier 1" } });
    expect(selectSbfas(s).used).toBe(SBFAS.absorbed);
  });

  it("a grant is still recorded when the budget is already exceeded", () => {
    let s = fasReducer(initialFasState(), { type: "setBudget", scope: "SBFAS", target: "SBFAS", amount: 1000, by: "A", at: "2026-10-18" });
    s = approve(s);
    expect(first(s).status).toBe("Approved");
    expect(selectSbfas(s).remaining).toBeLessThan(0);
  });
});

describe("setBudget", () => {
  it("changes the SBFAS budget and keeps old value, new value, user and date", () => {
    const s = fasReducer(initialFasState(), { type: "setBudget", scope: "SBFAS", target: "SBFAS", amount: 150000, by: "Alicia Tan", at: "2026-10-18" });
    expect(selectSbfas(s).budget).toBe(150000);
    expect(s.history).toEqual([expect.objectContaining({ scope: "SBFAS", from: SBFAS.budget, to: 150000, by: "Alicia Tan", at: "2026-10-18" })]);
  });

  it("changes one MOEFAS level only and totals follow", () => {
    const before = selectMoefas(initialFasState());
    const s = fasReducer(initialFasState(), { type: "setBudget", scope: "MOEFAS", target: "Primary", amount: 21_000_000, by: "Daniel Lim", at: "2026-10-18" });
    const after = selectMoefas(s);
    expect(after.levels.find((l) => l.id === "Primary")!.budget).toBe(21_000_000);
    expect(after.levels.find((l) => l.id === "Secondary")!.budget).toBe(before.levels.find((l) => l.id === "Secondary")!.budget);
    expect(after.budget).toBe(before.budget + 1_000_000);
    expect(s.history[0]).toMatchObject({ scope: "MOEFAS", target: "Primary", from: 20_000_000, to: 21_000_000 });
  });

  it("newest change is first in the history", () => {
    let s = fasReducer(initialFasState(), { type: "setBudget", scope: "SBFAS", target: "SBFAS", amount: 1, by: "A", at: "d1" });
    s = fasReducer(s, { type: "setBudget", scope: "SBFAS", target: "SBFAS", amount: 2, by: "A", at: "d2" });
    expect(s.history.map((h) => h.to)).toEqual([2, 1]);
  });
});

it("selectBudgets feeds the dashboard card in the same shape as before", () => {
  const [moefas, sbfas] = selectBudgets(initialFasState());
  expect(moefas).toMatchObject({ name: "MOEFAS", owner: "MOE HQ", budget: 38_000_000 });
  expect(sbfas).toMatchObject({ name: "SBFAS", owner: "School", used: SBFAS.absorbed, budget: SBFAS.budget });
});

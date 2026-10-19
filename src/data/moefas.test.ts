import { describe, expect, it } from "vitest";
import { activateRule, blankRule, FAMILIES, nextRuleId, refreshIncome, ruleProblem, type Rule } from "./moefas";

const rules = (): Rule[] => [
  { ...blankRule("FASR0001"), status: "Active" },
  { ...blankRule("FASR0002"), status: "Draft" },
  { ...blankRule("FASR0003"), status: "Inactive" },
];

describe("moefas rules", () => {
  it("keeps exactly one Active rule", () => {
    const next = activateRule(rules(), "FASR0002");
    expect(next.map((r) => r.status)).toEqual(["Inactive", "Active", "Inactive"]);
  });
  it("numbers new rules after the highest id", () => expect(nextRuleId(rules())).toBe("FASR0004"));
  it("rejects a rule with no name, bad dates or an unpicked component", () => {
    const r = { ...blankRule("FASR0009"), name: "X", components: [{ id: "MFC-001", type: "School fee" as const, basis: "percent" as const, amounts: [0, 0] }] };
    expect(ruleProblem(r)).toBe("");
    expect(ruleProblem({ ...r, name: " " })).toMatch(/name/);
    expect(ruleProblem({ ...r, from: "2027-01-01" })).toMatch(/Effective to/);
    expect(ruleProblem({ ...r, components: [{ ...r.components[0], id: "" }] })).toMatch(/component/);
    expect(ruleProblem({ ...r, components: [] })).toMatch(/component/);
  });
});

describe("refreshIncome", () => {
  it("grants a family waiting on income data", () => {
    const f = refreshIncome(FAMILIES[2]);
    expect(f.status).toEqual(["Granted"]);
    expect(f.outcome).toBe("MOEFAS granted");
  });
  it("leaves a child with an incomplete record waiting", () => {
    const f = refreshIncome(FAMILIES[3]);
    expect(f.status).toEqual(["Granted", "Awaiting data"]);
    expect(f.outcome).toBe("Mixed outcomes");
  });
});

import { describe, expect, it, test } from "vitest";
import {
  activateRule, applicationStatus, blankRule, childResult, conditionProblem, defaultTiers, FAMILIES, nextRuleId, promoteDue, ruleProblem,
  tierGaps, tierInUse, tierOverlap, tierProblem, type Rule,
} from "./moefas";

const rules = (): Rule[] => [
  { ...blankRule("FASR26100001"), status: "Active" },
  { ...blankRule("FASR26100002"), status: "Draft" },
  { ...blankRule("FASR26100003"), status: "Inactive" },
];
const tiers = defaultTiers();

describe("moefas rules", () => {
  it("keeps exactly one Active rule", () => {
    const next = activateRule(rules(), "FASR26100002");
    expect(next.map((r) => r.status)).toEqual(["Inactive", "Active", "Inactive"]);
  });
  it("numbers new rules FASR + YYMM + sequence within the month", () => {
    const now = new Date("2026-10-21T04:00:00Z");
    expect(nextRuleId(rules(), now)).toBe("FASR26100004");
    expect(nextRuleId([], now)).toBe("FASR26100001");
    expect(nextRuleId(rules(), new Date("2026-11-02T04:00:00Z"))).toBe("FASR26110001");
  });
  it("rejects a rule with no name, unpicked tiers or an unpicked component", () => {
    const r = { ...blankRule("X"), name: "X", components: [{ id: "MFC-001", type: "School fee" as const, basis: "percent" as const, amounts: [0, 0] }] };
    expect(ruleProblem(r, tiers)).toBe("");
    expect(ruleProblem({ ...r, name: " " }, tiers)).toMatch(/name/);
    expect(ruleProblem({ ...r, components: [{ ...r.components[0], id: "" }] }, tiers)).toMatch(/component/);
    expect(ruleProblem({ ...r, components: [] }, tiers)).toMatch(/component/);
    expect(ruleProblem({ ...r, components: [{ ...r.components[0], amounts: [101, 0] }] }, tiers)).toMatch(/subsidy/);
  });
  it("lets a draft skip components and unpicked tiers but not a name", () => {
    const r = { ...blankRule("X"), name: "X", conditions: [{ ghi: -1, pci: 0 }, { ghi: 1, pci: 1 }] };
    expect(ruleProblem(r, tiers, true)).toBe("");
    expect(ruleProblem(r, tiers)).toMatch(/select a GHI tier/);
    expect(ruleProblem({ ...r, name: "" }, tiers, true)).toMatch(/name/);
  });
});

describe("rule conditions", () => {
  it("allows each tier in only one condition", () => {
    expect(conditionProblem([{ ghi: 0, pci: 0 }, { ghi: 0, pci: 1 }], tiers)).toMatch(/Condition 1 and Condition 2 both use GHI Tier 1/);
  });
  it("rejects a tier that is not assigned to MOEFAS", () => {
    expect(conditionProblem([{ ghi: 5, pci: 0 }], tiers)).toMatch(/not available for MOEFAS/);
  });
});

describe("income tiers", () => {
  it("ships valid defaults", () => expect(tierProblem(tiers)).toBe(""));
  it("finds the tier a range overlaps", () => {
    const { ranges } = tiers.ghi;
    expect(tierOverlap(ranges, 1, 1500, 3000)).toBe(0);
    expect(tierOverlap(ranges, 1, 2001, 3000)).toBe(-1);
    expect(tierOverlap(ranges, 0, 0, 2000)).toBe(-1);
    expect(tierOverlap(ranges, 1, NaN, 3000)).toBe(-1);
  });
  it("rejects overlapping ranges on save", () => {
    const t = defaultTiers();
    t.ghi.ranges[1][0] = 1999;
    expect(tierProblem(t)).toMatch(/GHI Tier 2: overlaps Tier 1/);
  });
  it("rejects minimum above maximum and non-whole dollars", () => {
    const t = defaultTiers();
    t.pci.ranges[0] = [600, 500];
    expect(tierProblem(t)).toMatch(/PCI Tier 1/);
    const u = defaultTiers();
    u.pci.ranges[0][1] = 500.5;
    expect(tierProblem(u)).toMatch(/whole dollars/);
  });
  it("reports uncovered amounts as gaps, not errors", () => {
    expect(tierGaps(tiers)).toEqual([]);
    const t = defaultTiers();
    t.ghi.ranges[1][0] = 2500;
    expect(tierProblem(t)).toBe("");
    expect(tierGaps(t)).toEqual(["ghi"]);
  });
  it("blocks changes to a tier a saved rule uses", () => {
    const t = defaultTiers();
    t.ghi.ranges[0][1] = 1900;
    expect(tierInUse(rules(), t, tiers)).toMatch(/FASR26100001/);
    const s = defaultTiers();
    s.ghi.ranges[13][0] = 12500;
    expect(tierInUse(rules(), s, tiers)).toBe("");
  });
});

describe("applications", () => {
  const by = (id: string) => FAMILIES.find((f) => f.id === id)!;
  it("matches on GHI OR PCI", () => {
    expect(FAMILIES.map(applicationStatus)).toEqual(["MOEFAS Granted", "SBFAS review", "Mixed outcomes"]);
  });
  it("assesses each child against their own policy snapshot", () => {
    const m = by("FAS20260004");
    expect([0, 1].map((i) => childResult(m, i))).toEqual(["MOEFAS granted", "Pending SBFAS review"]);
  });
});

test("promoteDue: a Pending rule becomes Active on its date and the old Active one goes Inactive", () => {
  const base = { conditions: [], components: [] };
  const rules: Rule[] = [{ ...base, id: "A", name: "a", status: "Active" }, { ...base, id: "P", name: "p", status: "Pending", effectiveFrom: "2026-11-01" }];
  expect(promoteDue(rules, "2026-10-31").map((r) => r.status)).toEqual(["Active", "Pending"]);
  expect(promoteDue(rules, "2026-11-01").map((r) => r.status)).toEqual(["Inactive", "Active"]);
});

import { describe, expect, it } from "vitest";
import {
  defaultSbfasRule, draftOfSbfasRule, ruleForSchool, sbfasRuleOk, tierRate, toSbfasRule, validateSbfasRule,
} from "./sbfasRule";
import { initialSbfasState, sbfasReducer } from "./sbfasStore";

describe("SBFAS school rule: defaults and lookup", () => {
  it("the default package mirrors the national reference rates, all tiers offered", () => {
    const rule = defaultSbfasRule("S001");
    expect(rule.tiers.map((t) => t.rate)).toEqual([75, 65, 55, 50]);
    expect(rule.tiers.every((t) => t.active)).toBe(true);
  });

  it("ruleForSchool falls back to the default until the school saves its own", () => {
    const rules: Record<string, ReturnType<typeof defaultSbfasRule>> = {};
    expect(ruleForSchool(rules, "S002").school).toBe("S002");
    const saved = toSbfasRule({ tiers: [{ active: true, rate: "80" }, { active: true, rate: "60" }, { active: false, rate: "0" }, { active: true, rate: "40" }] }, "S002");
    expect(ruleForSchool({ S002: saved }, "S002")).toBe(saved);
    expect(ruleForSchool({ S002: saved }, "S001").tiers[0].rate).toBe(75); // other schools untouched
  });

  it("tierRate converts percent to a fraction, also for a tier later switched off", () => {
    const rule = toSbfasRule({ tiers: [{ active: true, rate: "80" }, { active: true, rate: "60" }, { active: false, rate: "12.5" }, { active: true, rate: "40" }] }, "S001");
    expect(tierRate(rule, "Tier 1")).toBe(0.8);
    expect(tierRate(rule, "Tier 3")).toBe(0.125); // decisions already made keep their rate
  });
});

describe("SBFAS school rule: validation", () => {
  const ok = { tiers: [{ active: true, rate: "80" }, { active: true, rate: "60" }, { active: true, rate: "55" }, { active: true, rate: "50" }] };

  it("accepts a complete package", () => {
    expect(sbfasRuleOk(validateSbfasRule(ok))).toBe(true);
  });

  it("rejects out-of-range rates and a package with no offered tier", () => {
    expect(validateSbfasRule({ tiers: ok.tiers.map((t, i) => (i === 1 ? { ...t, rate: "150" } : t)) }).rows[1]).toBeTruthy();
    expect(validateSbfasRule({ tiers: ok.tiers.map((t, i) => (i === 2 ? { ...t, rate: "abc" } : t)) }).rows[2]).toBeTruthy();
    expect(validateSbfasRule({ tiers: ok.tiers.map((t) => ({ ...t, active: false })) }).tiers).toBeTruthy();
  });

  it("draftOfSbfasRule round-trips a saved rule", () => {
    const rule = toSbfasRule({ tiers: [{ active: false, rate: "80" }, { active: true, rate: "60" }, { active: true, rate: "55" }, { active: true, rate: "50" }] }, "S001");
    expect(draftOfSbfasRule(rule).tiers[0]).toEqual({ active: false, rate: "80" });
    expect(rule.tiers.map((t) => t.tier)).toEqual(["Tier 1", "Tier 2", "Tier 3", "Tier 4"]);
  });
});

describe("SBFAS school rule: store", () => {
  it("save-rule stores one school's package without touching apps or other schools", () => {
    const s0 = initialSbfasState();
    expect(s0.rules).toEqual({});
    const rule = toSbfasRule({ tiers: [{ active: true, rate: "90" }, { active: true, rate: "60" }, { active: true, rate: "55" }, { active: true, rate: "50" }] }, "S001");
    const s1 = sbfasReducer(s0, { type: "save-rule", rule });
    expect(ruleForSchool(s1.rules, "S001")).toBe(rule);
    expect(s1.apps).toBe(s0.apps);
    expect(s1.family).toBeNull();
  });
});

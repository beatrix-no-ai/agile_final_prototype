import { describe, expect, it } from "vitest";
import {
  defaultSbfasRule, draftOfSbfasRule, levelForBands, moefasCoveredBands, ruleForSchool, sbfasRuleOk,
  tierForBands, tierSubsidy, toSbfasRule, validateSbfasRule, type SbfasRuleDraft,
} from "./sbfasRule";
import { defaultTiers } from "./moefas";
import { initialSbfasState, sbfasReducer } from "./sbfasStore";

describe("SBFAS school rule: defaults and lookup", () => {
  it("the default package mirrors the national reference rates, all percent", () => {
    const rule = defaultSbfasRule("S001");
    expect(rule.tiers.map((t) => t.rate)).toEqual([100, 75, 50, 25]);
    expect(rule.tiers.every((t) => (t.basis ?? "percent") === "percent")).toBe(true);
  });

  it("ruleForSchool falls back to the default until the school saves its own", () => {
    const rules: Record<string, ReturnType<typeof defaultSbfasRule>> = {};
    expect(ruleForSchool(rules, "S002").school).toBe("S002");
    const saved = toSbfasRule({ tiers: [{ basis: "percent", rate: "80" }, { basis: "percent", rate: "60" }, { basis: "fixed", rate: "0" }, { basis: "percent", rate: "40" }] }, "S002");
    expect(ruleForSchool({ S002: saved }, "S002")).toBe(saved);
    expect(ruleForSchool({ S002: saved }, "S001").tiers[0].rate).toBe(100); // other schools untouched
  });

  it("tierSubsidy reads the tier as saved — percent or a fixed amount", () => {
    const rule = toSbfasRule({ tiers: [{ basis: "percent", rate: "80" }, { basis: "percent", rate: "60" }, { basis: "fixed", rate: "20" }] }, "S001");
    expect(tierSubsidy(rule, "Tier 1")).toEqual({ basis: "percent", value: 80 });
    expect(tierSubsidy(rule, "Tier 3")).toEqual({ basis: "fixed", value: 20 });
    expect(tierSubsidy(rule, "Tier 9")).toBeUndefined(); // tier the school removed
  });

  it("the school decides how many tiers exist — names follow position", () => {
    const rule = toSbfasRule({ tiers: [{ basis: "percent", rate: "100" }, { basis: "fixed", rate: "50" }, { basis: "percent", rate: "25" }, { basis: "percent", rate: "10" }, { basis: "fixed", rate: "20" }] }, "S001");
    expect(rule.tiers.map((t) => t.tier)).toEqual(["Tier 1", "Tier 2", "Tier 3", "Tier 4", "Tier 5"]);
    expect(rule.tiers[4]).toEqual({ tier: "Tier 5", basis: "fixed", rate: 20 });
  });
});

describe("SBFAS school rule: validation", () => {
  const ok: SbfasRuleDraft = { tiers: [{ basis: "percent", rate: "80" }, { basis: "percent", rate: "60" }, { basis: "percent", rate: "55" }, { basis: "percent", rate: "50" }] };

  it("accepts a complete package", () => {
    expect(sbfasRuleOk(validateSbfasRule(ok))).toBe(true);
  });

  it("rejects out-of-range percent rates, and non-numeric or 3-decimal values", () => {
    expect(validateSbfasRule({ tiers: ok.tiers.map((t, i) => (i === 1 ? { ...t, rate: "150" } : t)) }).rows[1]).toBeTruthy();
    expect(validateSbfasRule({ tiers: ok.tiers.map((t, i) => (i === 2 ? { ...t, rate: "abc" } : t)) }).rows[2]).toBeTruthy();
    expect(validateSbfasRule({ tiers: ok.tiers.map((t, i) => (i === 2 ? { ...t, rate: "1.234" } : t)) }).rows[2]).toBeTruthy();
  });

  it("a fixed tier takes an amount, not a rate — amounts may exceed 100", () => {
    const fixed = ok.tiers.map((t, i) => (i === 1 ? { ...t, basis: "fixed" as const, rate: "150" } : t));
    expect(sbfasRuleOk(validateSbfasRule({ tiers: fixed }))).toBe(true); // S$150 off a fee is fine
    expect(validateSbfasRule({ tiers: ok.tiers.map((t, i) => (i === 1 ? { ...t, basis: "fixed" as const, rate: "-5" } : t)) }).rows[1]).toBeTruthy();
  });

  it("the school must keep at least one tier", () => {
    expect(validateSbfasRule({ tiers: [] }).tiers).toBe("Keep at least one tier.");
  });

  it("a level pointing at a tier that no longer exists blocks saving", () => {
    const e = validateSbfasRule({ tiers: ok.tiers.slice(0, 2), levelTiers: { HIGH: "Tier 3", MED: "Tier 2", LOW: null } });
    expect(e.levelRows?.HIGH).toBe("Pick the tier this level suggests.");
    expect(sbfasRuleOk(e)).toBe(false);
  });

  it("draftOfSbfasRule round-trips a saved rule", () => {
    const rule = toSbfasRule({ tiers: [{ basis: "fixed", rate: "80" }, { basis: "percent", rate: "60" }, { basis: "percent", rate: "55" }, { basis: "percent", rate: "50" }] }, "S001");
    expect(draftOfSbfasRule(rule).tiers[0]).toEqual({ basis: "fixed", rate: "80" });
    expect(rule.tiers.map((t) => t.tier)).toEqual(["Tier 1", "Tier 2", "Tier 3", "Tier 4"]);
  });
});

describe("SBFAS school rule: store", () => {
  it("save-rule stores one school's package without touching apps or other schools", () => {
    const s0 = initialSbfasState();
    expect(s0.rules).toEqual({});
    const rule = toSbfasRule({ tiers: [{ basis: "percent", rate: "90" }, { basis: "percent", rate: "60" }, { basis: "percent", rate: "55" }, { basis: "percent", rate: "50" }] }, "S001");
    const s1 = sbfasReducer(s0, { type: "save-rule", rule });
    expect(ruleForSchool(s1.rules, "S001")).toBe(rule);
    expect(s1.apps).toBe(s0.apps);
  });
});

describe("SBFAS grouping: MOEFAS-locked bands", () => {
  it("tiers HQ assigns to MOEFAS are covered; the rest stay open to the school", () => {
    const covered = moefasCoveredBands(defaultTiers()); // HQ default: the first 4 tiers of each kind are MOEFAS
    expect(covered.ghi).toEqual([0, 1, 2, 3]);
    expect(covered.pci).toEqual([0, 1, 2, 3]);
  });

  it("defaults leave the MOEFAS bands ungrouped and group the remaining bands by need", () => {
    const rule = defaultSbfasRule("S001");
    expect(rule.grouping.ghi).toEqual([null, null, null, null, "LOW", "LOW", "LOW", "LOW"]);
    expect(rule.grouping.pci).toEqual([null, null, null, null, "HIGH", "MED", "MED", "MED"]);
  });
});

describe("SBFAS grouping: level and tier lookup", () => {
  const rule = toSbfasRule({
    tiers: [{ basis: "percent", rate: "100" }, { basis: "percent", rate: "75" }, { basis: "percent", rate: "50" }, { basis: "percent", rate: "25" }],
    grouping: { ghi: [null, null, null, "LOW"], pci: [null, null, null, "HIGH", "MED"] },
    levelTiers: { HIGH: "Tier 1", MED: "Tier 2", LOW: null },
  }, "S001");

  it("the needier of the two band levels wins; ungrouped bands contribute nothing", () => {
    expect(levelForBands(rule, 3, 4)).toBe("MED"); // ghi band 3 is LOW, pci band 4 is MED → MED wins
    expect(levelForBands(rule, null, 3)).toBe("HIGH");
    expect(levelForBands(rule, 3, null)).toBe("LOW");
    expect(levelForBands(rule, 0, 0)).toBeNull(); // both MOEFAS-locked → nothing to suggest
    expect(levelForBands(rule, null, null)).toBeNull();
  });

  it("tierForBands maps the level through levelTiers; a level with no tier suggests nothing", () => {
    expect(tierForBands(rule, null, 3)).toBe("Tier 1");
    expect(tierForBands(rule, null, 4)).toBe("Tier 2");
    expect(tierForBands(rule, 3, null)).toBeNull(); // LOW → no tier
  });
});

describe("SBFAS grouping: validation and round-trip", () => {
  const tiers: SbfasRuleDraft["tiers"] = [{ basis: "percent", rate: "80" }, { basis: "percent", rate: "60" }, { basis: "percent", rate: "55" }, { basis: "percent", rate: "50" }];

  it("rejects saving when every band is left Not grouped", () => {
    const e = validateSbfasRule({ tiers, grouping: { ghi: [null, null, null, null], pci: [null, null, null, null, null] } });
    expect(e.grouping).toBeTruthy();
    expect(sbfasRuleOk(e)).toBe(false);
  });

  it("a tier-only draft (no grouping key) keeps validating as before — backward compatible", () => {
    expect(sbfasRuleOk(validateSbfasRule({ tiers }))).toBe(true);
  });

  it("toSbfasRule fills default grouping when omitted; draftOfSbfasRule round-trips it", () => {
    const rule = toSbfasRule({ tiers }, "S002");
    expect(rule.grouping.pci[4]).toBe("HIGH");
    const draft = draftOfSbfasRule(rule);
    expect(draft.grouping).toEqual(rule.grouping);
    expect(draft.levelTiers).toEqual(rule.levelTiers);
  });
});

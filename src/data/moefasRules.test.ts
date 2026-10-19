import { describe, expect, it } from "vitest";
import {
  FAS_RULES, HOUSEHOLD_BANDS, MOEFAS_FAMILIES, PER_CAPITA_BANDS, activeRuleOf, assessChild, activateRule,
  bandLabel, draftOf, familyOutcome, feeImpact, nextRuleId, refreshIncome, ruleOk, saveRule, tierAccepts,
  toRule, validateRule, type RuleDraft,
} from "./moefasRules";

const rule = activeRuleOf(FAS_RULES)!;
const income = (household: number | null, perCapita: number | null, failed = false) => ({ household, perCapita, syncedOn: "2026-10-08", failed });
const child = { name: "Test Child", level: "P5" as const };

describe("MOEFAS rules: bands and seeds", () => {
  it("band catalogues are ordered low to high", () => {
    expect(HOUSEHOLD_BANDS).toHaveLength(4);
    expect(PER_CAPITA_BANDS).toHaveLength(5);
    expect(HOUSEHOLD_BANDS[0]).toBe("Up to S$1,500");
    expect(PER_CAPITA_BANDS.at(-1)).toBe("Above S$1,500");
  });

  it("exactly one seeded rule is Active", () => {
    expect(FAS_RULES.filter((r) => r.status === "Active")).toHaveLength(1);
    expect(rule.id).toBe("FASR9001");
    expect(nextRuleId(FAS_RULES)).toBe("FASR9004");
  });

  it("bandLabel renders Unavailable for a missing band", () => {
    expect(bandLabel(HOUSEHOLD_BANDS, 2)).toBe("S$2,501 - S$4,000");
    expect(bandLabel(PER_CAPITA_BANDS, null)).toBe("Unavailable");
  });
});

describe("MOEFAS rules: tier matching", () => {
  const t1 = { household: 0, perCapita: 0 };
  const t2 = { household: 2, perCapita: 2 };

  it("AND accepts a tier only when both bands are at or below the cut-offs", () => {
    expect(tierAccepts("AND", t2, 2, 2)).toBe(true);
    expect(tierAccepts("AND", t2, 1, 2)).toBe(true);
    expect(tierAccepts("AND", t2, 2, 3)).toBe(false);
    expect(tierAccepts("AND", t1, 0, 0)).toBe(true);
    expect(tierAccepts("AND", t1, 1, 0)).toBe(false);
  });

  it("OR accepts a tier when either band is at or below its cut-off", () => {
    expect(tierAccepts("OR", t2, 3, 2)).toBe(true);
    expect(tierAccepts("OR", t2, 2, 3)).toBe(true);
    expect(tierAccepts("OR", t2, 3, 3)).toBe(false);
  });
});

describe("MOEFAS rules: per-child assessment", () => {
  it("grants the first matching tier (Tier 1 strongest)", () => {
    expect(assessChild(rule, income(0, 0), child)).toEqual({ kind: "granted", tier: 0 });
    expect(assessChild(rule, income(2, 2), child)).toEqual({ kind: "granted", tier: 1 });
  });

  it("routes non-matching bands to the school (SBFAS)", () => {
    expect(assessChild(rule, income(3, 3), child)).toEqual({ kind: "sbfas" });
    expect(assessChild(null, income(0, 0), child)).toEqual({ kind: "sbfas" });
  });

  it("waits when income is unavailable or the student record is incomplete", () => {
    expect(assessChild(rule, income(null, null, true), child)).toEqual({ kind: "awaiting", reason: "income" });
    expect(assessChild(rule, income(2, 2), { ...child, missingInfo: true })).toEqual({ kind: "awaiting", reason: "student-info" });
  });
});

describe("MOEFAS rules: family outcome", () => {
  const g = { kind: "granted", tier: 1 } as const;
  it("labels uniform families with the single result", () => {
    expect(familyOutcome([g, { kind: "granted", tier: 0 }])).toBe("MOEFAS granted");
    expect(familyOutcome([{ kind: "sbfas" }])).toBe("SBFAS review");
    expect(familyOutcome([{ kind: "awaiting", reason: "income" }])).toBe("Awaiting income data");
  });

  it("mixed child results read as Mixed outcomes", () => {
    expect(familyOutcome([g, { kind: "awaiting", reason: "income" }])).toBe("Mixed outcomes");
    expect(familyOutcome([{ kind: "sbfas" }, g])).toBe("Mixed outcomes");
  });

  it("seeded families cover every headline", () => {
    const headlines = MOEFAS_FAMILIES.map((f) => familyOutcome(f.children.map((c) => assessChild(rule, f.income, c))));
    expect(headlines).toEqual(["MOEFAS granted", "SBFAS review", "Awaiting income data", "Mixed outcomes"]);
  });
});

describe("MOEFAS rules: fee impact preview", () => {
  it("subsidises master components per the rule and never the school's own fee (Primary, Tier 1)", () => {
    const impact = feeImpact(rule, "P5", 0);
    const tuition = impact.rows.find((r) => r.label === "Tuition Fee")!;
    const misc = impact.rows.find((r) => r.label === "Miscellaneous Fee")!;
    const school = impact.rows.find((r) => r.source === "School-created")!;
    expect(tuition).toMatchObject({ fee: 250, subsidy: 200 }); // 80%
    expect(misc).toMatchObject({ fee: 40, subsidy: 20 }); // fixed S$20
    expect(school.subsidy).toBe(0);
    expect(impact).toMatchObject({ fee: 250 + 40 + 30 + 63, subsidy: 220, payable: 163 });
  });

  it("uses the Secondary master rates for Sec levels (Tier 2)", () => {
    const impact = feeImpact(rule, "Sec 2", 1);
    const tuition = impact.rows.find((r) => r.label === "Tuition Fee")!;
    expect(tuition).toMatchObject({ fee: 280, subsidy: 140 }); // 50%
    expect(impact.rows.find((r) => r.source === "School-created")!.fee).toBe(141); // FT-01 total
  });
});

describe("MOEFAS rules: rule editor validation", () => {
  const okDraft: RuleDraft = {
    name: "MOEFAS 2028", from: "2028-01-01", to: "2028-12-31", logic: "AND",
    tiers: [{ household: 0, perCapita: 0 }],
    lines: [{ ftId: "MFT-01", component: "Tuition Fee", basis: "percent", amounts: ["80"] }],
  };

  it("accepts a complete draft", () => {
    expect(ruleOk(validateRule(okDraft))).toBe(true);
  });

  it("rejects a missing name, an inverted period, a pending component and out-of-range percentages", () => {
    expect(validateRule({ ...okDraft, name: "  " }).name).toBeTruthy();
    expect(validateRule({ ...okDraft, from: "2028-12-31", to: "2028-01-01" }).period).toBeTruthy();
    expect(validateRule({ ...okDraft, lines: [{ ...okDraft.lines[0], component: "" }] }).rows[0]).toBeTruthy();
    expect(validateRule({ ...okDraft, lines: [{ ...okDraft.lines[0], amounts: ["150"] }] }).rows[0]).toBeTruthy();
    expect(validateRule({ ...okDraft, lines: [] }).lines).toBeTruthy();
  });

  it("draftOf round-trips a saved rule and defaults for a new one", () => {
    const back = draftOf(rule);
    expect(back.lines[0]).toEqual({ ftId: "MFT-01", component: "Tuition Fee", basis: "percent", amounts: ["80", "50"] });
    const fresh = draftOf(null);
    expect(fresh.name).toBe("MOEFAS");
    expect(fresh.tiers).toHaveLength(2);
    expect(toRule({ ...back, name: " X " }, "FASR9004", "Draft").name).toBe("X");
  });
});

describe("MOEFAS rules: store transitions", () => {
  it("saveRule inserts then updates in place", () => {
    const created = saveRule(FAS_RULES, { ...rule, id: "FASR9004", name: "New", status: "Draft" });
    expect(created).toHaveLength(4);
    const updated = saveRule(created, { ...created.find((r) => r.id === "FASR9004")!, name: "Renamed" });
    expect(updated).toHaveLength(4);
    expect(updated.find((r) => r.id === "FASR9004")!.name).toBe("Renamed");
  });

  it("activation keeps a single Active rule and flips the previous one to Inactive", () => {
    const res = activateRule(FAS_RULES, "FASR9002", "2025-06-01");
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.rules.find((r) => r.id === "FASR9002")!.status).toBe("Active");
      expect(res.rules.find((r) => r.id === "FASR9001")!.status).toBe("Inactive");
    }
  });

  it("activation is rejected outside the effective period and for an already Active rule", () => {
    expect(activateRule(FAS_RULES, "FASR9003")).toEqual({ ok: false, error: expect.stringContaining("effective period") });
    expect(activateRule(FAS_RULES, "FASR9001").ok).toBe(false);
  });

  it("refreshIncome simulates the MyInfo retry in the Tier 2 range", () => {
    const next = refreshIncome(MOEFAS_FAMILIES, "FAS20260003", "2026-10-12");
    const f = next.find((x) => x.id === "FAS20260003")!;
    expect(f.income).toMatchObject({ household: 2, perCapita: 2, failed: false });
    expect(familyOutcome(f.children.map((c) => assessChild(rule, f.income, c)))).toBe("MOEFAS granted");
    expect(next.find((x) => x.id === "FAS20260001")!.income.failed).toBe(false); // untouched
  });
});

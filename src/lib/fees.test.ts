import { describe, expect, test } from "vitest";
import { feeReducer, initialFeeState } from "../data/feeStore";
import { FEE_TYPES, type FeeType } from "../data/fees";
import { STUDENTS, type Student } from "../data/students";
import { aggregate, fasOf, feeDraftOk, feeOf, makeCharge, MOEFAS_RATE, nextChargeId, payableOf, SBFAS_RATE, seedCharges, studentsOfClass, subsidyOf, subsidyRate, validateFeeType } from "./fees";

const draft = (o = {}) => ({ name: "Trip", level: "", components: [{ name: "Bus", amount: "12.50", on: true }], ...o });

describe("charge maths", () => {
  const c = { components: [{ name: "a", amount: 0.1, subsidy: 0.05 }, { name: "b", amount: 0.2 }, { name: "c", amount: 10, subsidy: 99 }] };
  test("sums in cents and caps a subsidy at the component amount", () => {
    expect(feeOf(c)).toBe(10.3);
    expect(subsidyOf(c)).toBe(10.05);
    expect(payableOf(c)).toBe(0.25);
  });
});

describe("validateFeeType", () => {
  test("accepts a valid draft", () => {
    const r = validateFeeType(draft(), []);
    expect(feeDraftOk(r.errors)).toBe(true);
    expect(r.components).toEqual([{ name: "Bus", amount: 12.5 }]);
  });
  test("name required and unique per school, ignoring case and spacing", () => {
    expect(validateFeeType(draft({ name: " " }), []).errors.name).toBeTruthy();
    expect(validateFeeType(draft({ name: "school  FEES (primary)" }), FEE_TYPES).errors.name).toBeTruthy();
  });
  test("unticked rows are ignored; ticked rows need a name and an amount above 0 with 2 decimals", () => {
    expect(validateFeeType(draft({ components: [{ name: "", amount: "", on: false }, { name: "Bus", amount: "5", on: true }] }), []).components).toHaveLength(1);
    for (const amount of ["", "0", "-1", "1.234", "abc"]) expect(validateFeeType(draft({ components: [{ name: "Bus", amount, on: true }] }), []).errors.rows[0], amount).toBeTruthy();
    expect(validateFeeType(draft({ components: [{ name: "Bus", amount: "5", on: false }] }), []).errors.components).toBeTruthy();
  });
});

describe("generate", () => {
  const school = "S002";
  const ft = FEE_TYPES.find((f) => f.school === school)!;
  const klass = STUDENTS.find((s) => s.level === "P1")!.class;
  const students = studentsOfClass(school, klass);
  test("creates one unpaid charge per student with copied components and skips repeats for the same term", () => {
    const s0 = { ...initialFeeState(), charges: [] };
    const s1 = feeReducer(s0, { type: "generate", fee: ft, term: "2027 Term 1", students });
    expect(s1.charges).toHaveLength(students.length);
    expect(s1.charges.every((c) => c.status === "outstanding" && c.components.length === ft.components.length)).toBe(true);
    expect(feeReducer(s1, { type: "generate", fee: ft, term: "2027 Term 1", students }).charges).toHaveLength(students.length);
    expect(feeReducer(s1, { type: "generate", fee: ft, term: "2026 Term 4", students }).charges).toHaveLength(students.length * 2);
  });
  test("editing a fee type does not change issued charges", () => {
    const s1 = feeReducer({ ...initialFeeState(), charges: [] }, { type: "generate", fee: ft, term: "2027 Term 1", students });
    const s2 = feeReducer(s1, { type: "saveType", fee: { ...ft, components: [{ name: "New", amount: 1 }] } });
    expect(s2.charges[0].components).toHaveLength(ft.components.length);
    expect(s2.types.find((f) => f.id === ft.id)!.components).toHaveLength(1);
  });
});

test("seed charges: unique ids, aggregate splits collected and outstanding", () => {
  const rows = seedCharges();
  expect(new Set(rows.map((c) => c.id)).size).toBe(rows.length);
  const a = aggregate(rows);
  expect(a.collected + a.outstanding).toBeCloseTo(a.payable, 2);
  expect(a.overdue).toBeGreaterThan(0);
  expect(nextChargeId(rows)).toBe(`CH-${1000 + rows.length + 1}`);
});

const fasStudent = (moefas: Student["moefas"], sbfas: Student["sbfas"]): Student => ({
  id: "S1", name: "Test", level: "P1", class: "P1 Courage", status: "Enrolled", balance: 0, moefas, sbfas,
});
const fasFee: FeeType = { id: "FT-1", school: "S001", name: "Test fee", updated: "2026-10-12", components: [{ name: "Tuition", amount: 100 }, { name: "Materials", amount: 50 }] };

describe("fasOf — MOEFAS takes precedence over SBFAS (a student never receives both)", () => {
  test("MOEFAS when only MOEFAS is approved", () => {
    expect(fasOf(fasStudent("Approved", "Not applied"))).toEqual({ scheme: "MOEFAS", rate: MOEFAS_RATE });
  });
  test("MOEFAS wins even if both are approved — SBFAS is ignored", () => {
    expect(fasOf(fasStudent("Approved", "Approved"))?.scheme).toBe("MOEFAS");
  });
  test("SBFAS only when MOEFAS is not approved", () => {
    expect(fasOf(fasStudent("Not applied", "Approved"))).toEqual({ scheme: "SBFAS", rate: SBFAS_RATE });
    expect(fasOf(fasStudent("Rejected", "Approved"))?.scheme).toBe("SBFAS");
  });
  test("null when neither is approved", () => {
    expect(fasOf(fasStudent("Pending", "Pending"))).toBeNull();
    expect(fasOf(fasStudent("Not applied", "Not applied"))).toBeNull();
  });
});

describe("makeCharge — stamps the scheme and deducts its subsidy", () => {
  test("records fas and the per-component subsidy for MOEFAS", () => {
    const c = makeCharge("CH-1", fasFee, fasStudent("Approved", "Not applied"), "2026 Term 4");
    expect(c.fas).toBe("MOEFAS");
    expect(subsidyOf(c)).toBe(75);            // 50% of 150
    expect(payableOf(c)).toBe(75);
  });
  test("SBFAS subsidises less than MOEFAS on the same fee", () => {
    const moefas = makeCharge("CH-1", fasFee, fasStudent("Approved", "Not applied"), "2026 Term 4");
    const sbfas = makeCharge("CH-2", fasFee, fasStudent("Not applied", "Approved"), "2026 Term 4");
    expect(sbfas.fas).toBe("SBFAS");
    expect(subsidyOf(sbfas)).toBeLessThan(subsidyOf(moefas));
  });
  test("no fas and no subsidy without FAS", () => {
    const c = makeCharge("CH-1", fasFee, fasStudent("Not applied", "Not applied"), "2026 Term 4");
    expect(c.fas).toBeUndefined();
    expect(subsidyOf(c)).toBe(0);
    expect(subsidyRate(fasStudent("Not applied", "Not applied"))).toBe(0);
  });
});

describe("seed invariants", () => {
  test("no student has both schemes Approved at once", () => {
    expect(STUDENTS.filter((s) => s.moefas === "Approved" && s.sbfas === "Approved")).toEqual([]);
  });
  test("the mock data has both MOEFAS and SBFAS recipients", () => {
    expect(STUDENTS.some((s) => s.moefas === "Approved")).toBe(true);
    expect(STUDENTS.some((s) => s.sbfas === "Approved")).toBe(true);
  });
});

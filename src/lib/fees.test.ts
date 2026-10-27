import { initialRegistry } from "../data/registryStore";
import { studentsOfClass } from "./registry";
import { describe, expect, test } from "vitest";
import { feeReducer, initialFeeState } from "../data/feeStore";
import { FEE_TYPES, type FeeType } from "../data/fees";
import { STUDENTS, type Student } from "../data/students";
import { addDays, aggregate, balanceOf, chargeStatus, componentBalances, fasOf, feeDraftOk, feeOf, fundingOf, makeCharge, MOEFAS_RATE, nextChargeId, paidOf, payableOf, SBFAS_RATE, seedCharges, subsidyOf, subsidyRate, validateFeeType } from "./fees";

const draft = (o = {}) => ({ name: "Trip", level: "", components: [{ name: "Bus", amount: "12.50", on: true }], ...o });

describe("charge maths", () => {
  const c = { components: [{ name: "a", amount: 0.1, subsidy: 0.05 }, { name: "b", amount: 0.2 }, { name: "c", amount: 10, subsidy: 99 }], payments: [] };
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

describe("generate (no term: one charge per student per fee type per issue date)", () => {
  const school = "S002";
  const ft = FEE_TYPES.find((f) => f.school === school)!;
  const klass = STUDENTS.find((s) => s.level === "P1")!.class;
  const reg = initialRegistry();
  const students = studentsOfClass(reg.students, reg.classes, school, klass);
  const issued = "2026-10-12", due = "2026-11-11";
  test("creates one outstanding charge per student and skips repeats for the same issue date", () => {
    const s0 = { ...initialFeeState(), charges: [] };
    const s1 = feeReducer(s0, { type: "generate", fee: ft, students, issued, due });
    expect(s1.charges).toHaveLength(students.length);
    expect(s1.charges.every((c) => chargeStatus(c) === "outstanding" && c.components.length === ft.components.length)).toBe(true);
    expect(s1.charges.every((c) => c.issued === issued && c.due === due)).toBe(true);
    expect(feeReducer(s1, { type: "generate", fee: ft, students, issued, due }).charges).toHaveLength(students.length);
    expect(feeReducer(s1, { type: "generate", fee: ft, students, issued: "2026-11-12", due: "2026-12-12" }).charges).toHaveLength(students.length * 2);
  });
  test("editing a fee type does not change issued charges", () => {
    const s1 = feeReducer({ ...initialFeeState(), charges: [] }, { type: "generate", fee: ft, students, issued, due });
    const s2 = feeReducer(s1, { type: "saveType", fee: { ...ft, components: [{ name: "New", amount: 1 }] } });
    expect(s2.charges[0].components).toHaveLength(ft.components.length);
    expect(s2.types.find((f) => f.id === ft.id)!.components).toHaveLength(1);
  });
});

describe("derived status — outstanding/overdue/paid without terms", () => {
  const fasStudent = (moefas: Student["moefas"], sbfas: Student["sbfas"]): Student => ({
    id: "S1", nric: "T1800001A", name: "Test", level: "P1", class: "P1 Courage", status: "Active", balance: 0, moefas, sbfas,
  });
  const fasFee: FeeType = { id: "FT-1", school: "S001", name: "Test fee", updated: "2026-10-12", components: [{ name: "Tuition", amount: 100 }, { name: "Materials", amount: 50 }] };
  const yesterday = "2026-10-11", nextMonth = "2026-11-11";

  test("fresh charge with a future due date is outstanding", () => {
    const c = makeCharge("CH-1", fasFee, fasStudent("Not applied", "Not applied"), { issued: "2026-10-01", due: nextMonth });
    expect(chargeStatus(c)).toBe("outstanding");
  });
  test("unpaid past its due date is overdue — no term needed", () => {
    const c = makeCharge("CH-1", fasFee, fasStudent("Not applied", "Not applied"), { issued: "2026-09-01", due: yesterday });
    expect(chargeStatus(c)).toBe("overdue");
  });
  test("payments cover the payable → paid; partial payment stays overdue/outstanding with the rest owed", () => {
    const c = makeCharge("CH-1", fasFee, fasStudent("Not applied", "Not applied"), { issued: "2026-09-01", due: yesterday });
    const half = feeReducer({ ...initialFeeState(), charges: [c] }, { type: "recordPayment", chargeId: "CH-1", amount: payableOf(c) / 2, method: "Education account" }).charges[0];
    expect(paidOf(half)).toBe(payableOf(c) / 2);
    expect(balanceOf(half)).toBe(payableOf(c) / 2);
    expect(chargeStatus(half)).toBe("overdue");
    const full = feeReducer({ ...initialFeeState(), charges: [half] }, { type: "recordPayment", chargeId: "CH-1", amount: balanceOf(half), method: "Card / PayNow" }).charges[0];
    expect(chargeStatus(full)).toBe("paid");
    expect(fundingOf(full).fromAccount + fundingOf(full).fromGateway).toBe(payableOf(c));
  });
  test("paying one component leaves the others owed; untagged payments fill components in order", () => {
    const c = { ...makeCharge("CH-1", fasFee, fasStudent("Not applied", "Not applied"), { issued: "2026-09-01", due: yesterday }) };
    const [first, second] = c.components;
    const paid = feeReducer({ ...initialFeeState(), charges: [c] }, { type: "recordPayment", chargeId: "CH-1", amount: second.amount, method: "Card / PayNow", component: second.name }).charges[0];
    expect(componentBalances(paid)[1].amount).toBe(0);
    expect(componentBalances(paid)[0].amount).toBe(first.amount);
    expect(balanceOf(paid)).toBe(payableOf(c) - second.amount);
    const untagged = { ...c, payments: [{ id: "x", on: yesterday, amount: first.amount + 1, method: "Card / PayNow" as const }] };
    expect(componentBalances(untagged).slice(0, 2).map((p) => p.amount)).toEqual([0, second.amount - 1]);
  });
  test("default due date is 30 days after issue", () => {
    const c = makeCharge("CH-1", fasFee, fasStudent("Not applied", "Not applied"));
    expect(c.due).toBe(addDays(c.issued, 30));
  });
});

describe("fasOf — MOEFAS takes precedence over SBFAS (a student never receives both)", () => {
  const fasStudent = (moefas: Student["moefas"], sbfas: Student["sbfas"]): Student => ({
    id: "S1", nric: "T1800001A", name: "Test", level: "P1", class: "P1 Courage", status: "Active", balance: 0, moefas, sbfas,
  });
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
  const fasStudent = (moefas: Student["moefas"], sbfas: Student["sbfas"]): Student => ({
    id: "S1", nric: "T1800001A", name: "Test", level: "P1", class: "P1 Courage", status: "Active", balance: 0, moefas, sbfas,
  });
  const fasFee: FeeType = { id: "FT-1", school: "S001", name: "Test fee", updated: "2026-10-12", components: [{ name: "Tuition", amount: 100 }, { name: "Materials", amount: 50 }] };
  test("records fas and the per-component subsidy for MOEFAS (real scheme: school & misc fees waived in full)", () => {
    const c = makeCharge("CH-1", fasFee, fasStudent("Approved", "Not applied"));
    expect(c.fas).toBe("MOEFAS");
    expect(subsidyOf(c)).toBe(150);           // 100% of 150
    expect(payableOf(c)).toBe(0);
    expect(chargeStatus(c)).toBe("paid");     // fully subsidised — nothing left to pay
  });
  test("SBFAS subsidises less than MOEFAS on the same fee (school-defined 50% default)", () => {
    const moefas = makeCharge("CH-1", fasFee, fasStudent("Approved", "Not applied"));
    const sbfas = makeCharge("CH-2", fasFee, fasStudent("Not applied", "Approved"));
    expect(sbfas.fas).toBe("SBFAS");
    expect(subsidyOf(sbfas)).toBe(75);        // 50% of 150
    expect(subsidyOf(sbfas)).toBeLessThan(subsidyOf(moefas));
  });
  test("no fas and no subsidy without FAS", () => {
    const c = makeCharge("CH-1", fasFee, fasStudent("Not applied", "Not applied"));
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

test("seed charges: unique ids, no term, aggregate splits collected and outstanding by derived status", () => {
  const rows = seedCharges();
  expect(new Set(rows.map((c) => c.id)).size).toBe(rows.length);
  const a = aggregate(rows);
  expect(a.collected + a.outstanding).toBeCloseTo(a.payable, 2);
  expect(a.overdue).toBeGreaterThan(0);
  expect(a.paid).toBeGreaterThan(0);
  expect(a.fromAccount).toBeGreaterThan(0);
  expect(nextChargeId(rows)).toBe(`CH-${1000 + rows.length + 1}`);
});

describe("SBFAS tier sets the fee waiver", () => {
  const stu = (sbfasTier?: Student["sbfasTier"], moefas: Student["moefas"] = "Not applied"): Student => ({
    id: "S1", nric: "T1800001A", name: "Test", level: "P1", class: "P1 Courage", status: "Active", balance: 0, moefas, sbfas: "Approved", sbfasTier,
  });
  test("Tier 1 waives everything, then 75%, 50%, 25%", () => {
    expect(fasOf(stu("Tier 1"))).toEqual({ scheme: "SBFAS", rate: 1 });
    expect(fasOf(stu("Tier 2"))?.rate).toBe(0.75);
    expect(fasOf(stu("Tier 3"))?.rate).toBe(0.5);
    expect(fasOf(stu("Tier 4"))?.rate).toBe(0.25);
  });
  test("an approved student with no tier on record keeps the school default", () => {
    expect(fasOf(stu())?.rate).toBe(SBFAS_RATE);
  });
  test("MOEFAS still wins over any SBFAS tier", () => {
    expect(fasOf(stu("Tier 1", "Approved"))).toEqual({ scheme: "MOEFAS", rate: MOEFAS_RATE });
  });
});

describe("applyFas re-prices a student's unpaid charges only", () => {
  const ft = FEE_TYPES[0]; // components total 141
  const base = initialFeeState();
  const mk = (id: string, studentId: string) => ({ ...makeCharge(id, ft, { ...STUDENTS[0], id: studentId, sbfas: "Not applied", moefas: "Not applied" }), });
  const unpaid = mk("CH-1", "A");
  const partly = { ...mk("CH-2", "A"), payments: [{ id: "CH-2-P1", on: "2026-10-10", amount: 20, method: "Card / PayNow" as const }] };
  const paid = { ...mk("CH-3", "A"), payments: [{ id: "CH-3-P1", on: "2026-10-10", amount: 141, method: "Card / PayNow" as const }] };
  const other = mk("CH-4", "B");
  const state = { ...base, charges: [unpaid, partly, paid, other] };
  const out = feeReducer(state, { type: "applyFas", studentId: "A", fas: { scheme: "SBFAS", rate: 0.5 }, on: "2026-10-18" });
  const get = (id: string) => out.charges.find((c) => c.id === id)!;

  test("unpaid and part-paid charges get the subsidy and the scheme", () => {
    expect(subsidyOf(get("CH-1"))).toBe(70.5);
    expect(get("CH-1").fas).toBe("SBFAS");
    expect(subsidyOf(get("CH-2"))).toBe(70.5);
  });
  test("the change is recorded on the charge, not made silently", () => {
    expect(get("CH-1").fasAdjusted).toEqual({ on: "2026-10-18", amount: 70.5 });
  });
  test("a settled charge and other students' charges are untouched", () => {
    expect(get("CH-3")).toEqual(paid);
    expect(get("CH-4")).toEqual(other);
  });
  test("clearing FAS (null) removes the subsidy again", () => {
    const back = feeReducer(out, { type: "applyFas", studentId: "A", fas: null, on: "2026-10-19" });
    expect(subsidyOf(back.charges.find((c) => c.id === "CH-1")!)).toBe(0);
    expect(back.charges.find((c) => c.id === "CH-1")!.fas).toBeUndefined();
  });
  test("applying the same FAS twice changes nothing", () => {
    expect(feeReducer(out, { type: "applyFas", studentId: "A", fas: { scheme: "SBFAS", rate: 0.5 }, on: "2026-10-20" })).toEqual(out);
  });
});

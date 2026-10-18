import { expect, test } from "vitest";
import { isMoefasEligible, isSbfasEligible, STUDENTS } from "./students";

// BR12: MOE FAS is for Singapore Citizens only; dual-citizen children still count as SC.
test("isMoefasEligible: citizens and dual citizens pass, PRs and foreigners are SBFAS-only", () => {
  expect(isMoefasEligible("Singapore Citizen")).toBe(true);
  expect(isMoefasEligible("Dual (Singapore + British)")).toBe(true);
  expect(isMoefasEligible("Dual (Singapore + Malaysian)")).toBe(true);
  expect(isMoefasEligible("Singapore PR")).toBe(false);
  expect(isMoefasEligible("Malaysian")).toBe(false);
  expect(isMoefasEligible("Filipino")).toBe(false);
});

// BR12: SBFAS covers SC, dual and PR students; foreign nationals are not eligible for either scheme.
test("isSbfasEligible: SC, dual and PR pass, foreign nationals fail", () => {
  expect(isSbfasEligible("Singapore Citizen")).toBe(true);
  expect(isSbfasEligible("Dual (Singapore + Malaysian)")).toBe(true);
  expect(isSbfasEligible("Singapore PR")).toBe(true);
  expect(isSbfasEligible("Malaysian")).toBe(false);
  expect(isSbfasEligible("Indian")).toBe(false);
  expect(isSbfasEligible("Filipino")).toBe(false);
});

test("isMoefasEligible: unknown nationality does not raise a false alarm", () => {
  expect(isMoefasEligible("—")).toBe(true);
});

test("seed data keeps the rule observable: some applicants are non-SC, all duals are eligible", () => {
  const nationalities = STUDENTS.map((s) => s.nationality ?? "Singapore Citizen");
  expect(nationalities).toContain("Singapore PR");
  expect(nationalities).toContain("Dual (Singapore + British)");
  expect(nationalities.filter((n) => !isMoefasEligible(n)).length).toBeGreaterThan(0);
});

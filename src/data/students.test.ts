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

// SBFAS supports Singapore Citizens only (dual-Singapore counts as SC); PRs and foreign nationals are not eligible.
test("isSbfasEligible: SC and dual-Singapore pass, PR and foreign nationals fail", () => {
  expect(isSbfasEligible("Singapore Citizen")).toBe(true);
  expect(isSbfasEligible("Dual (Singapore + Malaysian)")).toBe(true);
  expect(isSbfasEligible("Singapore PR")).toBe(false);
  expect(isSbfasEligible("Malaysian")).toBe(false);
  expect(isSbfasEligible("Indian")).toBe(false);
  expect(isSbfasEligible("Filipino")).toBe(false);
});

test("isMoefasEligible: unknown nationality does not raise a false alarm", () => {
  expect(isMoefasEligible("—")).toBe(true);
});

test("seed data keeps the rule observable: PRs and duals exist, and nobody seeded for SBFAS is a foreign national", async () => {
  const { SBFAS_APPLICATIONS } = await import("./sbfasApplications");
  const nat = (id: string) => STUDENTS.find((s) => s.id === id)?.nationality ?? "Singapore Citizen";
  expect(STUDENTS.map((s) => s.nationality)).toContain("Singapore PR");
  expect(STUDENTS.map((s) => s.nationality)).toContain("Dual (Singapore + British)");
  expect(SBFAS_APPLICATIONS.every((a) => isSbfasEligible(nat(a.studentId)))).toBe(true);
});

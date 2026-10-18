import { expect, test } from "vitest";
import { SBFAS_APPLICATIONS, type SbfasApplication } from "../data/sbfasApplications";
import { STUDENTS } from "../data/students";
import { withBalance, withFas } from "./studentFas";

const stu = STUDENTS.find((s) => s.sbfas === "Not applied" && s.moefas === "Not applied")!;
const app = (status: SbfasApplication["status"], sbfasTier?: SbfasApplication["sbfasTier"]): SbfasApplication =>
  ({ id: "SBFAS-1", student: stu.name, studentId: stu.id, level: stu.level, incomeBand: "b", slaDays: 3, status, sbfasTier });

test("an approved application shows on the student record with its tier", () => {
  expect(withFas(stu, { apps: [app("Approved", "Tier 2")], moefas: {} })).toMatchObject({ sbfas: "Approved", sbfasTier: "Tier 2" });
});

test("a pending or rejected application shows as such, with no tier", () => {
  expect(withFas(stu, { apps: [app("Pending")], moefas: {} })).toMatchObject({ sbfas: "Pending", sbfasTier: undefined });
  expect(withFas(stu, { apps: [app("Rejected")], moefas: {} })).toMatchObject({ sbfas: "Rejected", sbfasTier: undefined });
});

test("a student with no application keeps the record as it is", () => {
  expect(withFas(stu, { apps: [], moefas: {} })).toBe(stu);
});

test("MOEFAS on the record is never changed by an SBFAS decision", () => {
  const m = { ...stu, moefas: "Approved" as const };
  expect(withFas(m, { apps: [app("Approved", "Tier 1")], moefas: {} }).moefas).toBe("Approved");
});

test("seed data agrees: every Pending student has an application, and no applicant is already decided", () => {
  const applicants = new Set(SBFAS_APPLICATIONS.map((a) => a.studentId));
  for (const s of STUDENTS.filter((x) => x.sbfas === "Pending")) expect(applicants.has(s.id), s.name).toBe(true);
  for (const a of SBFAS_APPLICATIONS) {
    const s = STUDENTS.find((x) => x.id === a.studentId)!;
    expect(s.sbfas, a.student).not.toBe("Approved");
    expect(s.sbfas, a.student).not.toBe("Rejected");
  }
});

test("a MOEFAS grant shows on the student record", () => {
  expect(withFas(stu, { apps: [], moefas: { [stu.id]: { tier: "Tier 2", at: "2026-10-18T09:00:00.000Z" } } }).moefas).toBe("Approved");
});

test("the live balance subtracts what was paid from the account, and applying it again changes nothing", () => {
  const once = withBalance(stu, { [stu.id]: 35.25 });
  expect(once.balance).toBe(Math.round((stu.balance - 35.25) * 100) / 100);
  expect(withBalance(once, { [stu.id]: 35.25 })).toEqual(once); // records are passed from page to page, so this must be safe to repeat
  expect(withBalance(stu, {}).balance).toBe(stu.balance);
});

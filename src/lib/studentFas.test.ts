import { expect, test } from "vitest";
import { SBFAS_APPLICATIONS, type SbfasApplication } from "../data/sbfasApplications";
import { STUDENTS } from "../data/students";
import { withFas } from "./studentFas";

const stu = STUDENTS.find((s) => s.sbfas === "Not applied" && s.moefas === "Not applied")!;
const app = (status: SbfasApplication["status"], sbfasTier?: SbfasApplication["sbfasTier"]): SbfasApplication =>
  ({ id: "SBFAS-1", student: stu.name, studentId: stu.id, level: stu.level, incomeBand: "b", slaDays: 3, status, sbfasTier });

test("an approved application shows on the student record with its tier", () => {
  expect(withFas(stu, [app("Approved", "Tier 2")])).toMatchObject({ sbfas: "Approved", sbfasTier: "Tier 2" });
});

test("a pending or rejected application shows as such, with no tier", () => {
  expect(withFas(stu, [app("Pending")])).toMatchObject({ sbfas: "Pending", sbfasTier: undefined });
  expect(withFas(stu, [app("Rejected")])).toMatchObject({ sbfas: "Rejected", sbfasTier: undefined });
});

test("a student with no application keeps the record as it is", () => {
  expect(withFas(stu, [])).toBe(stu);
});

test("MOEFAS on the record is never changed by an SBFAS decision", () => {
  const m = { ...stu, moefas: "Approved" as const };
  expect(withFas(m, [app("Approved", "Tier 1")]).moefas).toBe("Approved");
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

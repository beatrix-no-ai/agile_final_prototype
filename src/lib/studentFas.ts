import type { SbfasApplication } from "../data/sbfasApplications";
import type { Student } from "../data/students";

/**
 * The student as the school's SBFAS decisions see it: when the student has an application, its status and tier
 * are the truth (Pending, Approved at a tier, or Rejected). No application = the record is left as it is.
 * MOEFAS is never touched here.
 */
export function withFas(s: Student, apps: readonly SbfasApplication[]): Student {
  const a = apps.find((x) => x.studentId === s.id);
  if (!a) return s;
  return { ...s, sbfas: a.status, sbfasTier: a.status === "Approved" ? a.sbfasTier : undefined };
}

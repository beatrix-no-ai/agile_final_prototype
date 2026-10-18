import { expect, test } from "vitest";
import { buildFamilyApps, familyOutcome, reviewPhase } from "./familySubmission";
import { SBFAS_APPLICATIONS, type SbfasApplication } from "./sbfasApplications";

test("buildFamilyApps: only the SBFAS band creates per-child applications in the school queue", () => {
  expect(buildFamilyApps(SBFAS_APPLICATIONS, "b1", "2026-10-18", "")).toEqual([]); // MOEFAS band: decided at MOE level
  expect(buildFamilyApps(SBFAS_APPLICATIONS, "b4", "2026-10-18", "")).toEqual([]); // above both schemes
  const apps = buildFamilyApps(SBFAS_APPLICATIONS, "b3", "2026-10-18", "Second child started Sec school");
  expect(apps.map((a) => a.student)).toEqual(["Ethan Lim", "Chloe Lim"]);
  expect(apps.every((a) => a.status === "Pending")).toBe(true);
  // Ids continue the shared SBFASXXXX sequence after the highest existing one
  expect(apps[0].id).toBe("SBFAS0013");
  expect(apps[1].id).toBe("SBFAS0014");
  // Each application links to the child's admin student record
  expect(apps.every((a) => a.studentId.startsWith("S2026"))).toBe(true);
  expect(apps[0].explanation).toContain("Second child started Sec school");
});

test("familyOutcome: any grant approves the family application", () => {
  const apps = buildFamilyApps(SBFAS_APPLICATIONS, "b3", "2026-10-18", "");
  const family = { submittedOn: "2026-10-18", appIds: apps.map((a) => a.id) };
  expect(familyOutcome(SBFAS_APPLICATIONS, null)).toEqual({ phase: "not-submitted" });
  expect(familyOutcome([...SBFAS_APPLICATIONS, ...apps], family).phase).toBe("pending");

  const decide = (id: string, status: SbfasApplication["status"]): SbfasApplication[] =>
    [...SBFAS_APPLICATIONS, ...apps].map((a) => (a.id === id ? { ...a, status } : a));
  const one = familyOutcome(decide(apps[0].id, "Approved"), family);
  expect(one.phase).toBe("pending"); // one child still pending
  const both = familyOutcome(decide(apps[0].id, "Approved").map((a) => (a.id === apps[1].id ? { ...a, status: "Rejected" } : a)), family);
  expect(both).toMatchObject({ phase: "approved", granted: 1, decided: 2, total: 2 });
  const none = familyOutcome(decide(apps[0].id, "Rejected").map((a) => (a.id === apps[1].id ? { ...a, status: "Rejected" } : a)), family);
  expect(none.phase).toBe("not-approved");
  expect(reviewPhase(none)).toBe("decided");
});

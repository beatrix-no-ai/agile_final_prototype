import { expect, test } from "vitest";
import { applyDecision, isDeclined, isGranted, sortQueue, validateDecision } from "./review";
import { nextSbfasId, SBFAS_APPLICATIONS, type SbfasApplication } from "../../../data/sbfasApplications";
import { STUDENTS } from "../../../data/students";

const app = (id: string, slaDays: number, status: SbfasApplication["status"] = "Pending"): SbfasApplication => ({
  id, student: id, studentId: "S1", level: "P5", incomeBand: "b", slaDays, status,
});

test("sortQueue: pending first, then the closest decision deadline first", () => {
  const out = sortQueue([app("a", 5), app("b", 1, "Approved"), app("c", 2), app("d", 0)]);
  expect(out.map((a) => a.id)).toEqual(["d", "c", "a", "b"]);
});

test("approving needs a tier, and nothing else", () => {
  expect(validateDecision("approve", { justification: "", tier: "" })).toEqual({ field: "tier", message: expect.any(String) });
  expect(validateDecision("approve", { justification: "", tier: "Tier 2" })).toBeNull();
});

test("rejecting needs a reason, a blank one does not count", () => {
  expect(validateDecision("reject", { justification: "", tier: "" })?.field).toBe("justification");
  expect(validateDecision("reject", { justification: "   ", tier: "" })?.field).toBe("justification");
  expect(validateDecision("reject", { justification: "Income above the SBFAS range", tier: "" })).toBeNull();
});

test("applyDecision sets status, tier and reason on one app only", () => {
  const list = [app("a", 3), app("b", 1)];
  const approved = applyDecision(list, "b", "approve", { justification: " note ", tier: "Tier 1" });
  expect(approved[1]).toMatchObject({ status: "Approved", sbfasTier: "Tier 1", justification: "note" });
  expect(approved[0].status).toBe("Pending");
  expect(applyDecision(list, "a", "reject", { justification: " too high ", tier: "Tier 2" })[0]).toMatchObject({
    status: "Rejected", sbfasTier: undefined, justification: "too high",
  });
});

test("decision history tabs: approved is granted, rejected is declined, pending is neither", () => {
  expect(isGranted({ status: "Approved" })).toBe(true);
  expect(isGranted({ status: "Rejected" })).toBe(false);
  expect(isGranted({ status: "Pending" })).toBe(false);
  expect(isDeclined({ status: "Rejected" })).toBe(true);
  expect(isDeclined({ status: "Approved" })).toBe(false);
  expect(isDeclined({ status: "Pending" })).toBe(false);
});

test("every seeded application links to a real student record (name, id and level agree)", () => {
  for (const a of SBFAS_APPLICATIONS) {
    const s = STUDENTS.find((x) => x.id === a.studentId);
    expect(s, a.id).toBeDefined();
    expect(s!.name).toBe(a.student);
    expect(s!.level).toBe(a.level);
  }
});

test("seeded applications carry no AI fields", () => {
  for (const a of SBFAS_APPLICATIONS) expect(Object.keys(a)).not.toEqual(expect.arrayContaining(["riskScore"]));
});

test("nextSbfasId: SBFAS-XXXX format, 4-digit padded, continues from the highest sequence", () => {
  expect(nextSbfasId(SBFAS_APPLICATIONS)).toBe("SBFAS-2059");    // highest seed is SBFAS-2058
  expect(nextSbfasId([])).toBe("SBFAS-2001");                     // empty queue starts above the 20xx seed series
  expect(nextSbfasId([{ id: "SBFAS-0999" }])).toBe("SBFAS-2001"); // floor 2000 keeps new ids clear of old seeds
  expect(nextSbfasId([{ id: "SBFAS-9999" }])).toBe("SBFAS-10000"); // past 9999 the digits grow, nothing breaks
});

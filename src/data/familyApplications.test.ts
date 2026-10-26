import { describe, expect, it } from "vitest";
import { childOutcomeNow, type FamilyApplication, type FamilyChild } from "./familyApplications";
import type { SbfasApplication } from "./sbfasApplications";

const fa = (id: string): FamilyApplication => ({
  id, channel: "Hardcopy", school: "Greenfield Secondary School", applicant: "Benson Chua", contact: "",
  bandLabel: "$1,001 - $1,500 per person", enteredBy: "Alicia Tan", entryMode: "manual", at: "2026-10-25T09:00:00.000Z", children: [],
});

const child = (outcome: FamilyChild["outcome"], studentId = "S1", tier?: FamilyChild["tier"]): FamilyChild =>
  ({ studentId, student: "Chloe", level: "Sec 2", outcome, tier });

type Mini = Pick<SbfasApplication, "studentId" | "familyAppId" | "status" | "sbfasTier" | "attemptNo">;
const app = (over: Partial<Mini>): Mini => ({ studentId: "S1", familyAppId: "FAS20260005", status: "Pending", ...over });

describe("childOutcomeNow — the live per-child outcome on the history lists", () => {
  it("keeps the MOE grant as assessed at submit time", () => {
    expect(childOutcomeNow(fa("FAS20260005"), child("MOEFAS granted", "S1", "Tier 1"), [])).toEqual({
      label: "MOEFAS granted · Tier 1", kind: "granted",
    });
  });

  it("shows a referred child as SBFAS pending while the school has not decided", () => {
    expect(childOutcomeNow(fa("FAS20260005"), child("MOEFAS not granted"), [app({})])).toEqual({
      label: "SBFAS pending", kind: "pending",
    });
    // no linked application at all (e.g. other school's record not in view) also reads as pending
    expect(childOutcomeNow(fa("FAS20260005"), child("MOEFAS not granted"), []).kind).toBe("pending");
  });

  it("follows the school's decision: granted with its tier, or not granted after a rejection", () => {
    const c = child("MOEFAS not granted");
    expect(childOutcomeNow(fa("FAS20260005"), c, [app({ status: "Approved", sbfasTier: "Tier 2" })])).toEqual({
      label: "SBFAS granted · Tier 2", kind: "granted",
    });
    expect(childOutcomeNow(fa("FAS20260005"), c, [app({ status: "Rejected" })])).toEqual({
      label: "SBFAS not granted", kind: "rejected",
    });
  });

  it("reads the latest attempt for a flow-2 record (New SBFAS request)", () => {
    const c = child("New SBFAS request");
    expect(childOutcomeNow(fa("FAS20260006"), c, [
      app({ familyAppId: "FAS20260006", attemptNo: 2, status: "Rejected" }),
    ])).toEqual({ label: "SBFAS not granted", kind: "rejected" });
  });

  it("ignores another family's application for the same child", () => {
    const c = child("MOEFAS not granted");
    expect(childOutcomeNow(fa("FAS20260005"), c, [app({ familyAppId: "FAS20260009", status: "Rejected" })]).kind).toBe("pending");
  });

  it("keeps Already covered neutral", () => {
    expect(childOutcomeNow(fa("FAS20260005"), child("Already covered"), [])).toEqual({
      label: "Already covered", kind: "neutral",
    });
  });
});

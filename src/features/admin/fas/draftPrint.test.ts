import { describe, expect, it } from "vitest";
import { nextDraftId, type FamilyDraft } from "../../../data/familyApplications";
import { draftHtml } from "./draftPrint";

const draft: FamilyDraft = {
  id: "DRF-0001",
  status: "draft",
  guardianNric: "S1234567D",
  applicant: "Benson Chua",
  contact: "+65 8112 9743",
  address: "Blk 315 Ang Mo Kio Ave 3, #07-221, Singapore 560315",
  email: "benson.chua@example.com",
  children: [
    { studentId: "S20260009", name: "Ethan Lim Jun Hao", nric: "T1504644E", school: "Riverbank Primary School", level: "P5" },
    { studentId: "S20260010", name: "Chloe Lim Wen Xin", nric: "T1203822J", school: "Greenfield Secondary School", level: "Sec 2" },
  ],
  issuedAt: "2026-10-26",
  issuedBy: "Marcus Ong",
};

describe("nextDraftId", () => {
  it("runs the DRF-#### sequence from the highest existing draft", () => {
    expect(nextDraftId([])).toBe("DRF-0001");
    expect(nextDraftId([{ id: "DRF-0002" }])).toBe("DRF-0003");
  });
});

describe("the printed pre-filled form", () => {
  const html = draftHtml(draft, "Greenfield Secondary School");

  it("pre-fills the registry's own values for the parent to check", () => {
    expect(html).toContain("Ethan Lim Jun Hao");
    expect(html).toContain("T1203822J");
    expect(html).toContain("Riverbank Primary School");
    expect(html).toContain("Benson Chua");
    expect(html).toContain("DRF-0001");
  });

  it("tells the parent to check, not amend, the pre-filled fields", () => {
    expect(html).toContain("do not amend the pre-filled fields yourself");
  });

  it("leaves the household fields and the signature for the parent to fill by hand", () => {
    expect(html).toContain("Section II — Household income");
    expect(html).toContain("Extra monthly money");
    expect(html).toContain("People currently living in your home");
    expect(html).toContain("Section III — Declaration");
    expect(html).toContain("Signature of applicant");
    expect(html).toContain("Benson Chua</div><div>Date");
  });

  it("asks the parent yes / no whether the printed contact details still stand, with lines for new ones", () => {
    expect(html).toContain("Parent / guardian to fill — are these details still correct?");
    expect(html).toContain("<b>Yes</b> — the contact number and home address printed above are still correct.");
    expect(html).toContain("<b>No</b> — write the current details on the lines below.");
    expect(html).toContain("Tick one box only");
    // Two fill-in lines in Section I: the pre-filled values stay for checking, the blanks carry what the parent writes.
    expect((html.match(/Contact number:<\/b> ___/g) ?? []).length).toBe(1);
    expect((html.match(/Home address:<\/b> ___/g) ?? []).length).toBe(1);
    expect(html.indexOf("Home address:</b> ___")).toBeGreaterThan(html.indexOf("Home address:</b> Blk 315"));
  });
});

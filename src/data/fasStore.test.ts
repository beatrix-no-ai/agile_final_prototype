import { describe, expect, it } from "vitest";
import { MOEFAS_TIER_AMOUNT, SBFAS, SBFAS_BY_TIER, SBFAS_TIER_AMOUNT } from "./budgets";
import type { Band } from "./familyFas";
import { FAMILY_STUDENT_NAMES } from "./parent";
import { STUDENTS } from "./students";
import { fasReducer, initialFasState, selectBudgets, selectChildFas, selectMoefas, selectRecentGrants, selectSbfas } from "./fasStore";

const first = (s = initialFasState()) => s.apps[0]; // SBFAS0001, recommended Tier 1
const approveAt = (s: ReturnType<typeof initialFasState>, id: string, at: string) =>
  fasReducer(s, { type: "decide", id, action: "approve", draft: { justification: "", tier: "Tier 1" }, at });
const approve = (s = initialFasState()) => approveAt(s, first(s).id, "2026-10-18T09:00:00.000Z");

describe("SBFAS stats follow real decisions", () => {
  it("starts at the seeded baseline", () => {
    const s = selectSbfas(initialFasState());
    expect(s).toMatchObject({ budget: SBFAS.budget, used: SBFAS.absorbed, remaining: SBFAS.budget - SBFAS.absorbed });
    expect(s.helped).toBe(SBFAS_BY_TIER.reduce((t, x) => t + x.byClass.reduce((a, b) => a + b, 0), 0));
    expect(s.byTier.reduce((t, x) => t + x.value, 0)).toBe(s.helped);
  });

  it("approving an application adds its tier amount and one student helped", () => {
    const s = selectSbfas(approve());
    expect(s.used).toBe(SBFAS.absorbed + (SBFAS_TIER_AMOUNT["Tier 1"] ?? 0));
    expect(s.helped).toBe(148 + 1);
    expect(s.byTier.find((t) => t.label === "Tier 1")!.value).toBe(52 + 1);
  });

  it("rejecting adds nothing", () => {
    const s0 = initialFasState();
    const s = fasReducer(s0, { type: "decide", id: first(s0).id, action: "reject", draft: { justification: "", tier: "Tier 1" }, at: "2026-10-18T09:00:00.000Z" });
    expect(selectSbfas(s).used).toBe(SBFAS.absorbed);
  });

  it("a grant is still recorded when the budget is already exceeded", () => {
    let s = fasReducer(initialFasState(), { type: "setBudget", scope: "SBFAS", target: "SBFAS", amount: 1000, by: "A", at: "2026-10-18" });
    s = approve(s);
    expect(first(s).status).toBe("Approved");
    expect(selectSbfas(s).remaining).toBeLessThan(0);
  });
});

describe("setBudget", () => {
  it("changes the SBFAS budget and keeps old value, new value, user and date", () => {
    const s = fasReducer(initialFasState(), { type: "setBudget", scope: "SBFAS", target: "SBFAS", amount: 150000, by: "Alicia Tan", at: "2026-10-18" });
    expect(selectSbfas(s).budget).toBe(150000);
    expect(s.history).toEqual([expect.objectContaining({ scope: "SBFAS", from: SBFAS.budget, to: 150000, by: "Alicia Tan", at: "2026-10-18" })]);
  });

  it("changes one MOEFAS level only and totals follow", () => {
    const before = selectMoefas(initialFasState());
    const s = fasReducer(initialFasState(), { type: "setBudget", scope: "MOEFAS", target: "Primary", amount: 21_000_000, by: "Daniel Lim", at: "2026-10-18" });
    const after = selectMoefas(s);
    expect(after.levels.find((l) => l.id === "Primary")!.budget).toBe(21_000_000);
    expect(after.levels.find((l) => l.id === "Secondary")!.budget).toBe(before.levels.find((l) => l.id === "Secondary")!.budget);
    expect(after.budget).toBe(before.budget + 1_000_000);
    expect(s.history[0]).toMatchObject({ scope: "MOEFAS", target: "Primary", from: 20_000_000, to: 21_000_000 });
  });

  it("newest change is first in the history", () => {
    let s = fasReducer(initialFasState(), { type: "setBudget", scope: "SBFAS", target: "SBFAS", amount: 1, by: "A", at: "d1" });
    s = fasReducer(s, { type: "setBudget", scope: "SBFAS", target: "SBFAS", amount: 2, by: "A", at: "d2" });
    expect(s.history.map((h) => h.to)).toEqual([2, 1]);
  });
});

it("selectBudgets feeds the dashboard card in the same shape as before", () => {
  const [moefas, sbfas] = selectBudgets(initialFasState());
  expect(moefas).toMatchObject({ name: "MOEFAS", owner: "MOE HQ", budget: 38_000_000 });
  expect(sbfas).toMatchObject({ name: "SBFAS", owner: "School", used: SBFAS.absorbed, budget: SBFAS.budget });
});

describe("recent grants", () => {
  it("is empty until something is granted", () => {
    expect(selectRecentGrants(initialFasState())).toEqual([]);
  });

  it("lists granted applications newest first with tier, amount and date", () => {
    const s0 = initialFasState();
    let s = approveAt(s0, s0.apps[0].id, "2026-10-18T09:00:00.000Z");
    s = approveAt(s, s0.apps[1].id, "2026-10-18T10:30:00.000Z");
    const out = selectRecentGrants(s);
    expect(out.map((g) => g.id)).toEqual([s0.apps[1].id, s0.apps[0].id]);
    expect(out[0]).toMatchObject({ student: s0.apps[1].student, tier: "Tier 1", amount: SBFAS_TIER_AMOUNT["Tier 1"], at: "2026-10-18T10:30:00.000Z" });
  });

  it("leaves out rejected and pending applications", () => {
    const s0 = initialFasState();
    const s = fasReducer(s0, { type: "decide", id: s0.apps[0].id, action: "reject", draft: { justification: "", tier: "Tier 1" }, at: "2026-10-18T09:00:00.000Z" });
    expect(selectRecentGrants(s)).toEqual([]);
  });

  it("shows at most the limit", () => {
    const s0 = initialFasState();
    const s = s0.apps.slice(0, 4).reduce((acc, a, i) => approveAt(acc, a.id, `2026-10-18T0${i}:00:00.000Z`), s0);
    expect(selectRecentGrants(s, 3)).toHaveLength(3);
  });
});

it("MOEFAS students helped by tier add up to the students helped total", () => {
  const m = selectMoefas(initialFasState());
  expect(m.byTier.reduce((t, x) => t + x.value, 0)).toBe(m.helped);
  expect(m.byTier.map((t) => t.label)).toEqual(["Tier 1", "Tier 2", "Tier 3", "Tier 4"]);
});

describe("a family application from the parent portal", () => {
  const [ethan, chloe] = FAMILY_STUDENT_NAMES.map((n) => STUDENTS.find((s) => s.name === n)!);
  const ids = [ethan.id, chloe.id];
  const at = "2026-10-18T09:00:00.000Z";
  const submit = (tier: "MOEFAS Tier 1" | "MOEFAS Tier 2" | "SBFAS" | null, s = initialFasState()) =>
    fasReducer(s, { type: "submitFamily", studentIds: ids, band: { id: "bx", label: "$751 - $1,000 per person", tier }, at });

  it("an unmapped band falls back to a tier the school offers, not a hard-coded Tier 3", () => {
    const recommend = { [ethan.id]: { level: null, tier: null, fallback: "Tier 2" as const } };
    const s = fasReducer(initialFasState(), { type: "submitFamily", studentIds: [ethan.id], band: { id: "b3", label: "x", tier: "SBFAS" }, at, recommend });
    expect(s.apps.find((a) => a.studentId === ethan.id)!.recommendedTier).toBe("Tier 2");
  });

  it("a MOEFAS band grants MOEFAS straight away for every child", () => {
    const s = submit("MOEFAS Tier 2");
    expect(s.moefas[ethan.id]).toEqual({ tier: "Tier 2", at });
    expect(s.moefas[chloe.id].tier).toBe("Tier 2");
    expect(s.apps).toHaveLength(initialFasState().apps.length);
  });

  it("MOEFAS grants count in the HQ budget: amount, students helped and the child's level", () => {
    const before = selectMoefas(initialFasState());
    const after = selectMoefas(submit("MOEFAS Tier 2"));
    expect(after.used).toBe(before.used + 2 * (MOEFAS_TIER_AMOUNT["Tier 2"] ?? 0));
    expect(after.helped).toBe(before.helped + 2);
    expect(after.levels.find((l) => l.id === "Primary")!.beneficiaries).toBe(before.levels.find((l) => l.id === "Primary")!.beneficiaries + 1);
    expect(after.levels.find((l) => l.id === "Secondary")!.used).toBe(before.levels.find((l) => l.id === "Secondary")!.used + (MOEFAS_TIER_AMOUNT["Tier 2"] ?? 0));
    expect(after.byTier.find((t) => t.label === "Tier 2")!.value).toBe(before.byTier.find((t) => t.label === "Tier 2")!.value + 2);
  });

  it("an SBFAS band puts one pending application per child in the school's queue", () => {
    const s = submit("SBFAS");
    const added = s.apps.slice(initialFasState().apps.length);
    expect(added.map((a) => a.studentId)).toEqual(ids);
    expect(added.every((a) => a.status === "Pending" && a.incomeBand === "$751 - $1,000 per person")).toBe(true);
    expect(new Set(s.apps.map((a) => a.id)).size).toBe(s.apps.length);
    expect(Object.keys(s.moefas)).toHaveLength(0);
  });

  it("a band above both schemes changes nothing", () => {
    expect(submit(null)).toEqual(initialFasState());
  });

  it("submitting again does not duplicate applications or grants", () => {
    expect(submit("SBFAS", submit("SBFAS"))).toEqual(submit("SBFAS"));
    expect(submit("MOEFAS Tier 1", submit("MOEFAS Tier 1"))).toEqual(submit("MOEFAS Tier 1"));
  });

  it("each child's outcome follows the school's decision", () => {
    expect(selectChildFas(initialFasState(), ethan.id)).toBeNull();
    expect(selectChildFas(submit("MOEFAS Tier 1"), ethan.id)).toEqual({ scheme: "MOEFAS", status: "Granted", tier: "Tier 1" });
    const s = submit("SBFAS");
    expect(selectChildFas(s, ethan.id)).toEqual({ scheme: "SBFAS", status: "Awaiting school decision" });
    const appId = s.apps.find((a) => a.studentId === ethan.id)!.id;
    const ok = fasReducer(s, { type: "decide", id: appId, action: "approve", draft: { justification: "", tier: "Tier 3" }, at });
    expect(selectChildFas(ok, ethan.id)).toEqual({ scheme: "SBFAS", status: "Granted", tier: "Tier 3" });
    const no = fasReducer(s, { type: "decide", id: appId, action: "reject", draft: { justification: "Income above range", tier: "Tier 1" }, at });
    expect(selectChildFas(no, ethan.id)).toEqual({ scheme: "SBFAS", status: "Not granted", reason: "Income above range" });
  });
});

describe("a hardcopy application entered at the school (Requirement 5)", () => {
  const [ethan, chloe] = FAMILY_STUDENT_NAMES.map((n) => STUDENTS.find((s) => s.name === n)!);
  const at = "2026-10-20T09:00:00.000Z";
  const band = (tier: "MOEFAS Tier 1" | "MOEFAS Tier 2" | "SBFAS" | null) => ({ id: "b3", label: "$1,001 - $1,500 per person", tier });
  const paper = (tier: "MOEFAS Tier 1" | "MOEFAS Tier 2" | "SBFAS" | null, s = initialFasState(), studentIds = [ethan.id, chloe.id]) =>
    fasReducer(s, { type: "submitHardcopy", studentIds, band: band(tier), school: "Riverbank Primary School", applicant: "Benson Chua", contact: "+65 8112 9743", note: "", by: "Alicia Tan", entryMode: "ocr", at });

  it("a MOEFAS band on the paper form grants MOEFAS for every child and records the family application", () => {
    const s = paper("MOEFAS Tier 1");
    expect(s.moefas[ethan.id]).toEqual({ tier: "Tier 1", at });
    expect(s.moefas[chloe.id].tier).toBe("Tier 1");
    expect(s.apps).toHaveLength(initialFasState().apps.length);
    expect(s.familyApps).toHaveLength(1);
    expect(s.familyApps[0]).toMatchObject({ id: "FAS20260005", channel: "Hardcopy", school: "Riverbank Primary School", entryMode: "ocr" });
    expect(s.familyApps[0].children.map((c) => c.outcome)).toEqual(["MOEFAS granted", "MOEFAS granted"]);
  });

  it("a band outside MOEFAS refers every child to the school's SBFAS queue as a MOE referral linked to the form", () => {
    const s = paper("SBFAS");
    const added = s.apps.slice(initialFasState().apps.length);
    expect(added.map((a) => a.studentId)).toEqual([ethan.id, chloe.id]);
    expect(added.every((a) => a.source === "MOE referral" && a.familyAppId === "FAS20260005" && a.enteredBy === "Alicia Tan" && a.status === "Pending")).toBe(true);
    expect(s.familyApps[0].children.every((c) => c.outcome === "MOEFAS not granted")).toBe(true);
  });

  it("consecutive paper records number FAS20260005, FAS20260006 — the year prefix is not folded into the sequence", () => {
    const first = paper("SBFAS", initialFasState(), [ethan.id]);
    const second = paper("SBFAS", first, [chloe.id]);
    expect(second.familyApps.map((f) => f.id)).toEqual(["FAS20260006", "FAS20260005"]);
  });

  it("ASSUMPTION (AC-024-02): a paper form in the band above both schemes still reaches the school queue", () => {
    const s = paper(null);
    expect(s.apps).toHaveLength(initialFasState().apps.length + 2); // both children referred down, nothing vanishes
    expect(s.familyApps[0].children.every((c) => c.outcome === "MOEFAS not granted")).toBe(true);
  });

  it("a student that already has an application — paper or online — is skipped, not duplicated (AC-031)", () => {
    const online = fasReducer(initialFasState(), { type: "submitFamily", studentIds: [ethan.id], band: band("SBFAS"), at });
    const s = paper("SBFAS", online, [ethan.id, chloe.id]);
    expect(s.apps.filter((a) => a.studentId === ethan.id)).toHaveLength(1);
    expect(s.apps.filter((a) => a.studentId === chloe.id)).toHaveLength(1);
    // The school user transcribes the form as the parent filled it: the covered child STAYS on the
    // paper record, marked covered, instead of being silently dropped from the form's content.
    expect(s.familyApps[0].children.map((c) => [c.studentId, c.outcome])).toEqual([
      [ethan.id, "Already covered"],
      [chloe.id, "MOEFAS not granted"],
    ]);
  });

  it("a form whose every child is already covered creates nothing (AC-031)", () => {
    const online = fasReducer(initialFasState(), { type: "submitFamily", studentIds: [ethan.id], band: band("SBFAS"), at });
    const s = paper("SBFAS", online, [ethan.id]);
    expect(s).toBe(online); // no family record, no queue entry — nothing new to submit
  });

  it("submitting the same paper form twice changes nothing the second time", () => {
    expect(paper("SBFAS", paper("SBFAS"))).toEqual(paper("SBFAS"));
  });

  it("records the six-section form detail on the paper application", () => {
    const s = fasReducer(initialFasState(), {
      type: "submitHardcopy", studentIds: [ethan.id], band: band("SBFAS"), school: "Riverbank Primary School",
      applicant: "Benson Chua", contact: "+65 8112 9743", note: "", by: "Alicia Tan", entryMode: "ocr", at,
      address: "Blk 315 Ang Mo Kio Ave 3", email: "benson.chua@example.com", transportMode: "Public transport",
      hasAdminIncome: true, household: [{ name: "Benson Chua", nric: "S1234567D", relationship: "Father", age: 44, occupation: "Employed", gross: 2100, other: 150 }],
      declaredAt: "2026-10-24",
    });
    expect(s.familyApps[0]).toMatchObject({
      address: "Blk 315 Ang Mo Kio Ave 3", email: "benson.chua@example.com", transportMode: "Public transport",
      hasAdminIncome: true, declaredAt: "2026-10-24",
    });
    expect(s.familyApps[0].household).toEqual([
      { name: "Benson Chua", nric: "S1234567D", relationship: "Father", age: 44, occupation: "Employed", gross: 2100, other: 150 },
    ]);
  });

  it("keeps the welfare home letter (PDF + its OCR reading) on the record", () => {
    const s = fasReducer(initialFasState(), {
      type: "submitHardcopy", studentIds: [ethan.id], band: band("SBFAS"), school: "Riverbank Primary School",
      applicant: "Benson Chua", contact: "+65 8112 9743", note: "", by: "Alicia Tan", entryMode: "manual", at,
      welfareHome: true, welfareLetter: { file: "sunbeam-letter.pdf", home: "Sunbeam Welfare Home", dated: "30 Sep 2026" },
    });
    expect(s.familyApps[0].welfareHome).toBe(true);
    expect(s.familyApps[0].welfareLetter).toEqual({ file: "sunbeam-letter.pdf", home: "Sunbeam Welfare Home", dated: "30 Sep 2026" });
  });

  it("keeps the scanned form the school uploaded, so MOE can open it", () => {
    const s = fasReducer(initialFasState(), {
      type: "submitHardcopy", studentIds: [ethan.id], band: band("SBFAS"), school: "Riverbank Primary School",
      applicant: "Benson Chua", contact: "+65 8112 9743", note: "", by: "Alicia Tan", entryMode: "ocr", at, formFile: "MOE-FAS-form-chua-signed.pdf",
    });
    expect(s.familyApps[0].formFile).toBe("MOE-FAS-form-chua-signed.pdf");
  });

  it("records the employment-only declaration — no table, bands from HOMES", () => {
    const s = fasReducer(initialFasState(), {
      type: "submitHardcopy", studentIds: [ethan.id], band: band("SBFAS"), school: "Riverbank Primary School",
      applicant: "Benson Chua", contact: "+65 8112 9743", note: "", by: "Alicia Tan", entryMode: "manual", at,
      homesOnly: true,
    });
    expect(s.familyApps[0].homesOnly).toBe(true);
    expect(s.familyApps[0].hasAdminIncome).toBeUndefined();
    expect(s.familyApps[0].household).toBeUndefined();
  });

  it("records Section V's request for an IMDA DigitalAccess@Home hard copy", () => {
    const s = fasReducer(initialFasState(), {
      type: "submitHardcopy", studentIds: [ethan.id], band: band("SBFAS"), school: "Riverbank Primary School",
      applicant: "Benson Chua", contact: "+65 8112 9743", note: "", by: "Alicia Tan", entryMode: "manual", at,
      imdaHardcopy: "yes",
    });
    expect(s.familyApps[0].imdaHardcopy).toBe("yes");
  });
});

describe("a new SBFAS request after a rejection", () => {
  const [ethan] = FAMILY_STUDENT_NAMES.map((n) => STUDENTS.find((s) => s.name === n)!);
  const at = "2026-10-20T09:00:00.000Z";
  const band: Band = { id: "b3", label: "$751 - $1,000 per person", tier: "SBFAS" };
  // Start from an online submission, then have the school reject it.
  const rejected = () => {
    const s0 = fasReducer(initialFasState(), { type: "submitFamily", studentIds: [ethan.id], band, at });
    const id = s0.apps.find((a) => a.studentId === ethan.id)!.id;
    return fasReducer(s0, { type: "decide", id, action: "reject", draft: { justification: "Income above range", tier: "Tier 1" }, at });
  };
  const reapply = (s: ReturnType<typeof initialFasState>, reason = "Parent stopped working", by?: string) =>
    fasReducer(s, { type: "submitSbfasReapply", studentId: ethan.id, reason, by, at });

  it("creates attempt 2 in the queue, superseding the rejected application and carrying the reason", () => {
    const s = reapply(rejected(), "Parent stopped working", "Alicia Tan");
    const mine = s.apps.filter((a) => a.studentId === ethan.id);
    expect(mine).toHaveLength(2);
    expect(mine[1]).toMatchObject({ attemptNo: 2, supersedesId: mine[0].id, reapplyReason: "Parent stopped working", source: "Resubmission", status: "Pending", enteredBy: "Alicia Tan" });
    expect(mine[1].incomeBand).toBe(mine[0].incomeBand);
    expect(s.familyApps).toHaveLength(0); // the portal re-apply creates no hardcopy record
  });

  it("records the hardcopy flow-2 form in the paper history", () => {
    const s = fasReducer(rejected(), {
      type: "submitSbfasReapply", studentId: ethan.id, reason: "Parent stopped working", by: "Alicia Tan", at,
      school: "Riverbank Primary School", applicant: "Benson Chua", contact: "+65 8112 9743", entryMode: "ocr",
    });
    const request = s.apps.filter((a) => a.studentId === ethan.id)[1];
    expect(s.familyApps).toHaveLength(1);
    expect(s.familyApps[0]).toMatchObject({
      channel: "Hardcopy", school: "Riverbank Primary School", applicant: "Benson Chua",
      bandLabel: "$751 - $1,000 per person", note: "Parent stopped working",
      enteredBy: "Alicia Tan", entryMode: "ocr",
      children: [{ student: ethan.name, outcome: "New SBFAS request" }],
    });
    expect(request.familyAppId).toBe(s.familyApps[0].id);
  });

  it("is refused while the previous application is still pending", () => {
    const pending = fasReducer(initialFasState(), { type: "submitFamily", studentIds: [ethan.id], band, at });
    expect(reapply(pending)).toEqual(pending);
  });

  it("is refused without a reason, and after a grant", () => {
    const s = rejected();
    expect(reapply(s, "   ")).toEqual(s);
    const granted = fasReducer(initialFasState(), { type: "submitFamily", studentIds: [ethan.id], band, at });
    const id = granted.apps.find((a) => a.studentId === ethan.id)!.id;
    const ok = fasReducer(granted, { type: "decide", id, action: "approve", draft: { justification: "", tier: "Tier 3" }, at });
    expect(reapply(ok)).toEqual(ok);
  });

  it("after attempt 2 is rejected, attempt 3 follows the same rule — nothing is blocked, attempts just count up", () => {
    let s = reapply(rejected()); // attempt 2 pending
    const second = s.apps.filter((a) => a.studentId === ethan.id)[1];
    s = fasReducer(s, { type: "decide", id: second.id, action: "reject", draft: { justification: "Still above range", tier: "Tier 1" }, at });
    s = reapply(s, "Rent went up");
    const mine = s.apps.filter((a) => a.studentId === ethan.id);
    expect(mine).toHaveLength(3);
    expect(mine[2]).toMatchObject({ attemptNo: 3, supersedesId: second.id });
  });

  it("the child's outcome reads the latest attempt, so a new request puts them back to awaiting", () => {
    expect(selectChildFas(rejected(), ethan.id)).toMatchObject({ status: "Not granted" });
    expect(selectChildFas(reapply(rejected()), ethan.id)).toEqual({ scheme: "SBFAS", status: "Awaiting school decision" });
  });
});

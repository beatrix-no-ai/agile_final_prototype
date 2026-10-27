import { expect, test } from "vitest";
import { respond, type Ctx, type Flow } from "./engine";

const ctx: Ctx = { contact: "+65 9123 4567", mailingAddress: "Blk 214", children: 2, fasStage: "not-started" };
const ask = (text: string, flow: Flow = {}, c: Ctx = ctx) => respond(flow, text, c);

test("paying has one flow, so a pay question is answered directly (no choice of method)", () => {
  const r = ask("How do I pay a fee?");
  expect(r.flow).toEqual({});
  expect(r.replies[0].steps?.join(" ")).toMatch(/Payment summary/);
  expect(r.replies[0].text).not.toMatch(/online/i);
  expect(ask("can I pay by card instead").replies[0].text).toMatch(/don't need to choose/);
  expect(ask("what if my balance is not enough to pay").replies[0].text).toMatch(/don't need to choose/);
  expect(ask("my payment failed").replies[0].text).toMatch(/Nothing is charged/);
});

test("a vague question gets a follow-up with topic chips", () => {
  const r = ask("help");
  expect(r.flow).toEqual({ pending: "topic" });
  expect(r.replies[0].chips?.length).toBe(4);
});

test("account data is redirected, never shown", () => {
  const r = ask("Check my child's balance").replies[0];
  expect(r.text).toMatch(/can't read account figures/);
  expect(r.link?.to).toBe("/parent");
});

test("out of scope and eligibility questions are declined with a way out", () => {
  expect(ask("what's the weather").replies[0].chips).toEqual(["Talk to a person"]);
  expect(ask("Am I eligible for FAS?").replies[0].text).toMatch(/can't tell you/);
  expect(ask("Talk to a person").replies[0].human).toBeTruthy();
  expect(ask("Where is my receipt?").replies[0].text).toMatch(/View details/);
});

test("ID numbers are refused and not echoed", () => {
  const r = ask("my nric is S1234567A").replies[0];
  expect(r.text).toMatch(/don't type ID numbers/);
  expect(r.text).not.toContain("S1234567A");
});

test("FAS flow asks only what the profile lacks, then drafts with sources", () => {
  const s = ask("Apply for FAS");
  expect(s.flow.fas?.step).toBe("residents");
  expect(s.replies[1].chips).toEqual(["3 people", "4 people", "5 people"]);
  const bad = ask("lots", s.flow);
  expect(bad.flow.fas?.step).toBe("residents");
  const q2 = ask("4 people", s.flow);
  expect(q2.flow.fas).toEqual({ step: "extra", residents: "4" });
  const d = ask("None", q2.flow).replies[0].draft!.fields;
  expect(d.map((f) => [f.key, f.value, f.source])).toEqual([
    ["extraIncome", "0", "answer"],
    ["residents", "4", "answer"],
    ["contact", "+65 9123 4567", "profile"],
    ["mailingAddress", "Blk 214", "profile"],
  ]);
});

test("skipping a question leaves that field missing; a typed amount is kept", () => {
  const flow: Flow = { fas: { step: "extra", residents: "3" } };
  expect(ask("Skip for now", flow).replies[0].draft!.fields[0]).toMatchObject({ value: "", source: "missing" });
  expect(ask("300", flow).replies[0].draft!.fields[0]).toMatchObject({ value: "300", source: "answer" });
  expect(ask("lots of money", flow).flow.fas?.step).toBe("extra");
});

test("a submitted application is not restarted", () => {
  const r = ask("Apply for FAS", {}, { ...ctx, fasStage: "submitted" });
  expect(r.flow).toEqual({});
  expect(r.replies[0].link?.to).toBe("/parent/fas");
});

test("an unrelated message clears a pending follow-up", () => {
  expect(ask("update my address", { pending: "topic" }).flow).toEqual({});
});

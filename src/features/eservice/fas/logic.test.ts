import { expect, test } from "vitest";
import { BANDS } from "../../../data/familyFas";
import { assess, trackerSteps, validateForm } from "./logic";

test("assess: MOEFAS tiers first, SBFAS only when MOEFAS is not granted, never both", () => {
  expect(assess(BANDS[0])).toMatchObject({ scheme: "MOEFAS", tier: "Tier 1", status: "Indicative" });
  expect(assess(BANDS[1])).toMatchObject({ scheme: "MOEFAS", tier: "Tier 2" });
  expect(assess(BANDS[2])).toMatchObject({ scheme: "SBFAS", status: "School decides" });
  expect(assess(BANDS[3])).toMatchObject({ scheme: null, status: "Not eligible" });
});

test("disbursement is done once every child's application has been decided", () => {
  expect(trackerSteps("submitted", true).map((x) => `${x.name}:${x.state}`)).toEqual(["Prepare info:Done", "Submission:Done", "Disbursement:Done"]);
  expect(trackerSteps("preparing", true)[2].state).toBe("Waiting");
});

test("trackerSteps has three stages: prepare info, submission, disbursement", () => {
  const s = (stage: "not-started" | "preparing" | "submitted") => trackerSteps(stage).map((x) => `${x.name}:${x.state}`);
  expect(s("not-started")).toEqual(["Prepare info:To do", "Submission:Waiting", "Disbursement:Waiting"]);
  expect(s("preparing")).toEqual(["Prepare info:In progress", "Submission:To do", "Disbursement:Waiting"]);
  expect(s("submitted")).toEqual(["Prepare info:Done", "Submission:Done", "Disbursement:Waiting"]);
});

const hh = { extraIncome: "0", residents: "4" };
const ok = { ...hh, contact: "+65 9123 4567", mailingAddress: "Blk 1", note: "" };

test("validateForm requires fields, a valid SG number and consent", () => {
  expect(validateForm(ok, true)).toEqual({});
  expect(validateForm({ ...ok, contact: "" }, true).contact).toBeTruthy();
  expect(validateForm({ ...ok, contact: "12345" }, true).contact).toBeTruthy();
  expect(validateForm({ ...ok, contact: "91234567" }, true)).toEqual({});
  expect(validateForm({ ...ok, mailingAddress: " " }, true).mailingAddress).toBeTruthy();
  expect(validateForm(ok, false).consent).toBeTruthy();
});

test("validateForm checks extra money and residents (for GHI and PCI)", () => {
  expect(validateForm({ ...ok, extraIncome: "350.50" }, true)).toEqual({});
  expect(validateForm({ ...ok, extraIncome: "" }, true).extraIncome).toBeTruthy();
  expect(validateForm({ ...ok, extraIncome: "-5" }, true).extraIncome).toBeTruthy();
  expect(validateForm({ ...ok, residents: "0" }, true).residents).toBeTruthy();
  expect(validateForm({ ...ok, residents: "2.5" }, true).residents).toBeTruthy();
});

import { expect, test } from "vitest";
import { BANDS, autoFillSource } from "../../../data/familyFas";
import { assess, autoFill, answersToForm, trackerSteps, validateForm } from "./logic";

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

const ok = { contact: "+65 9123 4567", mailingAddress: "Blk 1", note: "" };

test("validateForm requires fields, a valid SG number and consent", () => {
  expect(validateForm(ok, true)).toEqual({});
  expect(validateForm({ ...ok, contact: "" }, true).contact).toBeTruthy();
  expect(validateForm({ ...ok, contact: "12345" }, true).contact).toBeTruthy();
  expect(validateForm({ ...ok, contact: "91234567" }, true)).toEqual({});
  expect(validateForm({ ...ok, mailingAddress: " " }, true).mailingAddress).toBeTruthy();
  expect(validateForm(ok, false).consent).toBeTruthy();
});

test("autoFill fills only empty fields and counts them", () => {
  const empty = { contact: "", mailingAddress: "", note: "" };
  expect(autoFill(empty)).toEqual({ values: autoFillSource, count: 3 });
  expect(validateForm(autoFill(empty).values, true)).toEqual({});
  const typed = { ...empty, note: "my own words", contact: "9000 0000" };
  expect(autoFill(typed)).toEqual({ values: { ...autoFillSource, note: "my own words", contact: "9000 0000" }, count: 1 });
  expect(autoFill(autoFillSource).count).toBe(0);
});

test("answersToForm maps picks and keeps the typed value when the parent will type their own", () => {
  const empty = { contact: "", mailingAddress: "", note: "" };
  expect(answersToForm({ mailing: "same", contact: "same" }, empty)).toMatchObject({
    contact: autoFillSource.contact,
    mailingAddress: autoFillSource.mailingAddress,
  });
  expect(answersToForm({ contact: "different" }, { ...empty, contact: "9000 0000" }).contact).toBe("9000 0000");
});

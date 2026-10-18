import { expect, test } from "vitest";
import { BANDS, autoFillSource } from "../../../data/familyFas";
import { assess, autoFill, answersToForm, trackerSteps, validateForm } from "./logic";

test("assess: MOEFAS tiers first, SBFAS only when MOEFAS is not granted, never both", () => {
  expect(assess(BANDS[0])).toMatchObject({ scheme: "MOEFAS", tier: "Tier 1", status: "Indicative" });
  expect(assess(BANDS[1])).toMatchObject({ scheme: "MOEFAS", tier: "Tier 2" });
  expect(assess(BANDS[2])).toMatchObject({ scheme: "SBFAS", status: "School decides" });
  expect(assess(BANDS[3])).toMatchObject({ scheme: null, status: "Not eligible" });
});

test("trackerSteps follows submission, income sync and the school's review", () => {
  const s = (sync: "idle" | "loading" | "success" | "error", hasBand: boolean, review: "not-submitted" | "pending" | "decided") =>
    trackerSteps(sync, hasBand, review).map((x) => x.state);
  expect(s("idle", true, "pending")).toEqual(["Done", "Done", "In progress", "Waiting"]);
  expect(s("idle", false, "not-submitted")).toEqual(["To do", "To do", "Waiting", "Waiting"]);
  expect(s("idle", true, "not-submitted")).toEqual(["To do", "Done", "Waiting", "Waiting"]);
  expect(s("loading", true, "pending")).toEqual(["Done", "In progress", "Waiting", "Waiting"]);
  expect(s("error", false, "pending")).toEqual(["Done", "Failed", "Waiting", "Waiting"]);
  expect(s("success", true, "pending")).toEqual(["Done", "Done", "In progress", "Waiting"]);
  expect(s("idle", true, "decided")).toEqual(["Done", "Done", "Done", "Waiting"]);
  expect(trackerSteps("idle", true, "decided", true).map((x) => x.state)).toEqual(["Done", "Done", "Done", "In progress"]);
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

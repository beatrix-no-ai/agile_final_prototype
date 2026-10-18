import { describe, expect, it } from "vitest";
import { BANDS } from "./familyFas";
import { initialParentState as s0, parentReducer } from "./parentStore";

describe("parentReducer saveProfile", () => {
  it("merges only the editable fields", () => {
    const s = parentReducer(s0, { type: "saveProfile", form: { address: "1 New Road, Singapore 111111", mailingAddress: "same", contact: "+65 9000 0000" } });
    expect(s.profile).toMatchObject({ name: s0.profile.name, nric: s0.profile.nric, address: "1 New Road, Singapore 111111", contact: "+65 9000 0000" });
  });
});

describe("parentReducer FAS application", () => {
  const submit = { type: "submitFas", date: "2026-10-18", band: BANDS[1] } as const;

  it("moves forward one stage at a time: not started, preparing, submitted", () => {
    expect(s0.fas.stage).toBe("not-started");
    const preparing = parentReducer(s0, { type: "startFas" });
    expect(preparing.fas.stage).toBe("preparing");
    expect(parentReducer(preparing, submit).fas).toEqual({ stage: "submitted", submittedOn: "2026-10-18" });
  });

  it("cannot be submitted before it is started, or twice", () => {
    expect(parentReducer(s0, submit)).toBe(s0);
    const done = parentReducer(parentReducer(s0, { type: "startFas" }), submit);
    expect(parentReducer(done, submit)).toBe(done);
    expect(parentReducer(done, { type: "startFas" })).toBe(done);
  });
});

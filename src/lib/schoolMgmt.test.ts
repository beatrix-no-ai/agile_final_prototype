import { describe, expect, it } from "vitest";
import { nextSchoolId, validateClass, validateSchool } from "./schoolMgmt";

const school = { code: "S020", name: "Pine Ridge Primary", level: "Primary", address: "1 Pine Road", principal: "Ms Tan", email: "a@b.sg", phone: "61234567" };
describe("validateSchool", () => {
  it("accepts a valid school", () => expect(validateSchool(school, [])).toEqual({}));
  it("rejects bad or duplicate code and duplicate name", () => {
    expect(validateSchool({ ...school, code: "20" }, []).code).toBeTruthy();
    expect(validateSchool(school, [{ code: "S020", name: "x" }]).code).toBeTruthy();
    expect(validateSchool(school, [{ code: "S001", name: "pine  ridge primary" }]).name).toBeTruthy();
  });
});
it("rejects bad email and phone", () => {
  expect(validateSchool({ ...school, email: "x" }, []).email).toBeTruthy();
  expect(validateSchool({ ...school, phone: "12345678" }, []).phone).toBeTruthy();
});
it("requires the principal only when asked", () => {
  expect(validateSchool(school, [])).toEqual({});
  expect(Object.keys(validateSchool(school, [], true))).toEqual(["userEmail"]);
  expect(validateSchool({ ...school, userEmail: "a@b.sg" }, [], true)).toEqual({});
});
it("generates the next school ID", () => expect(nextSchoolId([{ code: "S003" }, { code: "S012" }])).toBe("S013"));
describe("validateClass", () => {
  const c = { name: "P1 Grace", level: "P1", teacher: "Mr Lee", room: "A1-01", capacity: "40" };
  it("accepts a valid class", () => expect(validateClass(c, [])).toEqual({}));
  it("rejects capacity 0, 46, 4.5 and below enrolment", () => {
    for (const capacity of ["0", "46", "4.5", ""]) expect(validateClass({ ...c, capacity }, []).capacity).toBeTruthy();
    expect(validateClass({ ...c, capacity: "2" }, [], 3).capacity).toBeTruthy();
  });
  it("requires a school when one is asked for", () => expect(validateClass({ ...c, school: "" }, []).school).toBeTruthy());
  it("rejects duplicate name and unknown level", () => {
    expect(validateClass(c, [{ name: "p1 grace" }]).name).toBeTruthy();
    expect(validateClass({ ...c, level: "P9" }, []).level).toBeTruthy();
  });
});

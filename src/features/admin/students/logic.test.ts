import { describe, expect, it } from "vitest";
import { STUDENTS, type Student } from "../../../data/students";
import { filterStudents, nameError, newStudent, nextId, NO_FILTERS, parseStudentCsv, plural, validateNewStudent } from "./logic";

const today = new Date(2026, 9, 12); // local 12 Oct 2026
const ok = { name: "Tan Wei Jie", dob: "2017-03-05", level: "P3", class: "P3 Care" };
const H = "name,level,class\n";
const rowsOf = (r: ReturnType<typeof parseStudentCsv>) => ("rows" in r ? r.rows : []);

describe("filterStudents", () => {
  it("returns everything with no filters", () => {
    expect(filterStudents(STUDENTS, NO_FILTERS)).toHaveLength(STUDENTS.length);
  });
  it("combines filters with AND", () => {
    const r = filterStudents(STUDENTS, { level: "P1", class: "", status: "Active" });
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((s) => s.level === "P1" && s.status === "Active")).toBe(true);
  });
  it("a combination that matches nothing gives 0 rows", () => {
    expect(filterStudents(STUDENTS, { level: "P1", class: "", status: "Inactive" })).toHaveLength(0);
  });
});

describe("validateNewStudent", () => {
  it("accepts valid input", () => expect(validateNewStudent(ok, today)).toEqual({}));
  it("flags empty fields", () => {
    const e = validateNewStudent({ name: " ", dob: "", level: "", class: "" }, today);
    expect(Object.keys(e).sort()).toEqual(["class", "dob", "level", "name"]);
  });
  it("rejects digits in name, future dob", () => {
    expect(validateNewStudent({ ...ok, name: "Tan 123" }, today).name).toBeTruthy();
    expect(validateNewStudent({ ...ok, dob: "2027-01-01" }, today).dob).toMatch(/future/);
  });
  it("age boundaries 6 / 16 accepted, 5 / 17 rejected (local dates)", () => {
    const dob = (d: string) => validateNewStudent({ ...ok, dob: d }, today).dob;
    expect(dob("2020-10-12")).toBeUndefined(); // turns 6 today
    expect(dob("2020-10-13")).toMatch(/6 to 16/); // 5
    expect(dob("2009-10-13")).toBeUndefined(); // still 16
    expect(dob("2009-10-12")).toMatch(/6 to 16/); // turns 17 today
  });
  it("rejects an impossible date", () => {
    expect(validateNewStudent({ ...ok, dob: "2018-02-31" }, today).dob).toBeTruthy();
  });
  it("rejects a class from another level", () => {
    expect(validateNewStudent({ ...ok, class: "P1 Courage" }, today).class).toBeTruthy();
  });
});

describe("nameError", () => {
  it("allows curly apostrophe, slash and hyphen", () => {
    expect(nameError("Nur O’Neil s/o Tan-Lee")).toBe("");
  });
  it("rejects punctuation-only names", () => {
    expect(nameError("..")).toBeTruthy();
    expect(nameError("- -")).toBeTruthy();
  });
});

describe("parseStudentCsv", () => {
  const csv = H + "Amy Lim,P1,P1 Courage\nBen Tan,sec 2,Sec 2 Aspire\nBad Row,P9,X\n";
  it("parses rows, counts total and skipped, level is case-insensitive", () => {
    const r = parseStudentCsv("s.csv", csv);
    expect(r).toMatchObject({ total: 3, skipped: 1, reasons: { "unknown level": 1 } });
    expect(rowsOf(r).map((x) => x.level)).toEqual(["P1", "Sec 2"]);
  });
  it("rejects non-csv and empty files", () => {
    expect(parseStudentCsv("s.txt", csv)).toHaveProperty("error");
    expect(parseStudentCsv("s.csv", "  \n")).toEqual({ error: "The file is empty." });
  });
  it("rejects missing columns and header-only", () => {
    expect(parseStudentCsv("s.csv", "a,b\n1,2")).toHaveProperty("error");
    expect(parseStudentCsv("s.csv", H)).toHaveProperty("error");
  });
  it("handles BOM, CRLF and blank lines", () => {
    const r = parseStudentCsv("s.csv", "﻿" + H.replace("\n", "\r\n") + "\r\nAmy Lim,P1,P1 Courage\r\n\r\nBen Tan,P2,P2 Respect\r\n");
    expect(rowsOf(r)).toHaveLength(2);
    expect(r).toMatchObject({ total: 2, skipped: 0 });
  });
  it("skips short rows with a reason", () => {
    const r = parseStudentCsv("s.csv", H + "Amy Lim,P1\nBen Tan\n");
    expect(r).toMatchObject({ skipped: 2, reasons: { "missing class": 1, "unknown level": 1 } });
  });
  it("reads quoted fields: comma inside quotes, escaped quotes, no literal quotes kept", () => {
    const r = parseStudentCsv("s.csv", H + '"Lim, Amy",P1,P1 Courage\n"Ben ""BJ"" Tan",P2,"P2 Respect"\n');
    expect(rowsOf(r)[0]).toEqual({ name: "Lim, Amy", level: "P1", class: "P1 Courage" });
    // BJ in quotes is punctuation inside a name: rejected by the shared name rule
    expect(r).toMatchObject({ skipped: 1, reasons: { "invalid name": 1 } });
    expect(rowsOf(parseStudentCsv("s.csv", H + '"Amy, Lim",P2,"P2 Respect"')).map((x) => x.class)).toEqual(["P2 Respect"]);
  });
  it("skips a class that does not belong to the level, and bad names", () => {
    const r = parseStudentCsv("s.csv", H + "Amy Lim,P1,P2 Respect\nR2D2,P1,P1 Courage\n,P1,P1 Courage\nAmy Lim,P1,p1 courage\n");
    expect(r).toMatchObject({ total: 4, skipped: 3, reasons: { "class not in level": 1, "invalid name": 1, "missing name": 1 } });
    expect(rowsOf(r)[0].class).toBe("P1 Courage");
  });
});

describe("ids", () => {
  it("nextId uses the max numeric suffix, not the row count or order", () => {
    const rows = [{ id: "S20260009" }, { id: "S20260100" }, { id: "S20260003" }] as Student[];
    expect(nextId(rows)).toBe("S20260101");
  });
  it("newStudent gets a fresh id and defaults", () => {
    const s = newStudent(STUDENTS, { name: " Zed ", level: "P1", class: "P1 Courage" });
    expect(s).toMatchObject({ name: "Zed", balance: 0, status: "Active", sbfas: "Not applied" });
    expect(STUDENTS.some((x) => x.id === s.id)).toBe(false);
  });
});

describe("plural", () => {
  it("handles 1 and other counts", () => {
    expect(plural(1, "row")).toBe("1 row");
    expect(plural(0, "student")).toBe("0 students");
  });
});

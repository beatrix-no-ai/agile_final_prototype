import { describe, expect, it } from "vitest";
import { classNamesFor, schoolOfStudent, studentsInClass, studentsOfClass } from "../lib/registry";
import { initialRegistry, registryReducer } from "./registryStore";
import { assignStudent } from "../features/admin/students/logic";
import { UNASSIGNED_ACCOUNTS } from "./students";
import type { ClassRecord } from "./schoolMgmt";

const s0 = initialRegistry();
const newClass = (o: Partial<ClassRecord> = {}): ClassRecord => ({ school: "S001", name: "Sec 3 Courage", level: "Sec 3", teacher: "Ms Ada", room: "Block A 1-01", capacity: 40, ...o });

describe("the seeded records agree with each other", () => {
  it("every student is in a class that exists, and every class belongs to a school that exists", () => {
    for (const s of s0.students) expect(s0.classes.some((c) => c.name === s.class && c.level === s.level), s.name).toBe(true);
    for (const c of s0.classes) expect(s0.schools.some((x) => x.code === c.school), c.name).toBe(true);
  });
});

describe("helpers", () => {
  it("a student's school is the school of their class", () => {
    const s = s0.students.find((x) => x.level === "P5")!;
    expect(schoolOfStudent(s, s0.classes)).toBe("S002");
    const moved = [...s0.classes.filter((c) => c.name !== s.class), { ...s0.classes.find((c) => c.name === s.class)!, school: "S003" }];
    expect(schoolOfStudent(s, moved)).toBe("S003");
  });

  it("falls back to the level when the class is unknown", () => {
    expect(schoolOfStudent({ class: "Gone", level: "Sec 2" }, s0.classes)).toBe("S001");
  });

  it("class names for a level, optionally inside one school", () => {
    expect(classNamesFor(s0.classes, "P1").length).toBe(2);
    const extra = [...s0.classes, newClass({ school: "S004", level: "Sec 1", name: "Sec 1 Zeal" })];
    expect(classNamesFor(extra, "Sec 1", "S004")).toEqual(["Sec 1 Zeal"]);
    expect(classNamesFor(extra, "Sec 1", "S001")).not.toContain("Sec 1 Zeal");
  });

  it("students of a class, and of a class inside one school", () => {
    const name = s0.students[0].class;
    expect(studentsInClass(s0.students, name).every((s) => s.class === name)).toBe(true);
    expect(studentsOfClass(s0.students, s0.classes, schoolOfStudent(s0.students[0], s0.classes), name).length).toBe(studentsInClass(s0.students, name).length);
    expect(studentsOfClass(s0.students, s0.classes, "S999", name)).toEqual([]);
  });
});

describe("registryReducer", () => {
  it("assigning a student puts them in the list, once", () => {
    const acc = UNASSIGNED_ACCOUNTS[0];
    const stu = assignStudent(acc, { level: "P1", class: "P1 Courage" });
    const s1 = registryReducer(s0, { type: "assignStudent", student: stu });
    expect(s1.students[0].id).toBe(acc.id);
    expect(studentsInClass(s1.students, "P1 Courage").length).toBe(studentsInClass(s0.students, "P1 Courage").length + 1);
    expect(registryReducer(s1, { type: "assignStudent", student: stu })).toBe(s1);
  });

  it("a new class shows up for its school", () => {
    const s1 = registryReducer(s0, { type: "saveClass", editing: null, record: newClass() });
    expect(classNamesFor(s1.classes, "Sec 3", "S001")).toContain("Sec 3 Courage");
    expect(s1.classes[0].name).toBe("Sec 3 Courage");
  });

  it("renaming a class moves its students with it", () => {
    const before = studentsInClass(s0.students, "P1 Courage").map((s) => s.id);
    const old = s0.classes.find((c) => c.name === "P1 Courage")!;
    const s1 = registryReducer(s0, { type: "saveClass", editing: "P1 Courage", record: { ...old, name: "P1 Brave" } });
    expect(studentsInClass(s1.students, "P1 Courage")).toEqual([]);
    expect(studentsInClass(s1.students, "P1 Brave").map((s) => s.id)).toEqual(before);
    expect(s1.classes.filter((c) => c.name === "P1 Courage")).toEqual([]);
    expect(s1.classes.length).toBe(s0.classes.length);
  });

  it("editing a class without renaming keeps its students and changes its details", () => {
    const old = s0.classes.find((c) => c.name === "P1 Courage")!;
    const s1 = registryReducer(s0, { type: "saveClass", editing: "P1 Courage", record: { ...old, teacher: "Mr New" } });
    expect(s1.classes.find((c) => c.name === "P1 Courage")!.teacher).toBe("Mr New");
    expect(s1.students).toBe(s0.students);
  });

  it("adding a school lists it; saving an existing code replaces it, so a rename shows everywhere", () => {
    const school = { ...s0.schools[0], code: "S013", name: "Pine Hill Primary School", level: "Primary" as const };
    const s1 = registryReducer(s0, { type: "saveSchool", record: school });
    expect(s1.schools[0].code).toBe("S013");
    const s2 = registryReducer(s1, { type: "saveSchool", record: { ...school, name: "Pine Ridge Primary School" } });
    expect(s2.schools.filter((x) => x.code === "S013")).toEqual([expect.objectContaining({ name: "Pine Ridge Primary School" })]);
    expect(s2.schools.length).toBe(s1.schools.length);
  });
});

import { schoolOfLevel, type ClassRecord } from "../data/schoolMgmt";
import type { Level, Student } from "../data/students";

/** A student belongs to the school of their class; an unknown class falls back to the school of their level. */
export const schoolOfStudent = (s: Pick<Student, "class" | "level">, classes: readonly ClassRecord[]) =>
  classes.find((c) => c.name === s.class)?.school ?? schoolOfLevel(s.level);

/** Class names of one level, optionally only inside one school. */
export const classNamesFor = (classes: readonly ClassRecord[], level: Level, school?: string) =>
  classes.filter((c) => c.level === level && (!school || c.school === school)).map((c) => c.name);

export const studentsInClass = (students: readonly Student[], name: string) => students.filter((s) => s.class === name);

/** Students of one class that sit in the given school. */
export const studentsOfClass = (students: readonly Student[], classes: readonly ClassRecord[], school: string, klass: string) =>
  students.filter((s) => s.class === klass && schoolOfStudent(s, classes) === school);

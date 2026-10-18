import { SCHOOLS, type School } from "./schools";
import { CLASSES, LEVELS, type Level } from "./students";

// ASSUMPTION: invented principals, addresses, teachers, rooms (mock data).
export type SchoolRecord = School & { address: string; principal: string; email: string; phone: string; active: boolean };
const PRINCIPALS = ["Mrs Angela Koh", "Mr Faizal Rahim", "Ms Janet Lau", "Dr Ramesh Nair", "Mrs Wong Mei Ling", "Mr Daniel Ng"];
export const SCHOOL_RECORDS: SchoolRecord[] = SCHOOLS.map((s, i) => ({
  ...s,
  address: `${10 + i * 3} Example Road, Singapore ${560000 + i * 1137}`,
  principal: PRINCIPALS[i % PRINCIPALS.length],
  email: `${s.code.toLowerCase()}@school.example.sg`,
  phone: `6${String(5000000 + i * 91357).padStart(7, "0")}`,
  active: true,
}));

// ASSUMPTION: the mock students and classes belong to two schools: P1-P6 to Riverbank Primary (S002), Sec 1-4 to Greenfield Secondary (S001).
export const schoolOfLevel = (l: Level) => (l.startsWith("P") ? "S002" : "S001");

export type ClassRecord = { school: string; name: string; level: Level; teacher: string; room: string; capacity: number };
const TEACHERS = ["Ms Rina Abdullah", "Mr Jason Tay", "Mrs Grace Lim", "Mr Vikram Menon", "Ms Cheryl Goh", "Mr Hafiz Salleh", "Mrs Anita Raj", "Mr Eric Soh"];
export const CLASS_RECORDS: ClassRecord[] = LEVELS.flatMap((level, i) =>
  CLASSES[level].map((name, j) => ({
    school: schoolOfLevel(level),
    name,
    level,
    teacher: TEACHERS[(i * 2 + j) % TEACHERS.length],
    room: `Block ${"ABC"[i % 3]} ${Math.floor(i / 3) + 1}-0${j + 1}`,
    capacity: 40,
  })),
);

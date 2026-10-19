import { LEVELS } from "../data/students";

type Errors<K extends string> = Partial<Record<K, string>>;
const clean = (s: string) => s.trim().replace(/\s+/g, " ");

export type SchoolInput = { code: string; name: string; level: string; address: string; principal: string; email: string; phone: string; userEmail?: string };
/** `others` = the other records (exclude the one being edited) for uniqueness checks. */
export function validateSchool(v: SchoolInput, others: { code: string; name: string }[], withUser = false): Errors<keyof SchoolInput> {
  const e: Errors<keyof SchoolInput> = {};
  const code = v.code.trim().toUpperCase();
  if (!/^S\d{3}$/.test(code)) e.code = "Use the format S001.";
  else if (others.some((o) => o.code === code)) e.code = "This school ID already exists.";
  const name = clean(v.name);
  if (name.length < 3) e.name = "Enter the school name.";
  else if (others.some((o) => clean(o.name).toLowerCase() === name.toLowerCase())) e.name = "A school with this name already exists.";
  if (!v.level) e.level = "Select a school type.";
  if (!clean(v.address)) e.address = "Enter the address.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email.trim())) e.email = "Enter a valid email address.";
  if (!/^(\+65)?[689]\d{7}$/.test(v.phone.replace(/\s/g, ""))) e.phone = "Enter an 8-digit Singapore number starting 6, 8 or 9.";
  if (withUser && !(v.userEmail ?? "").trim()) e.userEmail = "Select the Principal.";
  if (!clean(v.principal)) e.principal = "Enter the principal's name.";
  return e;
}

export const MAX_CLASS_CAPACITY = 45; // ASSUMPTION: invented upper bound
export type ClassInput = { school?: string; name: string; level: string; teacher: string; room: string; capacity: string };
export function validateClass(v: ClassInput, others: { name: string }[], enrolled = 0): Errors<keyof ClassInput> {
  const e: Errors<keyof ClassInput> = {};
  if (v.school !== undefined && !v.school) e.school = "Select a school.";
  const name = clean(v.name);
  if (!name) e.name = "Enter the class name.";
  else if (others.some((o) => clean(o.name).toLowerCase() === name.toLowerCase())) e.name = "This class already exists.";
  if (!(LEVELS as readonly string[]).includes(v.level)) e.level = "Select a level.";
  if (!clean(v.teacher)) e.teacher = "Enter the form teacher.";
  if (!clean(v.room)) e.room = "Enter the room.";
  const cap = Number(v.capacity);
  if (!/^\d+$/.test(v.capacity.trim()) || cap < 1 || cap > MAX_CLASS_CAPACITY) e.capacity = `Enter a whole number from 1 to ${MAX_CLASS_CAPACITY}.`;
  else if (cap < enrolled) e.capacity = `${enrolled} students are already in this class.`;
  return e;
}

/** Next school ID = highest numeric suffix + 1 (S001, S002, ...). IDs are generated, never typed. */
export const nextSchoolId = (rows: { code: string }[]) =>
  `S${String(rows.reduce((m, r) => Math.max(m, Number(r.code.slice(1)) || 0), 0) + 1).padStart(3, "0")}`;

import type { Role } from "../session";

export type User = { name: string; initials: string };
export type ParentAccount = User & {
  role: "parent";
  singpassId: string;
  email: string;
};
export type StaffAccount = User & { role: "hq" | "school"; title: string; email: string; password: string; schoolCode?: string };

// ASSUMPTION: mock identities and test-only credentials; real auth is out of scope (SingPass and staff SSO are simulated).
export const PARENT: ParentAccount = {
  role: "parent",
  name: "Rachel Lim",
  initials: "RL",
  singpassId: "S****567A",
  email: "rachel.lim@example.com",
};

export const STAFF: StaffAccount[] = [
  { role: "school", name: "Alicia Tan", initials: "AT", title: "School Admin", email: "alicia.tan@school.example", password: "Sch00l-Demo-26", schoolCode: "S001" },
  { role: "hq", name: "Daniel Lim", initials: "DL", title: "MOE HQ Officer", email: "daniel.lim@moe.example", password: "HqOfficer-Demo-26" },
];

/** One mock user per role, so the session can be restored from the role alone. */
export const userFor = (role: Role): User => (role === "parent" ? PARENT : STAFF.find((s) => s.role === role)!);

export const findStaff = (email: string, password: string) =>
  STAFF.find((s) => s.email === email.trim().toLowerCase() && s.password === password);

/** Req 3 (assumed): HQ creates the School User together with the school; the app generates a one-time password. */
/** Creates the school's user, or updates the existing one (name, login email and optionally a fresh one-time password). */
export function saveSchoolUser(schoolCode: string, name: string, email: string, resetPassword = false): StaffAccount {
  const acct = STAFF.find((s) => s.role === "school" && s.schoolCode === schoolCode);
  if (!acct) return createSchoolUser(schoolCode, name, email);
  acct.name = name.trim();
  acct.initials = acct.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  acct.email = email.trim().toLowerCase();
  if (resetPassword) acct.password = `Tmp-${crypto.randomUUID().slice(0, 8)}`;
  return acct;
}

export function createSchoolUser(schoolCode: string, name: string, email: string): StaffAccount {
  const initials = name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const acct: StaffAccount = { role: "school", name: name.trim(), initials, title: "School Admin", email: email.trim().toLowerCase(), password: `Tmp-${crypto.randomUUID().slice(0, 8)}`, schoolCode };
  STAFF.push(acct);
  return acct;
}

/** School of the (single mock) School user; undefined for HQ. */
export const schoolCodeFor = (role: Role | null) => STAFF.find((s) => s.role === role)?.schoolCode;

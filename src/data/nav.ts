import {
  Bank, Buildings, ChalkboardTeacher, CreditCard, FileText, Gear,
  GraduationCap, HandHeart, House, Receipt, Tag, UserGear, type Icon,
} from "@phosphor-icons/react";
import type { Role } from "../session";
import type { Module } from "./users";

export type NavItem = { to: string; label: string; icon: Icon; badge?: number; title?: string; desc?: string };
/** Sidebar sections, mirroring the reference portal (School Management / Finance / …). */
export type NavGroup = { group?: string; items: NavItem[] };

export const homeFor = (role: Role) => (role === "parent" ? "/parent" : "/admin");

// Admin navigation is intentionally compact; the e-Service navigation exposes the parent requirements.
const HQ: NavItem[] = [
  { to: "/admin/school-maintenance", label: "School", desc: "Maintain the school master list.", icon: Buildings },
  { to: "/admin/users", label: "User", desc: "Create school users and assign their modules.", icon: UserGear },
  { to: "/admin/classes", label: "Class", desc: "Classes and their rosters.", icon: ChalkboardTeacher },
  { to: "/admin/students", label: "Student", desc: "Student records and Education Accounts.", icon: GraduationCap },
  { to: "/admin/top-up", label: "Top-up", desc: "Credit accounts one by one or in batches by rule.", icon: Bank },
  { to: "/admin/fee-types", label: "Fee", desc: "Fee rates against the national ceilings.", icon: Tag },
  { to: "/admin/fas", label: "FAS", desc: "MOEFAS rules, applications and SBFAS review.", icon: HandHeart },
];

// School users: the FAS and Top-up screens are modules the Principal assigns (see SCHOOL_MODULES below).
const SCHOOL: NavItem[] = [
  { to: "/admin/classes", label: "Class", desc: "Classes and their rosters.", icon: ChalkboardTeacher },
  { to: "/admin/students", label: "Student", desc: "Student records and Education Accounts.", icon: GraduationCap },
  { to: "/admin/fee-types", label: "Fee", desc: "Fee rates against the national ceilings.", icon: Tag },
];

const PARENT: NavItem[] = [
  { to: "/parent", label: "Overview", icon: House },
  { to: "/parent/payments", label: "Payments", icon: CreditCard },
  { to: "/parent/transactions", label: "Transactions", icon: Receipt },
  { to: "/parent/fas", label: "Financial Assistance Scheme", icon: HandHeart },
  { to: "/parent/statements", label: "Statements", icon: FileText },
  { to: "/parent/settings", label: "Settings", icon: Gear },
];

/** What the signed-in user may use; School users see only the modules they were given. */
export type Access = { can(m: Module): boolean; canManageUsers: boolean };

const SCHOOL_MODULES: (NavItem & { module?: Module; manage?: true })[] = [
  { to: "/admin/fas", label: "FAS", desc: "SBFAS applications and decisions.", icon: HandHeart, module: "FAS" },
  { to: "/admin/top-up", label: "Top-up", desc: "Top up your school's Education Accounts.", icon: Bank, module: "Top-up" },
  { to: "/admin/users", label: "User", desc: "Manage your school's users and their modules.", icon: UserGear, manage: true },
];

const pick = (items: NavItem[], paths: string[]) => items.filter((i) => paths.includes(i.to));

/** Grouped sidebar (reference-portal style). School users only get the modules they were given; the parent e-Service nav stays flat. */
export function navGroupsFor(role: Role, access?: Access): NavGroup[] {
  if (role === "parent") return [{ items: PARENT }];
  if (role === "hq") {
    return [
      { group: "School Management", items: pick(HQ, ["/admin/school-maintenance", "/admin/users", "/admin/classes", "/admin/students"]) },
      { group: "Finance", items: pick(HQ, ["/admin/top-up", "/admin/fee-types", "/admin/fas"]) },
    ];
  }
  const extra = SCHOOL_MODULES.filter((i) => (i.module ? access?.can(i.module) : access?.canManageUsers)).map(({ module: _m, manage: _g, ...item }) => item);
  const items = [...SCHOOL, ...extra];
  return [
    { group: "School Management", items: pick(items, ["/admin/classes", "/admin/students", "/admin/users"]) },
    { group: "Finance", items: pick(items, ["/admin/fee-types", "/admin/fas", "/admin/top-up"]) },
  ].filter((g) => g.items.length);
}

export const navFor = (role: Role, access?: Access): NavItem[] => navGroupsFor(role, access).flatMap((g) => g.items);
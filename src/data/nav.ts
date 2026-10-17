import {
  Bank, Buildings, ChalkboardTeacher, CreditCard, FileText, Gear,
  GraduationCap, HandHeart, House, Receipt, Tag, UsersThree, type Icon,
} from "@phosphor-icons/react";
import type { Role } from "../session";
import { children } from "./parent";

export type NavItem = { to: string; label: string; icon: Icon; badge?: number; title?: string; desc?: string };

export const homeFor = (role: Role) => (role === "parent" ? "/parent" : "/admin");

// Admin navigation is intentionally compact; the e-Service navigation exposes the parent requirements.
const HQ: NavItem[] = [
  { to: "/admin/school-maintenance", label: "School", desc: "Maintain the school master list.", icon: Buildings },
  { to: "/admin/classes", label: "Class", desc: "Classes and their rosters.", icon: ChalkboardTeacher },
  { to: "/admin/students", label: "Student", desc: "Student records and Education Accounts.", icon: GraduationCap },
  { to: "/admin/top-up", label: "Top-up", desc: "Credit accounts one by one or in batches by rule.", icon: Bank },
  { to: "/admin/fee-types", label: "Fee", desc: "Fee rates against the national ceilings.", icon: Tag },
];

// School users: SBFAS budget and FAS queue are Sprint 2, so Budget is HQ-only for now.
const SCHOOL: NavItem[] = [
  { to: "/admin/classes", label: "Class", desc: "Classes and their rosters.", icon: ChalkboardTeacher },
  { to: "/admin/students", label: "Student", desc: "Student records and Education Accounts.", icon: GraduationCap },
  { to: "/admin/fee-types", label: "Fee", desc: "Fee rates against the national ceilings.", icon: Tag },
];

const PARENT: NavItem[] = [
  { to: "/parent", label: "Overview", icon: House },
  { to: "/parent/students", label: "Students", icon: UsersThree, badge: children.length },
  { to: "/parent/payments", label: "Payments", icon: CreditCard },
  { to: "/parent/transactions", label: "Transactions", icon: Receipt },
  { to: "/parent/fas", label: "Financial Assistance Scheme", icon: HandHeart },
  { to: "/parent/statements", label: "Statements", icon: FileText },
  { to: "/parent/settings", label: "Settings", icon: Gear },
];

export const navFor = (role: Role): NavItem[] => ({ hq: HQ, school: SCHOOL, parent: PARENT })[role];

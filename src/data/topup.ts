import { SCHOOLS } from "./schools";
import { CLASSES, LEVELS, STATUSES } from "./students";

/** One list for both the student record and top-up rules. */
export const SCHOOLING = STATUSES;
export type Schooling = (typeof SCHOOLING)[number];
/** ASSUMPTION: only these two schooling statuses; pending MOE confirmation. */
export type RuleSchooling = Schooling;
export type Account = { id: string; name: string; school: string; class: string; age: number; citizen: boolean; enrolled: boolean; schooling: Schooling; status: "Active" | "Closed"; balance: number };

export type Schedule = "now" | "once" | "weekly" | "monthly" | "quarterly" | "yearly";

export type ExecStatus = "Success" | "Pending" | "Failed";
export type Execution = { id: string; type: "Single" | "Batch"; title: string; reason: string; schedule: Schedule; eligible: number; amount: number; total: number; date: string; by: string; status?: ExecStatus; note?: string };

const FIRST = ["Ethan", "Chloe", "Marcus", "Aisha", "Jun Wei", "Priya", "Daniel", "Siti", "Isaac", "Mei Ling", "Arjun", "Hannah", "Wei Jie", "Nur", "Caleb", "Sophia", "Ryan", "Keerthi", "Zhi Hao", "Olivia"];
const LAST = ["Tan", "Lim", "Wong", "Rahman", "Chua", "Nair", "Ong", "Goh", "Lee", "Ng", "Koh", "Teo"];

/** 60 deterministic mock accounts (no randomness so tests and screenshots are stable). */
/** Mock class for an account: the level that matches its age within its school type (P1-P6 / Sec 1-4). */
const classOf = (type: string, age: number, i: number) => CLASSES[type === "Primary" ? LEVELS[Math.min(5, Math.max(0, age - 7))] : LEVELS[6 + Math.min(3, Math.max(0, age - 13))]][i % 2];

export const ACCOUNTS: Account[] = Array.from({ length: 60 }, (_, i) => ({
  id: `EA-${String(2001 + i).padStart(5, "0")}`,
  school: SCHOOLS[i % 4].name,
  class: classOf(SCHOOLS[i % 4].level, 7 + ((i * 7) % 10), i),
  name: `${FIRST[i % FIRST.length]} ${LAST[(i * 7) % LAST.length]}`,
  age: 7 + ((i * 7) % 10), // 7..16 only: accounts open at 7 and close at 16 (Req 1)
  citizen: i % 6 !== 5, // about 1 in 6 is non-citizen
  enrolled: i % 8 !== 3, // 1 in 8 is not enrolled
  schooling: i % 8 !== 3 ? "Enrolled" : "Not Enrolled",
  status: i % 15 === 14 ? "Closed" : "Active", // a few closed accounts: never eligible, never top-up-able
  balance: 20 + ((i * 137) % 1481) + (i % 4) * 0.5, // S$20 .. ~S$1,500
}));

export const PAST_EXECUTIONS: Execution[] = [
  { id: "TU-0005", type: "Batch", title: "Primary level annual top-up", reason: "Annual education top-up", schedule: "yearly", eligible: 21, amount: 200, total: 4200, date: "2026-01-05", by: "HQ Officer" },
  { id: "TU-0006", type: "Batch", title: "Edusave Contribution Q3", reason: "Edusave contribution", schedule: "quarterly", eligible: 34, amount: 150, total: 5100, date: "2026-07-01", by: "HQ Officer" },
  { id: "TU-0007", type: "Batch", title: "Pioneer ad-hoc grant", reason: "Ad-hoc grant for pioneer cohort", schedule: "now", eligible: 12, amount: 500, total: 6000, date: "2026-08-14", by: "HQ Officer" },
  { id: "TU-0008", type: "Single", title: "Single top-up: Ben Lim", reason: "Individual education assistance", schedule: "now", eligible: 1, amount: 100, total: 100, date: "2026-10-13", by: "HQ Officer", status: "Success" },
  { id: "TU-0009", type: "Single", title: "Single top-up: Yeo Mei", reason: "Failed: account closed before top-up execution", schedule: "now", eligible: 1, amount: 200, total: 200, date: "2026-10-14", by: "HQ Officer", status: "Failed" },
  { id: "TU-0010", type: "Batch", title: "Primary Student Support 2026", reason: "Scheduled batch top-up", schedule: "yearly", eligible: 3, amount: 150, total: 450, date: "2026-11-05", by: "HQ Officer", status: "Pending" },
];

export type RuleStatus = "Active" | "Draft" | "Deactivated";
/** Balance range is [minBalance, maxBalance): max excluded. Empty `schools` = all schools. */
export type FundRule = { id: string; name: string; ageMin: number; ageMax: number; minBalance: number; maxBalance: number; schooling: RuleSchooling; amount: number; schools: string[]; status: RuleStatus };

/** Saved funding rules (Top-up team's model). A saved rule never moves money; batch top-ups pick an Active one. */
export const FUND_RULES: FundRule[] = [
  { id: "R-1001", name: "Primary Student Support 2026", ageMin: 7, ageMax: 12, minBalance: 0, maxBalance: 500, schooling: "Enrolled", amount: 150, schools: ["Riverbank Primary School", "Maple Grove Primary School"], status: "Active" },
  { id: "R-1002", name: "Secondary Education Assistance", ageMin: 13, ageMax: 16, minBalance: 100, maxBalance: 400, schooling: "Enrolled", amount: 250, schools: ["Greenfield Secondary School", "Eastlake Secondary School"], status: "Active" },
  { id: "R-1003", name: "Mid-year top-up", ageMin: 10, ageMax: 14, minBalance: 0, maxBalance: 600, schooling: "Enrolled", amount: 80, schools: ["Maple Grove Primary School", "Eastlake Secondary School"], status: "Draft" },
];

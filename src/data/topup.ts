import { SCHOOLS } from "./schools";
import { CLASSES, LEVELS, STATUSES } from "./students";

/** One list for both the student record and top-up rules. */
export const SCHOOLING = STATUSES;
export type Schooling = (typeof SCHOOLING)[number];
/** ASSUMPTION: only these two schooling statuses; pending MOE confirmation. */
export type RuleSchooling = Schooling;
export type Account = { id: string; name: string; school: string; class: string; age: number; citizen: boolean; enrolled: boolean; schooling: Schooling; status: "Active" | "Closed"; balance: number };

export const FREQUENCIES = ["Once", "Weekly", "Monthly", "Yearly"] as const;

export type TxStatus = "Success" | "Partial Success" | "Pending" | "Failed";
/** One account inside a top-up. `txid` exists only once the account has been processed (not Pending). */
export type Target = { student: string; account: string; status: "Success" | "Pending" | "Failed"; reason?: string; txid?: string };
export type Transaction = { targets?: Target[]; ref: string; type: "Single" | "Batch"; recipient: string; detail: string; date: string; schedule: string; accounts: number; amount: number; status: TxStatus; by: string };

const FIRST = ["Ethan", "Chloe", "Marcus", "Aisha", "Jun Wei", "Priya", "Daniel", "Siti", "Isaac", "Mei Ling", "Arjun", "Hannah", "Wei Jie", "Nur", "Caleb", "Sophia", "Ryan", "Keerthi", "Zhi Hao", "Olivia"];
const LAST = ["Tan", "Lim", "Wong", "Rahman", "Chua", "Nair", "Ong", "Goh", "Lee", "Ng", "Koh", "Teo"];

/** 60 deterministic mock accounts (no randomness so tests and screenshots are stable). */
/** Mock class for an account: the level that matches its age within its school type (P1-P6 / Sec 1-4). */
const classOf = (type: string, age: number, i: number) => CLASSES[type === "Primary" ? LEVELS[Math.min(5, Math.max(0, age - 7))] : LEVELS[6 + Math.min(3, Math.max(0, age - 13))]][i % 2];

export const ACCOUNTS: Account[] = Array.from({ length: 60 }, (_, i) => ({
  id: `S${2033 - (7 + ((i * 7) % 10))}${String(i + 1).padStart(5, "0")}`, // S + year opened (age 7) + 5-digit creation sequence
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

/** Newest first. */
export const PAST_TRANSACTIONS: Transaction[] = [
  { ref: "TUT031126", type: "Single", recipient: "Tom Tan (STU001)", detail: "Education Account S202600001 · Scheduled individual support", date: "2026-11-03", schedule: "Once", accounts: 1, amount: 200, status: "Pending", by: "Daniel Lee" },
  { ref: "TUT051126", type: "Batch", recipient: "Primary Student Support 2026", detail: "Scheduled batch top-up · TUR01001", date: "2026-11-05", schedule: "Yearly", accounts: 3, amount: 150, status: "Pending", by: "Jessica Tan" },
  { ref: "TUT141026", type: "Single", recipient: "Yeo Mei (STU006)", detail: "Education Account S202600006 · Failed: Account closed before top-up execution", date: "2026-10-14", schedule: "Run now (ad-hoc)", accounts: 1, amount: 200, status: "Failed", by: "Daniel Lee" },
  { ref: "TUT131026", type: "Single", recipient: "Ben Lim (STU003)", detail: "Education Account S202600003 · Individual education assistance", date: "2026-10-13", schedule: "Run now (ad-hoc)", accounts: 1, amount: 100, status: "Success", by: "Michelle Tan" },
  { ref: "TUT140826", type: "Batch", recipient: "Pioneer ad-hoc grant", detail: "Ad-hoc grant for pioneer cohort", date: "2026-08-14", schedule: "Run now (ad-hoc)", accounts: 12, amount: 500, status: "Partial Success", by: "Ryan Lim" },
  { ref: "TUT010726", type: "Batch", recipient: "Edusave Contribution Q3", detail: "Edusave contribution", date: "2026-07-01", schedule: "Monthly", accounts: 34, amount: 150, status: "Success", by: "Rachel Wong" },
  { ref: "TUT050126", type: "Batch", recipient: "Primary level annual top-up", detail: "Annual education top-up", date: "2026-01-05", schedule: "Yearly", accounts: 21, amount: 200, status: "Success", by: "Daniel Lee" },
];

export type RuleStatus = "Active" | "Draft" | "Deactivated";
/** Balance range is [minBalance, maxBalance): max excluded. Empty `schools` = all schools. */
export type FundRule = { id: string; name: string; ageMin: number; ageMax: number; minBalance: number; maxBalance: number; schooling: RuleSchooling; amount: number; schools: string[]; status: RuleStatus };

/** Saved batch top-up rules. A saved rule never moves money; batch top-ups pick an Active one. */
export const FUND_RULES: FundRule[] = [
  { id: "TUR01001", name: "Primary Student Support 2026", ageMin: 7, ageMax: 12, minBalance: 0, maxBalance: 500, schooling: "Enrolled", amount: 150, schools: ["Riverbank Primary School", "Maple Grove Primary School"], status: "Active" },
  { id: "TUR01002", name: "Secondary Education Assistance", ageMin: 13, ageMax: 16, minBalance: 100, maxBalance: 400, schooling: "Enrolled", amount: 250, schools: ["Greenfield Secondary School", "Hillcrest Secondary School"], status: "Active" },
  { id: "TUR01003", name: "Mid-year top-up", ageMin: 10, ageMax: 14, minBalance: 0, maxBalance: 600, schooling: "Enrolled", amount: 80, schools: ["Riverbank Primary School", "Eastlake Secondary School"], status: "Draft" },
];

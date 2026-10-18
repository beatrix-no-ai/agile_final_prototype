import { STATUSES } from "./students";
import { makeNric, maskNric } from "../lib/nric";

/** One list for both the student record and top-up rules. */
export const SCHOOLING = STATUSES;
export type Schooling = (typeof SCHOOLING)[number];
/** ASSUMPTION: only these two schooling statuses; pending MOE confirmation. */
export type RuleSchooling = Schooling;
export type Account = { id: string; nric: string; name: string; school: string; class: string; age: number; citizen: boolean; enrolled: boolean; schooling: Schooling; status: "Active" | "Closed"; balance: number };

/** One credit to one Education Account, kept so the account ledger and the parent portal can show it. */
export type TopUpEntry = { id: string; studentId: string; amount: number; date: string; ref: string; note: string };

export const FREQUENCIES = ["Once", "Weekly", "Monthly", "Yearly"] as const;

export type TxStatus = "Success" | "Partial Success" | "Pending" | "Failed";
/** One account inside a top-up. `txid` exists only once the account has been processed (not Pending). */
export type Target = { student: string; account: string; status: "Success" | "Pending" | "Failed"; reason?: string; txid?: string };
/** `school` = the school (by name) whose user ran it; HQ runs have none. */
export type Transaction = { school?: string; targets?: Target[]; ref: string; type: "Single" | "Batch"; recipient: string; detail: string; date: string; schedule: string; accounts: number; amount: number; status: TxStatus; by: string };

/** Newest first. */
export const PAST_TRANSACTIONS: Transaction[] = [
  { ref: "TUT031126", type: "Single", recipient: `Tom Tan (${maskNric(makeNric(2017, 11001))})`, detail: `Education Account ${maskNric(makeNric(2017, 11001))} · Scheduled individual support`, date: "2026-11-03", schedule: "Once", accounts: 1, amount: 200, status: "Pending", by: "Daniel Lee" },
  { ref: "TUT051126", type: "Batch", recipient: "Primary Student Support 2026", detail: "Scheduled batch top-up · TUR01001", date: "2026-11-05", schedule: "Yearly", accounts: 3, amount: 150, status: "Pending", by: "Jessica Tan" },
  { ref: "TUT141026", type: "Single", recipient: `Yeo Mei (${maskNric(makeNric(2016, 11006))})`, detail: `Education Account ${maskNric(makeNric(2016, 11006))} · Failed: Account closed before top-up execution`, date: "2026-10-14", schedule: "Run now (ad-hoc)", accounts: 1, amount: 200, status: "Failed", by: "Daniel Lee" },
  { ref: "TUT131026", type: "Single", recipient: `Ben Lim (${maskNric(makeNric(2015, 11003))})`, detail: `Education Account ${maskNric(makeNric(2015, 11003))} · Individual education assistance`, date: "2026-10-13", schedule: "Run now (ad-hoc)", accounts: 1, amount: 100, status: "Success", by: "Michelle Tan" },
  { ref: "TUT140826", type: "Batch", recipient: "Pioneer ad-hoc grant", detail: "Ad-hoc grant for pioneer cohort", date: "2026-08-14", schedule: "Run now (ad-hoc)", accounts: 12, amount: 500, status: "Partial Success", by: "Ryan Lim" },
  { ref: "TUT010726", type: "Batch", recipient: "Edusave Contribution Q3", detail: "Edusave contribution", date: "2026-07-01", schedule: "Monthly", accounts: 34, amount: 150, status: "Success", by: "Rachel Wong" },
  { ref: "TUT050126", type: "Batch", recipient: "Primary level annual top-up", detail: "Annual education top-up", date: "2026-01-05", schedule: "Yearly", accounts: 21, amount: 200, status: "Success", by: "Daniel Lee" },
];

export type RuleStatus = "Active" | "Draft" | "Deactivated";
/** Balance range is [minBalance, maxBalance): max excluded. Empty `schools` = all schools. */
export type FundRule = { id: string; name: string; ageMin: number; ageMax: number; minBalance: number; maxBalance: number; schooling: RuleSchooling; amount: number; schools: string[]; status: RuleStatus };

/** Saved batch top-up rules. A saved rule never moves money; batch top-ups pick an Active one. */
export const FUND_RULES: FundRule[] = [
  { id: "TUR01001", name: "Primary Student Support 2026", ageMin: 7, ageMax: 12, minBalance: 0, maxBalance: 500, schooling: "Active", amount: 150, schools: ["Riverbank Primary School", "Maple Grove Primary School"], status: "Active" },
  { id: "TUR01002", name: "Secondary Education Assistance", ageMin: 13, ageMax: 16, minBalance: 100, maxBalance: 400, schooling: "Active", amount: 250, schools: ["Greenfield Secondary School", "Hillcrest Secondary School"], status: "Active" },
  { id: "TUR01003", name: "Mid-year top-up", ageMin: 10, ageMax: 14, minBalance: 0, maxBalance: 600, schooling: "Active", amount: 80, schools: ["Riverbank Primary School", "Eastlake Secondary School"], status: "Draft" },
];

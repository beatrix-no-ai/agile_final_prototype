import type { AccountPayment } from "../data/fees";
import type { ClassRecord, SchoolRecord } from "../data/schoolMgmt";
import type { Account, TopUpEntry } from "../data/topup";
import type { Level, Student } from "../data/students";
import { schoolOfStudent } from "./registry";
import { withBalance, type Movements } from "./studentFas";

// ASSUMPTION: age is inferred from level (P1 = 7 ... Sec 4 = 16); the mock students carry no date of birth.
const AGE: Record<Level, number> = { P1: 7, P2: 8, P3: 9, P4: 10, P5: 11, P6: 12, "Sec 1": 13, "Sec 2": 14, "Sec 3": 15, "Sec 4": 16 };
export const ACCOUNT_OPENS_AT = 7;
export const ACCOUNT_CLOSES_AT = 16;

export const ageForLevel = (l: Level) => AGE[l];

/** Req 1: opens when the child turns 7, closes at 16 (balance goes to CPF by default). */
export function accountStatus(l: Level): "Not yet open" | "Active" | "Closes this year" {
  const a = AGE[l];
  return a < ACCOUNT_OPENS_AT ? "Not yet open" : a >= ACCOUNT_CLOSES_AT ? "Closes this year" : "Active";
}

export type LedgerEntry = { date: string; description: string; amount: number };

/** Mock ledger that always sums to the student's balance (computed in cents). */
export function ledgerFor(s: Pick<Student, "id" | "balance">): LedgerEntry[] {
  const balance = Math.round(s.balance * 100);
  const fees = [
    { date: "2026-02-03", description: "Miscellaneous fee (Term 1)", cents: 1300 },
    { date: "2026-02-03", description: "Learning materials (Term 1)", cents: 5500 },
  ];
  const spent = fees.reduce((t, f) => t + f.cents, 0);
  return [
    { date: "2026-01-02", description: "Annual MOE top-up", amount: (balance + spent) / 100 },
    ...fees.map((f) => ({ date: f.date, description: f.description, amount: -f.cents / 100 })),
  ];
}

/** A Top-up account is the student: same id, NRIC, name and class, with the balance after top-ups and fees paid. */
export function accountOf(s: Student, classes: readonly ClassRecord[], schools: readonly Pick<SchoolRecord, "code" | "name">[], m: Movements): Account {
  const age = ageForLevel(s.level);
  return {
    id: s.id, nric: s.nric, name: s.name, class: s.class, age,
    school: schools.find((x) => x.code === schoolOfStudent(s, classes))?.name ?? "",
    citizen: true, // Education Accounts are for Singapore Citizens only (Req 1)
    enrolled: s.status === "Active", schooling: s.status,
    status: age >= ACCOUNT_CLOSES_AT ? "Closed" : "Active",
    balance: withBalance(s, m).balance,
  };
}

export const accountsOf = (students: readonly Student[], classes: readonly ClassRecord[], schools: readonly Pick<SchoolRecord, "code" | "name">[], m: Movements): Account[] =>
  students.map((s) => accountOf(s, classes, schools, m));

/** The account's transactions, newest first: the earlier ledger, MOE top-ups paid in and fees paid out. Adds up to the live balance. */
export function accountLedger(s: Student, topUps: readonly TopUpEntry[], payments: readonly AccountPayment[]): LedgerEntry[] {
  const earlier = ledgerFor({ id: s.id, balance: s.baseBalance ?? s.balance });
  const paidIn = topUps.filter((t) => t.studentId === s.id).map((t): LedgerEntry => ({ date: t.date, description: `${t.note} (${t.ref})`, amount: t.amount }));
  const paidOut = payments.filter((p) => p.studentId === s.id).map((p): LedgerEntry => ({ date: p.on, description: p.title, amount: -p.amount }));
  return [...earlier, ...paidIn, ...paidOut].sort((a, b) => b.date.localeCompare(a.date));
}

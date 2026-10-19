import type { FeeAction } from "../data/feeStore";
import { FAMILY_STUDENT_NAMES, type Child, type Invoice, type Transaction } from "../data/parent";
import type { ClassRecord, SchoolRecord } from "../data/schoolMgmt";
import type { Charge } from "../data/fees";
import type { TopUpEntry } from "../data/topup";
import type { Level, Student } from "../data/students";
import { isPayable, settle, type Mode } from "../features/eservice/payments/settle";
import { ledgerFor } from "./accounts";
import { schoolOfStudent } from "./registry";
import { withBalance, type Movements } from "./studentFas";
import { balanceOf, chargeStatus, payableOf } from "./fees";

const cents = (n: number) => Math.round(n * 100) / 100;

/** "P5" -> "Primary 5", "Sec 2" -> "Secondary 2". */
export const levelLabel = (l: Level) => (l.startsWith("P") ? `Primary ${l.slice(1)}` : `Secondary ${l.slice(4)}`);

/**
 * What the parent portal shows, built from the school side so both portals always agree.
 * The children are the real student records; the balance is the student's balance less what has been paid out of it.
 */
export function familyChildren(students: readonly Student[], movements: Movements, schools: readonly Pick<SchoolRecord, "code" | "name">[], classes: readonly ClassRecord[]): Child[] {
  return FAMILY_STUDENT_NAMES.map((name) => students.find((s) => s.name === name)!).map((s) => ({
    id: s.id,
    name: s.name,
    level: levelLabel(s.level),
    school: schools.find((x) => x.code === schoolOfStudent(s, classes))?.name ?? "",
    educationBalance: withBalance(s, movements).balance,
  }));
}

/** An invoice is a fee charge: open ones show what is still owed (after any FAS subsidy), settled ones what was payable. */
export function familyInvoices(charges: readonly Charge[], childIds: readonly string[]): Invoice[] {
  return charges
    .filter((c) => childIds.includes(c.studentId))
    .map((c) => {
      const status = chargeStatus(c);
      return { id: c.id, childId: c.studentId, title: c.title, amount: status === "paid" ? payableOf(c) : balanceOf(c), dueDate: c.due, status: status === "outstanding" ? "unpaid" : status };
    });
}

/** The Education Account ledger (top-up and earlier fees) plus every payment made on a charge, newest first. */
export function familyTransactions(charges: readonly Charge[], students: readonly Student[], topUps: readonly TopUpEntry[]): Transaction[] {
  const ledger = students.flatMap((s) =>
    ledgerFor(s).map((e, i): Transaction => ({ id: `TX-${s.id}-${i}`, date: e.date, childId: s.id, description: e.description, amount: e.amount, method: e.amount > 0 ? "MOE top-up" : "Education account" })),
  );
  const ids = new Set(students.map((s) => s.id));
  const payments = charges
    .filter((c) => ids.has(c.studentId))
    .flatMap((c) => c.payments.map((p): Transaction => ({ id: p.id, date: p.on, childId: c.studentId, description: c.title, amount: -p.amount, method: p.method === "Education account" ? "Education account" : "Card", invoiceId: c.id })));
  const paidIn = topUps
    .filter((t) => ids.has(t.studentId))
    .map((t): Transaction => ({ id: `TX-${t.id}`, date: t.date, childId: t.studentId, description: `${t.note} (${t.ref})`, amount: t.amount, method: "MOE top-up" }));
  return [...ledger, ...payments, ...paidIn].sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * The fee-store actions for paying the chosen invoices. Account first: each child's balance pays that child's invoices in order and the
 * rest goes to the card; gateway: everything by card. The fee store then updates the charge and the student's Education Account.
 */
export function payActions(invoices: Invoice[], children: Child[], ids: ReadonlySet<string>, mode: Mode): FeeAction[] {
  const out: FeeAction[] = [];
  for (const line of settle(invoices, children, ids, mode).lines) {
    let left = line.fromAccount;
    for (const i of invoices.filter((x) => x.childId === line.child.id && isPayable(x) && ids.has(x.id))) {
      const account = Math.min(left, i.amount);
      left = cents(left - account);
      if (account > 0) out.push({ type: "recordPayment", chargeId: i.id, amount: account, method: "Education account" });
      if (cents(i.amount - account) > 0) out.push({ type: "recordPayment", chargeId: i.id, amount: cents(i.amount - account), method: "Card / PayNow" });
    }
  }
  return out;
}

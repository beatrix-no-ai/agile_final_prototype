import { describe, expect, test } from "vitest";
import { feeReducer, initialFeeState } from "../data/feeStore";
import { FAMILY_STUDENT_NAMES } from "../data/parent";
import { CLASS_RECORDS, SCHOOL_RECORDS } from "../data/schoolMgmt";
import { STUDENTS } from "../data/students";
import { ledgerFor } from "./accounts";
import { balanceOf, chargeStatus, payableOf } from "./fees";
import { familyChildren, familyInvoices, familyTransactions, payActions } from "./family";
import { settle } from "../features/eservice/payments/settle";

const fees = initialFeeState();
const kids = familyChildren(STUDENTS, {}, SCHOOL_RECORDS, CLASS_RECORDS);
const [ethan, chloe] = kids;
const invoices = familyInvoices(fees.charges, kids.map((k) => k.id));

describe("the parent's children are real students", () => {
  test("two children, named and levelled from the student records", () => {
    expect(kids.map((k) => k.name)).toEqual([...FAMILY_STUDENT_NAMES]);
    expect(kids.map((k) => k.level)).toEqual(["Primary 5", "Secondary 2"]);
    for (const k of kids) {
      expect(STUDENTS.find((s) => s.id === k.id)!.name).toBe(k.name);
      expect(k.school).toMatch(/School/);
    }
  });

  test("the Education Account balance is the student's balance less what the parent has paid from it", () => {
    const s = STUDENTS.find((x) => x.id === chloe.id)!;
    expect(chloe.educationBalance).toBe(s.balance);
    expect(familyChildren(STUDENTS, { [chloe.id]: 10 }, SCHOOL_RECORDS, CLASS_RECORDS)[1].educationBalance).toBe(Math.round((s.balance - 10) * 100) / 100);
  });

  test("the Payments demo cases still exist: one empty account, one that only partly covers the bill", () => {
    const owed = (id: string) => invoices.filter((i) => i.childId === id && i.status !== "paid").reduce((t, i) => t + i.amount, 0);
    expect(ethan.educationBalance).toBe(0);
    expect(chloe.educationBalance).toBeGreaterThan(0);
    expect(chloe.educationBalance).toBeLessThan(owed(chloe.id));
  });
});

describe("invoices are the student's fee charges", () => {
  test("an open invoice is what is still owed on the charge, with the charge's status", () => {
    const open = invoices.filter((x) => x.status !== "paid");
    expect(open.length).toBeGreaterThan(0);
    for (const i of open) {
      const c = fees.charges.find((x) => x.id === i.id)!;
      expect(i.amount).toBe(balanceOf(c));
      expect(i.status).toBe(chargeStatus(c) === "overdue" ? "overdue" : "unpaid");
      expect(i.childId).toBe(c.studentId);
      expect(i.title).toBe(c.title);
      expect(i.dueDate).toBe(c.due);
    }
  });

  test("a settled charge shows as a paid invoice for what was payable", () => {
    const paid = invoices.filter((i) => i.status === "paid");
    expect(paid.length).toBeGreaterThan(0);
    for (const i of paid) expect(i.amount).toBe(payableOf(fees.charges.find((c) => c.id === i.id)!));
  });

  test("a FAS decision lowers what the parent owes", () => {
    const owed = (list: typeof invoices) => list.filter((i) => i.status !== "paid").reduce((t, i) => t + i.amount, 0);
    const s = feeReducer(fees, { type: "applyFas", studentId: chloe.id, fas: { scheme: "SBFAS", rate: 0.5 }, on: "2026-10-18" });
    expect(owed(familyInvoices(s.charges, [chloe.id]))).toBeLessThan(owed(invoices.filter((i) => i.childId === chloe.id)));
  });

  test("new charges the school issues show up as invoices", () => {
    const s = feeReducer(fees, { type: "generate", fee: fees.types[0], students: [STUDENTS.find((x) => x.id === chloe.id)!], issued: "2026-10-20", due: "2026-11-19" });
    expect(familyInvoices(s.charges, [chloe.id]).length).toBe(invoices.filter((i) => i.childId === chloe.id).length + 1);
  });
});

describe("transactions", () => {
  const txs = familyTransactions(fees.charges, STUDENTS.filter((s) => kids.some((k) => k.id === s.id)));
  test("each child has an MOE top-up credit equal to the account ledger", () => {
    for (const k of kids) {
      const top = txs.find((t) => t.childId === k.id && t.method === "MOE top-up")!;
      expect(top.amount).toBe(ledgerFor(STUDENTS.find((s) => s.id === k.id)!)[0].amount);
    }
  });
  test("every payment on a charge is a debit tied to its invoice, cards labelled Card", () => {
    const paidOn = fees.charges.filter((c) => kids.some((k) => k.id === c.studentId)).flatMap((c) => c.payments.map((p) => ({ c, p })));
    expect(paidOn.length).toBeGreaterThan(0);
    for (const { c, p } of paidOn) {
      const t = txs.find((x) => x.id === p.id)!;
      expect(t).toMatchObject({ childId: c.studentId, amount: -p.amount, invoiceId: c.id, method: p.method === "Education account" ? "Education account" : "Card" });
    }
  });
  test("newest first", () => {
    const dates = txs.map((t) => t.date);
    expect(dates).toEqual([...dates].sort().reverse());
  });
});

describe("paying", () => {
  const open = invoices.filter((i) => i.childId === chloe.id && i.status !== "paid");
  const ids = new Set(open.map((i) => i.id));
  const sumOf = (acts: ReturnType<typeof payActions>, method: string) =>
    Math.round(acts.reduce((t, a) => t + (a.type === "recordPayment" && a.method === method ? a.amount : 0), 0) * 100) / 100;

  test("account first: the balance pays that child's invoices, the rest goes to the card", () => {
    const acts = payActions(invoices, kids, ids, "account-first");
    const total = Math.round(open.reduce((t, i) => t + i.amount, 0) * 100) / 100;
    expect(sumOf(acts, "Education account")).toBe(chloe.educationBalance);
    expect(Math.round((sumOf(acts, "Education account") + sumOf(acts, "Card / PayNow")) * 100) / 100).toBe(total);
  });

  test("gateway only never touches the account", () => {
    const acts = payActions(invoices, kids, ids, "gateway");
    expect(acts.length).toBeGreaterThan(0);
    expect(acts.every((a) => a.type === "recordPayment" && a.method === "Card / PayNow")).toBe(true);
  });

  test("paying through the fee store settles the invoices and debits the account, so the admin side sees it too", () => {
    let s = fees;
    for (const a of payActions(invoices, kids, ids, "account-first")) s = feeReducer(s, a);
    expect(familyInvoices(s.charges, [chloe.id]).every((i) => i.status === "paid")).toBe(true);
    expect(s.debits[chloe.id]).toBe(chloe.educationBalance);
    expect(familyChildren(STUDENTS, s.debits, SCHOOL_RECORDS, CLASS_RECORDS)[1].educationBalance).toBe(0);
    expect(settle(familyInvoices(s.charges, [chloe.id]), kids, ids, "gateway").total).toBe(0);
  });

  test("a card payment leaves the account alone", () => {
    let s = fees;
    for (const a of payActions(invoices, kids, ids, "gateway")) s = feeReducer(s, a);
    expect(s.debits[chloe.id] ?? 0).toBe(0);
  });
});

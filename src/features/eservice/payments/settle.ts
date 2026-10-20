import { splitSettlement } from "../../../lib/settlement";
import type { Child, Invoice, Transaction } from "../../../data/parent";

// Payment rule: each child's Education Account is spent first (on that child's invoices only), the remainder goes to the card/bank gateway.
export type Line = { child: Child; total: number; fromAccount: number; fromGateway: number };
export type Summary = { lines: Line[]; total: number; fromAccount: number; fromGateway: number };

export const isPayable = (i: Invoice) => i.status !== "paid";
const cents = (n: number) => Math.round(n * 100) / 100;
const sum = (xs: number[]) => cents(xs.reduce((a, b) => a + b, 0));

export function settle(invoices: Invoice[], children: Child[], ids: ReadonlySet<string>): Summary {
  const lines = children
    .map((child) => {
      const total = sum(invoices.filter((i) => i.childId === child.id && isPayable(i) && ids.has(i.id)).map((i) => i.amount));
      const s = splitSettlement(total, child.educationBalance);
      return { child, total, fromAccount: cents(s.fromAccount), fromGateway: cents(s.fromGateway) };
    })
    .filter((l) => l.total > 0);
  return {
    lines,
    total: sum(lines.map((l) => l.total)),
    fromAccount: sum(lines.map((l) => l.fromAccount)),
    fromGateway: sum(lines.map((l) => l.fromGateway)),
  };
}

/** Marks the selected payable invoices paid and deducts the Education Account share from each child's balance. */
export function applyPayment(invoices: Invoice[], children: Child[], ids: ReadonlySet<string>) {
  const { lines } = settle(invoices, children, ids);
  const spent = new Map(lines.map((l) => [l.child.id, l.fromAccount]));
  return {
    invoices: invoices.map((i) => (isPayable(i) && ids.has(i.id) ? { ...i, status: "paid" as const } : i)),
    children: children.map((c) => ({ ...c, educationBalance: cents(c.educationBalance - (spent.get(c.id) ?? 0)) })),
  };
}

/**
 * Ledger rows for a payment, newest first: per invoice, the Education Account share (debits the account) and the gateway share (Card).
 * Row amounts sum to -invoice amount and only account rows move the balance, so balance === ledgerBalance() still holds after paying.
 */
export function paymentTransactions(invoices: Invoice[], children: Child[], ids: ReadonlySet<string>, date: string, firstSeq: number): Transaction[] {
  const rows: Transaction[] = [];
  const row = (i: Invoice, amount: number, method: Transaction["method"]) =>
    rows.push({ id: `TX-PAY-${String(firstSeq + rows.length).padStart(3, "0")}`, date, childId: i.childId, description: i.title, amount: -amount, method, invoiceId: i.id });
  for (const line of settle(invoices, children, ids).lines) {
    let left = line.fromAccount;
    for (const i of invoices.filter((x) => x.childId === line.child.id && isPayable(x) && ids.has(x.id))) {
      const account = Math.min(left, i.amount);
      left = cents(left - account);
      if (account > 0) row(i, account, "Education account");
      if (cents(i.amount - account) > 0) row(i, cents(i.amount - account), "Card");
    }
  }
  return rows.reverse();
}

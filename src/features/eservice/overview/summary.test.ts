import { expect, test } from "vitest";
import type { Invoice } from "../../../data/parent";
import { childOutstanding, nextDue, outstanding, paidThisYear, validateProfile } from "./summary";

const inv = (id: string, childId: string, amount: number, status: Invoice["status"], dueDate = "2026-10-31"): Invoice => ({ id, childId, title: id, amount, dueDate, status });
const invoices = [
  inv("a", "c1", 28, "unpaid", "2026-10-31"),
  inv("b", "c2", 54, "unpaid", "2026-10-31"),
  inv("c", "c2", 85, "overdue", "2026-09-30"),
  inv("d", "c1", 25, "unpaid", "2026-11-14"),
  inv("e", "c1", 126.5, "paid", "2026-07-31"),
];

test("outstanding is the sum of unpaid and overdue invoices", () => {
  expect(outstanding(invoices)).toBe(192);
  expect(childOutstanding(invoices, "c1")).toBe(53);
  expect(childOutstanding(invoices, "c2")).toBe(139);
});

test("paid this year sums paid invoices", () => {
  expect(paidThisYear(invoices)).toBe(126.5);
});

test("nextDue groups unpaid invoices on the earliest upcoming date and skips overdue", () => {
  expect(nextDue(invoices)).toEqual({ date: "2026-10-31", amount: 82, count: 2 });
  expect(nextDue([])).toBeNull();
});

test("validateProfile", () => {
  const ok = { address: "Blk 1 Bishan St 23, Singapore 570214", mailingAddress: "Blk 1 Bishan St 23, Singapore 570214", contact: "+65 9123 4567" };
  expect(validateProfile(ok)).toEqual({});
  expect(Object.keys(validateProfile({ address: "", mailingAddress: "x", contact: "12345" })).sort()).toEqual(["address", "contact", "mailingAddress"]);
  expect(validateProfile({ ...ok, contact: "91234567" })).toEqual({});
  expect(validateProfile({ ...ok, contact: "5123 4567" }).contact).toBeTruthy();
  expect(validateProfile({ ...ok, contact: "+65 9123-4567" })).toEqual({});
  expect(validateProfile({ ...ok, contact: "3123 4567" })).toEqual({});
  expect(validateProfile({ ...ok, contact: "+65 5123 4567" }).contact).toBeTruthy();
  expect(validateProfile({ ...ok, address: "Blk 1 Bishan St 23" }).address).toBeTruthy();
});

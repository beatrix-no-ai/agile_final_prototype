import { describe, expect, test } from "vitest";
import { applyPayment, settle } from "./settle";
import type { Child, Invoice } from "../../../data/parent";

const kid = (id: string, educationBalance: number): Child => ({ id, name: id, level: "P4", school: "S", educationBalance });
const inv = (id: string, childId: string, amount: number, status: Invoice["status"] = "unpaid"): Invoice => ({ id, childId, title: id, amount, dueDate: "2026-10-31", status });
const invoices = [inv("a", "c1", 42), inv("b", "c1", 65.1), inv("c", "c2", 15), inv("p", "c1", 10, "paid")];
const ids = (...x: string[]) => new Set(x);

describe("settle", () => {
  test("balance 0: everything goes to the gateway", () => {
    const s = settle(invoices, [kid("c1", 0), kid("c2", 0)], ids("a", "c"));
    expect(s).toMatchObject({ total: 57, fromAccount: 0, fromGateway: 57 });
  });
  test("balance > total: gateway share is 0", () => {
    const s = settle(invoices, [kid("c1", 500), kid("c2", 0)], ids("a"));
    expect(s).toMatchObject({ total: 42, fromAccount: 42, fromGateway: 0 });
  });
  test("total 0: empty valid breakdown, paid invoices ignored", () => {
    const s = settle(invoices, [kid("c1", 100), kid("c2", 100)], ids("p"));
    expect(s).toEqual({ lines: [], total: 0, fromAccount: 0, fromGateway: 0 });
  });
  test("partial balance is per child and rounded to cents", () => {
    const s = settle(invoices, [kid("c1", 50), kid("c2", 5)], ids("a", "b", "c"));
    expect(s).toMatchObject({ total: 122.1, fromAccount: 55, fromGateway: 67.1 });
  });
});

test("applyPayment marks invoices paid and decreases balances", () => {
  const r = applyPayment(invoices, [kid("c1", 50), kid("c2", 0)], ids("a", "c"));
  expect(r.invoices.filter((i) => i.status === "paid").map((i) => i.id)).toEqual(["a", "c", "p"]);
  expect(r.children.map((c) => c.educationBalance)).toEqual([8, 0]);
});

import { describe, expect, test } from "vitest";
import { activeRulesInOrder, overlapCount, stackRules, topUpReport } from "./topup";
import { makeNric, maskNric } from "./nric";
import { buildXlsx, crc32, columnName } from "./xlsx";
import { initialRegistry } from "../data/registryStore";
import { FUND_RULES, type Transaction } from "../data/topup";
import { accountsOf } from "./accounts";

const reg = initialRegistry();
const ACCOUNTS = accountsOf(reg.students, reg.classes, reg.schools, { debits: {}, credits: {} });

describe("nric", () => {
  test("generates S/T-format ids with a check letter", () => {
    expect(makeNric(2018, 41207)).toMatch(/^T18\d{5}[A-Z]$/);
    expect(makeNric(1990, 1)).toMatch(/^S90\d{5}[A-Z]$/);
  });
  test("masks all but the first letter, last three digits and check letter", () => {
    expect(maskNric("T1841207J")).toBe("T****207J");
  });
});

describe("stacked top-up rules", () => {
  const rules = [...FUND_RULES].map((r) => ({ ...r, status: "Active" as const, schools: [], ageMin: 7, ageMax: 16, minBalance: 0, maxBalance: 99999 }));
  test("overlapping rules both apply to the same account, in creation order", () => {
    const ordered = activeRulesInOrder([rules[1], rules[0]]);
    expect(ordered.map((r) => r.id)).toEqual(["TUR01001", "TUR01002"]);
    const stack = stackRules(ordered, ACCOUNTS);
    expect(stack[0].accounts.length).toBeGreaterThan(0);
    expect(overlapCount(stack)).toBe(stack[0].accounts.length);
  });
});

describe("xlsx and report", () => {
  test("crc32 and column names", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
    expect([columnName(0), columnName(25), columnName(26)]).toEqual(["A", "Z", "AA"]);
  });
  test("workbook is a zip with a sheet part", () => {
    const bytes = buildXlsx("Test", [["a", 1]]);
    expect(String.fromCharCode(bytes[0], bytes[1])).toBe("PK");
    expect(new TextDecoder().decode(bytes)).toContain("xl/worksheets/sheet1.xml");
  });
  test("report follows the customer's layout: header block, summary, failed records, successful records", () => {
    const t = { type: "Batch", recipient: "Primary Student Support 2026", amount: 200, date: "2026-10-18", detail: "Annual top-up" } as Transaction;
    const a = ACCOUNTS[0], b = ACCOUNTS[1];
    const { rows, opts } = topUpReport(t, "BAT181026001", [
      { student: a.name, account: a.nric, status: "Success", txid: "TUT1" },
      { student: b.name, account: b.nric, status: "Failed", reason: "Account inactive" },
    ], ACCOUNTS, new Date(2026, 9, 18));
    const text = (c: unknown) => (typeof c === "object" && c ? (c as { v: unknown }).v : c);
    const at = (r: number, c: number) => text(rows[r - 1]?.[c - 1]);
    expect(opts.merges).toEqual(["A1:B1"]);
    expect(at(1, 1)).toBe("MINISTRY OF EDUCATION STUDENT FINANCE SYSTEM");
    expect([at(2, 1), at(3, 1), at(4, 1), at(5, 1), at(6, 1)]).toEqual(["Report Title", "Job ID", "Job Title", "Report Date", "Rule Name"]);
    expect([at(3, 2), at(4, 2), at(5, 2), at(6, 2)]).toEqual(["BAT181026001", "Annual top-up", "18 Oct 2026", "Primary Student Support 2026"]);
    expect([at(9, 1), at(9, 2), at(9, 3)]).toEqual(["Education Account Top-Up", "No. of Accounts", "Amount Credited ($)"]);
    expect([at(10, 1), at(10, 2), at(10, 3)]).toEqual(["Successful Records", 1, 200]);
    expect([at(11, 1), at(11, 2), at(11, 3)]).toEqual(["Failed Records", 1, 200]);
    expect(at(14, 1)).toBe("Failed Records");
    expect([at(15, 1), at(15, 2), at(15, 3), at(15, 4)]).toEqual(["S/N", "Stakeholder UIN", "Stakeholder Name", "Reason"]);
    expect([at(16, 1), at(16, 2), at(16, 3), at(16, 4)]).toEqual([1, b.nric, b.name, "Account inactive"]);
    expect(at(18, 1)).toBe("Successful Records");
    expect([at(19, 4), at(19, 5), at(19, 6)]).toEqual(["Level", "Class", "Amount Credited ($)"]);
    expect([at(20, 1), at(20, 2), at(20, 3), at(20, 5), at(20, 6)]).toEqual([1, a.nric, a.name, a.class, 200]);
    expect(a.class.startsWith(String(at(20, 4)))).toBe(true);
  });
});
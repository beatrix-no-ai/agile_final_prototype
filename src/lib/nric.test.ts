import { describe, expect, test } from "vitest";
import { activeRulesInOrder, overlapCount, stackRules, topUpReportRows } from "./topup";
import { makeNric, maskNric } from "./nric";
import { buildXlsx, crc32, columnName } from "./xlsx";
import { ACCOUNTS, FUND_RULES, type Transaction } from "../data/topup";

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
  test("report lists only successful accounts", () => {
    const t = { amount: 100, date: "2026-10-18", detail: "x" } as Transaction;
    const a = ACCOUNTS[0], b = ACCOUNTS[1];
    const rows = topUpReportRows(t, "BAT181026001", [
      { student: a.name, account: a.nric, status: "Success", txid: "TUT1" },
      { student: b.name, account: b.nric, status: "Failed", reason: "x" },
    ], ACCOUNTS);
    expect(rows).toHaveLength(2);
    expect(rows[1][3]).toBe(a.name);
  });
});

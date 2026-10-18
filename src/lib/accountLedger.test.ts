import { describe, expect, it } from "vitest";
import { initialRegistry } from "../data/registryStore";
import type { AccountPayment } from "../data/fees";
import { STUDENTS } from "../data/students";
import type { TopUpEntry } from "../data/topup";
import { accountLedger, accountsOf } from "./accounts";

describe("Top-up accounts are the real students", () => {
  const reg = initialRegistry();
  const none = { debits: {}, credits: {} };
  const accts = accountsOf(reg.students, reg.classes, reg.schools, none);

  it("one account per student, with the student's id, NRIC, name and class", () => {
    expect(accts).toHaveLength(reg.students.length);
    for (const s of reg.students) expect(accts.find((a) => a.id === s.id)).toMatchObject({ nric: s.nric, name: s.name, class: s.class });
  });

  it("the school is the school of the student's class, by name", () => {
    const s = reg.students.find((x) => x.level === "P5")!;
    expect(accts.find((a) => a.id === s.id)!.school).toBe(reg.schools.find((x) => x.code === "S002")!.name);
  });

  it("ages run 7 to 16 (Req 1); accounts close at 16; an inactive student is not enrolled", () => {
    const ages = accts.map((a) => a.age);
    expect([Math.min(...ages), Math.max(...ages)]).toEqual([7, 16]);
    expect(accts.filter((a) => a.age >= 16).every((a) => a.status === "Closed")).toBe(true);
    expect(accts.filter((a) => a.age < 16).every((a) => a.status === "Active")).toBe(true);
    const inactive = reg.students.find((s) => s.status === "Inactive")!;
    expect(accts.find((a) => a.id === inactive.id)).toMatchObject({ enrolled: false, schooling: "Inactive" });
  });

  it("the balance is the student's balance plus top-ups less what was paid from the account", () => {
    const s = reg.students[0];
    const live = accountsOf([s], reg.classes, reg.schools, { debits: { [s.id]: 10 }, credits: { [s.id]: 150 } })[0];
    expect(live.balance).toBe(Math.round((s.balance + 150 - 10) * 100) / 100);
  });
});

describe("the Education Account ledger", () => {
  const s = { ...STUDENTS[0], baseBalance: STUDENTS[0].balance, balance: STUDENTS[0].balance + 150 - 35.25 };
  const topUps: TopUpEntry[] = [{ id: "TU-1", studentId: s.id, amount: 150, date: "2026-10-18", ref: "TUT181026", note: "Mid-year top-up" }];
  const paid: AccountPayment[] = [{ id: "CH-1-P1", studentId: s.id, amount: 35.25, on: "2026-10-19", title: "School Fees" }];
  const rows = accountLedger(s, topUps, paid);

  it("shows the earlier ledger, the new top-ups and the payments from the account", () => {
    expect(rows.map((r) => r.description)).toEqual(expect.arrayContaining(["Annual MOE top-up", "Mid-year top-up (TUT181026)", "School Fees"]));
  });
  it("newest first", () => {
    const dates = rows.map((r) => r.date);
    expect(dates).toEqual([...dates].sort().reverse());
  });
  it("always adds up to the balance shown on the account", () => {
    const sum = Math.round(rows.reduce((t, r) => t + r.amount * 100, 0));
    expect(sum).toBe(Math.round(s.balance * 100));
  });
  it("only counts this student's entries", () => {
    expect(accountLedger(s, [{ ...topUps[0], studentId: "other" }], [{ ...paid[0], studentId: "other" }])).toHaveLength(3);
  });
});

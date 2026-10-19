import { describe, expect, it } from "vitest";
import { MASTER, type Charge, type FeeType } from "../../../data/fees";
import { filterRounds, historyRounds } from "./history";

const types: FeeType[] = [
  { id: "FT-01", school: "S001", name: "Robotics Club", updated: "2026-10-01", components: [{ name: "Kit", amount: 35 }] },
  { id: "FT-99", school: "S002", name: "Other school's fee", updated: "2026-10-01", components: [{ name: "X", amount: 1 }] },
  { id: "MFT-01", school: MASTER, scope: "Primary", name: "School Fees (Primary)", updated: "2026-09-01", components: [{ name: "Tuition Fee", amount: 250 }] },
];
const ch = (id: string, ftId: string, studentId: string, issued: string, title: string): Charge =>
  ({ id, studentId, ftId, title, issued, due: "2026-11-16", components: [], payments: [] });
const mine = new Set(["STU1", "STU2"]);
const rounds = historyRounds(
  [
    ch("C1", "FT-01", "STU1", "2026-10-19", "Robotics Club"),
    ch("C2", "FT-01", "STU2", "2026-10-19", "Robotics Club"),
    ch("C3", "MFT-01", "STU1", "2026-10-19", "School Fees (Primary)"), // same day, other source
    ch("C4", "FT-99", "STU1", "2026-10-19", "Other school's fee"),     // wrong school's School Bill
    ch("C5", "MFT-01", "STU9", "2026-10-19", "Stranger's MOE bill"),   // MOE Bill for another school's student
  ],
  types,
  "S001",
  (id) => mine.has(id),
);

describe("historyRounds — split by bill source", () => {
  it("keeps MOE and School rounds separate even on the same day (a round is always pure)", () => {
    expect(rounds.map((r) => r.kind).sort()).toEqual(["moe", "school"]);
    const same = rounds.filter((r) => r.issued === "2026-10-19");
    expect(same).toHaveLength(2);
  });
  it("aggregates one fee type + date into a single round with its charges", () => {
    const sch = rounds.find((r) => r.kind === "school")!;
    expect(sch.rows).toHaveLength(2);
    expect(sch.title).toBe("Robotics Club");
  });
  it("excludes another school's School Bills and MOE Bills for other schools' students", () => {
    expect(rounds.some((r) => r.rows.some((c) => c.id === "C4" || c.id === "C5"))).toBe(false);
  });
});

describe("filterRounds", () => {
  it("the bill-kind filter keeps only that side", () => {
    expect(filterRounds(rounds, { kind: "moe" }).every((r) => r.kind === "moe")).toBe(true);
    expect(filterRounds(rounds, { kind: "school" })).toHaveLength(1);
  });
  it("the issued-date range narrows rounds", () => {
    expect(filterRounds(rounds, { from: "2026-10-20" })).toHaveLength(0);
    expect(filterRounds(rounds, { to: "2026-10-19" })).toHaveLength(2);
  });
  it("the search box matches the caller's searchable text", () => {
    expect(filterRounds(rounds, { q: "primary" })).toHaveLength(1);
    expect(filterRounds(rounds, { q: "primary", textOf: () => "Robotics" })).toHaveLength(0);
  });
});

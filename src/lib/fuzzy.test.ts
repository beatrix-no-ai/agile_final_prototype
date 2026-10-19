import { describe, expect, it } from "vitest";
import { fuzzyMatch } from "./fuzzy";

const rec = (name: string, id: string, klass: string) => [name, id, klass];

describe("fuzzyMatch", () => {
  it("matches on substring across fields", () => {
    expect(fuzzyMatch("tannya", rec("Tannya Lim", "STU012", "P3-1"))).toBe(true);
    expect(fuzzyMatch("stu01", rec("Tannya Lim", "STU012", "P3-1"))).toBe(true);
  });
  it("tolerates small typos per word", () => {
    expect(fuzzyMatch("tannya lom", rec("Tannya Lim", "STU012", "P3-1"))).toBe(true);   // Lim ~ lom (1 edit)
    expect(fuzzyMatch("jin hui", rec("Tan Ji Hui", "STU007", "P3-1"))).toBe(true);      // Ji ~ jin, Hui exact
  });
  it("requires every token to match (AND across tokens)", () => {
    expect(fuzzyMatch("tannya p3", rec("Tannya Lim", "STU012", "P3-1"))).toBe(true);
    expect(fuzzyMatch("tannya p5", rec("Tannya Lim", "STU012", "P3-1"))).toBe(false);
  });
  it("short tokens match only as a substring or exact word (no 1-edit leniency under 3 chars)", () => {
    expect(fuzzyMatch("ab", rec("Able Tan", "STU001", "P3-1"))).toBe(true);             // substring of "able"
    expect(fuzzyMatch("xy", rec("Able Tan", "STU001", "P3-1"))).toBe(false);            // 2-letter token: distance 0 only
  });
  it("a nonsense query matches nothing; an empty query matches everyone", () => {
    expect(fuzzyMatch("zzz qqq", rec("Tannya Lim", "STU012", "P3-1"))).toBe(false);
    expect(fuzzyMatch("", rec("Tannya Lim", "STU012", "P3-1"))).toBe(true);
  });
});

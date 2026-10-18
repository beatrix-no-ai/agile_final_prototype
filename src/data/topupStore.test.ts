import { describe, expect, it } from "vitest";
import { initialTopUp, topUpReducer } from "./topupStore";
import { FUND_RULES, PAST_TRANSACTIONS, type Transaction } from "./topup";

const row = (o: Partial<Transaction> = {}): Transaction => ({
  ref: "TUT181026", type: "Batch", recipient: "Mid-year top-up", detail: "Mid-year top-up", date: "2026-10-18", schedule: "Run now (ad-hoc)",
  accounts: 2, amount: 150, status: "Success", by: "Daniel Lee", ...o,
});
const s0 = initialTopUp();

describe("top-up store", () => {
  it("starts with the saved rules and past transactions, and nothing credited", () => {
    expect(s0.rules).toBe(FUND_RULES);
    expect(s0.history).toBe(PAST_TRANSACTIONS);
    expect(s0.credits).toEqual({});
    expect(s0.entries).toEqual([]);
  });

  it("a top-up is added to the history and credits each account", () => {
    const s = topUpReducer(s0, { type: "topUp", row: row(), creditedIds: ["S1", "S2"] });
    expect(s.history[0].ref).toBe("TUT181026");
    expect(s.history).toHaveLength(PAST_TRANSACTIONS.length + 1);
    expect(s.credits).toEqual({ S1: 150, S2: 150 });
    expect(s.entries.map((e) => [e.studentId, e.amount, e.date])).toEqual([["S1", 150, "2026-10-18"], ["S2", 150, "2026-10-18"]]);
  });

  it("credits add up across top-ups, to the cent", () => {
    let s = topUpReducer(s0, { type: "topUp", row: row({ amount: 0.1 }), creditedIds: ["S1"] });
    s = topUpReducer(s, { type: "topUp", row: row({ amount: 0.2 }), creditedIds: ["S1"] });
    expect(s.credits.S1).toBe(0.3);
    expect(s.entries).toHaveLength(2);
  });

  it("a scheduled (pending) top-up is recorded but credits nothing yet", () => {
    const s = topUpReducer(s0, { type: "topUp", row: row({ status: "Pending" }), creditedIds: [] });
    expect(s.history).toHaveLength(PAST_TRANSACTIONS.length + 1);
    expect(s.credits).toEqual({});
    expect(s.entries).toEqual([]);
  });

  it("rules are replaced as a whole", () => {
    const s = topUpReducer(s0, { type: "setRules", rules: [] });
    expect(s.rules).toEqual([]);
    expect(s.history).toBe(s0.history);
  });
});

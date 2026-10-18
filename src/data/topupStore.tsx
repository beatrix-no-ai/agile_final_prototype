import { createContext, useContext, useReducer, type Dispatch, type ReactNode } from "react";
import { FUND_RULES, PAST_TRANSACTIONS, type FundRule, type TopUpEntry, type Transaction } from "./topup";

// ASSUMPTION: top-up history, saved rules and what has been credited live in memory only and reset on reload (no backend).
// `credits` is what MOE has paid into each Education Account (by student id), so every screen shows the same balance.
export type TopUpState = { history: Transaction[]; rules: FundRule[]; credits: Record<string, number>; entries: TopUpEntry[] };
export type TopUpAction =
  | { type: "topUp"; row: Transaction; creditedIds: string[] }
  | { type: "setRules"; rules: FundRule[] };

export const initialTopUp = (): TopUpState => ({ history: PAST_TRANSACTIONS, rules: FUND_RULES, credits: {}, entries: [] });

/**
 * Pure. topUp puts the row first in the history and credits each account in `creditedIds` with the row's amount
 * (a scheduled run credits nobody yet). setRules replaces the saved rules.
 */
export function topUpReducer(state: TopUpState, a: TopUpAction): TopUpState {
  if (a.type === "setRules") return { ...state, rules: a.rules };
  const credits = { ...state.credits };
  const entries = [...state.entries];
  for (const id of a.creditedIds) {
    credits[id] = Math.round(((credits[id] ?? 0) + a.row.amount) * 100) / 100;
    entries.push({ id: `TU-${entries.length + 1}`, studentId: id, amount: a.row.amount, date: a.row.date, ref: a.row.ref, note: a.row.type === "Batch" ? a.row.recipient : a.row.detail.split(" · ").pop() ?? a.row.detail });
  }
  return { ...state, history: [a.row, ...state.history], credits, entries };
}

const Ctx = createContext<{ state: TopUpState; dispatch: Dispatch<TopUpAction> } | null>(null);

export function TopUpProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(topUpReducer, undefined, initialTopUp);
  return <Ctx.Provider value={{ state, dispatch }}>{children}</Ctx.Provider>;
}

export function useTopUp() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useTopUp must be used inside TopUpProvider");
  return c;
}

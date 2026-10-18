import { createContext, useContext, useReducer, type Dispatch, type ReactNode } from "react";
import { applyPayment, paymentTransactions, type Mode } from "../features/eservice/payments/settle";
import type { ProfileForm } from "../features/eservice/overview/summary";
import { children, invoices, profile, transactions, type Child, type Invoice, type Profile, type Transaction } from "./parent";

// ASSUMPTION: parent state lives in memory only and resets on reload (no backend). Payments, Overview and profile edit
// all read and write this one store, so a payment on /parent/payments shows on /parent until the page is reloaded.
/** Where the family's FAS application stands: nothing started, being prepared, or submitted (then under review). */
export type FasStage = "not-started" | "preparing" | "submitted";
export type FasProgress = { stage: FasStage; submittedOn?: string };
export type ParentState = { invoices: Invoice[]; children: Child[]; transactions: Transaction[]; profile: Profile; fas: FasProgress };

export type ParentAction =
  | { type: "pay"; ids: string[]; mode: Mode; date: string }
  | { type: "saveProfile"; form: ProfileForm }
  | { type: "startFas" }
  | { type: "submitFas"; date: string };

export const initialParentState: ParentState = { invoices, children, transactions, profile, fas: { stage: "not-started" } };

/** Pure: pay marks invoices paid, debits the Education Accounts and prepends the ledger rows; saveProfile merges the editable fields. */
export function parentReducer(state: ParentState, action: ParentAction): ParentState {
  switch (action.type) {
    case "pay": {
      const ids = new Set(action.ids);
      const paid = applyPayment(state.invoices, state.children, ids, action.mode);
      const rows = paymentTransactions(state.invoices, state.children, ids, action.mode, action.date, state.transactions.length + 1);
      return { ...state, ...paid, transactions: [...rows, ...state.transactions] };
    }
    case "saveProfile":
      return { ...state, profile: { ...state.profile, ...action.form } };
    case "startFas":
      return state.fas.stage === "not-started" ? { ...state, fas: { stage: "preparing" } } : state;
    case "submitFas":
      return state.fas.stage === "preparing" ? { ...state, fas: { stage: "submitted", submittedOn: action.date } } : state;
  }
}

const Ctx = createContext<{ state: ParentState; dispatch: Dispatch<ParentAction> } | null>(null);

export function ParentProvider({ children: kids }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(parentReducer, initialParentState);
  return <Ctx.Provider value={{ state, dispatch }}>{kids}</Ctx.Provider>;
}

export function useParent() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useParent must be used inside ParentProvider");
  return c;
}

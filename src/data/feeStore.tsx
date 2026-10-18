import { createContext, useContext, useReducer, type Dispatch, type ReactNode } from "react";
import { FEE_TYPES, type AccountPayment, type Charge, type FasScheme, type FeeType, type PayMethod } from "./fees";
import { alreadyCharged, balanceOf, makeCharge, makePayment, nextChargeId, seedCharges, subsidyOf } from "../lib/fees";
import type { Student } from "./students";

// ASSUMPTION: fee state lives in memory only and resets on reload (no backend), like the parent store.
/** `debits`: what has been paid out of each student's Education Account since the start (by student id), parent or school side; `paidFromAccount` lists those payments. */
export type FeeState = { types: FeeType[]; charges: Charge[]; debits: Record<string, number>; paidFromAccount: AccountPayment[] };
export type FeeAction =
  | { type: "saveType"; fee: FeeType }
  | { type: "generate"; fee: FeeType; students: Student[]; issued: string; due: string }
  | { type: "recordPayment"; chargeId: string; amount: number; method: PayMethod }
  | { type: "applyFas"; studentId: string; fas: { scheme: FasScheme; rate: number } | null; on: string };

export const initialFeeState = (): FeeState => ({ types: FEE_TYPES, charges: seedCharges(), debits: {}, paidFromAccount: [] });

/**
 * Pure. saveType adds or replaces by id (issued charges keep their copied components).
 * generate skips students already holding this fee type issued on the same date.
 * recordPayment appends a parent payment (from the Education Account or the gateway) to one charge; a payment from the
 * Education Account is also added to the student's debits, so every screen shows the same balance.
 * applyFas re-prices a student's charges that still have something to pay when a FAS decision changes their scheme;
 * settled charges stay as issued, and the change is recorded on the charge (fasAdjusted), never made silently.
 */
export function feeReducer(state: FeeState, a: FeeAction): FeeState {
  if (a.type === "saveType") {
    const has = state.types.some((f) => f.id === a.fee.id);
    return { ...state, types: has ? state.types.map((f) => (f.id === a.fee.id ? a.fee : f)) : [...state.types, a.fee] };
  }
  if (a.type === "applyFas") {
    const rate = a.fas?.rate ?? 0;
    return {
      ...state,
      charges: state.charges.map((c) => {
        if (c.studentId !== a.studentId || balanceOf(c) <= 0.005) return c;
        const next: Charge = { ...c, fas: a.fas?.scheme, components: c.components.map((x) => ({ ...x, subsidy: Math.round(x.amount * rate * 100) / 100 })) };
        const change = Math.round((subsidyOf(next) - subsidyOf(c)) * 100) / 100;
        return change === 0 && c.fas === next.fas ? c : { ...next, fasAdjusted: { on: a.on, amount: change } };
      }),
    };
  }
  if (a.type === "recordPayment") {
    const charge = state.charges.find((c) => c.id === a.chargeId);
    if (!charge) return state;
    const payment = makePayment(charge, a.amount, a.method);
    const fromAccount = a.method === "Education account";
    return {
      ...state,
      debits: fromAccount ? { ...state.debits, [charge.studentId]: Math.round(((state.debits[charge.studentId] ?? 0) + a.amount) * 100) / 100 } : state.debits,
      paidFromAccount: fromAccount ? [...state.paidFromAccount, { id: payment.id, studentId: charge.studentId, amount: payment.amount, on: payment.on, title: charge.title }] : state.paidFromAccount,
      charges: state.charges.map((c) => (c.id === charge.id ? { ...c, payments: [...c.payments, payment] } : c)),
    };
  }
  const all = [...state.charges];
  for (const s of a.students) {
    if (alreadyCharged(all, s.id, a.fee, a.issued)) continue;
    all.push(makeCharge(nextChargeId(all), a.fee, s, { issued: a.issued, due: a.due }));
  }
  return { ...state, charges: all };
}

const Ctx = createContext<{ state: FeeState; dispatch: Dispatch<FeeAction> } | null>(null);

export function FeeProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(feeReducer, undefined, initialFeeState);
  return <Ctx.Provider value={{ state, dispatch }}>{children}</Ctx.Provider>;
}

export function useFees() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useFees must be used inside FeeProvider");
  return c;
}

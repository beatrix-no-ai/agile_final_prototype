import { createContext, useContext, useReducer, type Dispatch, type ReactNode } from "react";
import {
  FAS_RULES, MOEFAS_FAMILIES, activateRule, refreshIncome, saveRule, type FasRule, type MoefasFamily,
} from "./moefasRules";

// ASSUMPTION: like the fee and SBFAS stores, rule edits and income retries live in memory only and
// reset on reload (no backend). App-level so edits survive navigating between FAS tabs.
export type MoefasState = { rules: FasRule[]; families: MoefasFamily[] };
export type MoefasAction =
  | { type: "save-rule"; rule: FasRule }
  | { type: "activate-rule"; id: string }
  | { type: "refresh-income"; familyId: string };

export const initialMoefasState = (): MoefasState => ({ rules: FAS_RULES, families: MOEFAS_FAMILIES });

/** Pure. save/activate manage the policy catalogue (one Active rule); refresh-income simulates a successful MyInfo retry. */
export function moefasReducer(state: MoefasState, a: MoefasAction): MoefasState {
  if (a.type === "save-rule") return { ...state, rules: saveRule(state.rules, a.rule) };
  if (a.type === "activate-rule") {
    const res = activateRule(state.rules, a.id);
    return res.ok ? { ...state, rules: res.rules } : state;
  }
  if (a.type === "refresh-income") return { ...state, families: refreshIncome(state.families, a.familyId) };
  return state;
}

const Ctx = createContext<{ state: MoefasState; dispatch: Dispatch<MoefasAction> } | null>(null);

export function MoefasProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(moefasReducer, undefined, initialMoefasState);
  return <Ctx.Provider value={{ state, dispatch }}>{children}</Ctx.Provider>;
}

export function useMoefas() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useMoefas must be used inside MoefasProvider");
  return c;
}

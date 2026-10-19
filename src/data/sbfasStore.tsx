import { createContext, useContext, useReducer, type Dispatch, type ReactNode } from "react";
import { SBFAS_APPLICATIONS, applyDecision, type Action, type Draft, type SbfasApplication } from "./sbfasApplications";
import type { SbfasRule } from "./sbfasRule";
import type { FamilyApplication } from "./familySubmission";

// ASSUMPTION: decision state lives in memory only and resets on reload (no backend), like the fee store.
// It lives at the provider level so decisions survive navigating between admin features, and so the parent
// e-Service can submit one family application that appears here as per-child SBFAS applications.
export type SbfasState = { apps: SbfasApplication[]; family: FamilyApplication | null; rules: Record<string, SbfasRule> };
export type SbfasAction =
  | { type: "decide"; id: string; action: Action; draft: Draft }
  | { type: "submitFamily"; submittedOn: string; apps: SbfasApplication[] }
  | { type: "save-rule"; rule: SbfasRule };

export const initialSbfasState = (): SbfasState => ({ apps: SBFAS_APPLICATIONS, family: null, rules: {} });

/**
 * Pure. decide records an approve/override/reject on one application (validation happens in the review modal).
 * submitFamily appends the per-child applications created by one parent submission — one submission per session;
 * a second submit while the first is undecided changes nothing. save-rule stores one school's SBFAS package
 * (tiers it offers and their rates); schools that never saved fall back to the default package.
 */
export function sbfasReducer(state: SbfasState, a: SbfasAction): SbfasState {
  if (a.type === "decide") return { ...state, apps: applyDecision(state.apps, a.id, a.action, a.draft) };
  if (a.type === "save-rule") return { ...state, rules: { ...state.rules, [a.rule.school]: a.rule } };
  if (a.type === "submitFamily") {
    if (state.family) return state;
    return { ...state, apps: [...state.apps, ...a.apps], family: { submittedOn: a.submittedOn, appIds: a.apps.map((x) => x.id) } };
  }
  return state;
}

const Ctx = createContext<{ state: SbfasState; dispatch: Dispatch<SbfasAction> } | null>(null);

export function SbfasProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(sbfasReducer, undefined, initialSbfasState);
  return <Ctx.Provider value={{ state, dispatch }}>{children}</Ctx.Provider>;
}

export function useSbfas() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useSbfas must be used inside SbfasProvider");
  return c;
}

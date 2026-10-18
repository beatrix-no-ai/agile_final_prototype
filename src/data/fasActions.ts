import { fasOf } from "../lib/fees";
import { withFas } from "../lib/studentFas";
import { fasReducer, useFas, type FasAction } from "./fasStore";
import { useFees } from "./feeStore";
import type { Band } from "./familyFas";
import { STUDENTS } from "./students";
import type { Action, Draft } from "../features/admin/fas/review";

/**
 * The two things that change a student's FAS: the school deciding an SBFAS application, and the parent submitting the family application.
 * Both go through here so the FAS store and the student's unpaid charges always change together.
 */
export function useFasActions() {
  const fas = useFas();
  const fees = useFees();

  const run = (action: FasAction, studentIds: string[]) => {
    const after = fasReducer(fas.state, action);
    fas.dispatch(action);
    for (const id of studentIds) {
      const student = STUDENTS.find((s) => s.id === id);
      if (!student) continue;
      const was = fasOf(withFas(student, fas.state));
      const now = fasOf(withFas(student, after));
      if (was?.scheme !== now?.scheme || was?.rate !== now?.rate) fees.dispatch({ type: "applyFas", studentId: id, fas: now, on: action.at.slice(0, 10) });
    }
  };

  return {
    decide(id: string, action: Action, draft: Draft) {
      const app = fas.state.apps.find((a) => a.id === id);
      if (app) run({ type: "decide", id, action, draft, at: new Date().toISOString() }, [app.studentId]);
    },
    submitFamily(studentIds: string[], band: Band) {
      run({ type: "submitFamily", studentIds, band, at: new Date().toISOString() }, studentIds);
    },
  };
}

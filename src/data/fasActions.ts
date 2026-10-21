import { fasOf } from "../lib/fees";
import { withFas } from "../lib/studentFas";
import { fasReducer, useFas, type FasAction } from "./fasStore";
import { useFees } from "./feeStore";
import type { Band } from "./familyFas";
import { useRegistry } from "./registryStore";
import { useSbfas } from "./sbfasStore";
import { levelForBands, ruleForSchool, subsidySummary, type RiskLevel } from "./sbfasRule";
import { schoolOfLevel } from "./schoolMgmt";
import type { SbfasTier } from "./sbfasApplications";
import type { Action, Draft } from "../features/admin/fas/review";

/** The parent form's per-person band mapped onto HQ's default per-capita income tiers (0-based). b3 spans tiers 4-5 (S$1,001-S$1,500); only its SBFAS tier (5) reaches a school. */
const PCI_OF_BAND: Record<string, number> = { b1: 1, b2: 2, b3: 4, b4: 5 };

/**
 * The two things that change a student's FAS: the school deciding an SBFAS application, and the parent submitting the family application.
 * Both go through here so the FAS store and the student's unpaid charges always change together.
 */
export function useFasActions() {
  const fas = useFas();
  const fees = useFees();
  const sbfas = useSbfas();
  const { state: reg } = useRegistry();

  const run = (action: FasAction, studentIds: string[]) => {
    const after = fasReducer(fas.state, action);
    fas.dispatch(action);
    for (const id of studentIds) {
      const student = reg.students.find((s) => s.id === id);
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
      // Each child is assessed against their OWN school's grouping — children may attend different schools.
      const pci = PCI_OF_BAND[band.id] ?? 4;
      const recommend: Record<string, { level: RiskLevel | null; tier: SbfasTier | null; fallback: SbfasTier; subsidy?: string }> = {};
      for (const id of studentIds) {
        const student = reg.students.find((s) => s.id === id);
        if (!student) continue;
        const rule = ruleForSchool(sbfas.state.rules, schoolOfLevel(student.level));
        const level = levelForBands(rule, null, pci);
        const tier = level ? rule.levelTiers[level] ?? null : null;
        // The explanation tells the reviewer what the suggested tier is worth — % of the fee or a fixed amount,
        // as a range across fee components when the school customises them differently.
        const tt = tier ? rule.tiers.find((x) => x.tier === tier) : undefined;
        // Nothing mapped for this band: suggest Tier 3 if the school offers it, else its last tier — never a tier it does not have.
        const fallback = (rule.tiers.find((t) => t.tier === "Tier 3") ?? rule.tiers[rule.tiers.length - 1]).tier;
        recommend[id] = {
          level, tier, fallback,
          subsidy: tt ? ` (${subsidySummary(tt)} subsidy)` : undefined,
        };
      }
      run({ type: "submitFamily", studentIds, band, at: new Date().toISOString(), recommend }, studentIds);
    },
  };
}

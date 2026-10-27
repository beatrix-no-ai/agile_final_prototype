import { createContext, useContext, useReducer, type Dispatch, type ReactNode } from "react";
import { applyDecision, isGranted, type Action, type Draft } from "../features/admin/fas/review";
import { sbfasUsage } from "../lib/budget";
import { MOEFAS_BY_LEVEL, MOEFAS_BY_TIER, MOEFAS_TIER_AMOUNT, SBFAS, SBFAS_BY_TIER, SBFAS_TIER_AMOUNT, type LevelBudget } from "./budgets";
import type { Band } from "./familyFas";
import { nextFamilyId, type FamilyApplication, type FamilyChild, type HouseholdMember, type TransportMode } from "./familyApplications";
import { attemptOf, nextSbfasId, SBFAS_APPLICATIONS, type SbfasApplication, type SbfasTier } from "./sbfasApplications";
import type { RiskLevel } from "./sbfasRule";
import { LEVELS, STUDENTS } from "./students";

// ASSUMPTION: FAS decisions and budgets live in memory only and reset on reload (no backend), like the fee store.
export type BudgetScope = "MOEFAS" | "SBFAS";
export type BudgetChange = { id: string; scope: BudgetScope; target: string; from: number; to: number; by: string; at: string };
/** MOEFAS is granted automatically by criteria; one grant per student, by student id. */
export type MoefasGrant = { tier: SbfasTier; at: string };
/** What the school's grouping suggests for one student, computed at arrival and stored static thereafter. */
export type SbfasSuggestion = { level: RiskLevel | null; tier: SbfasTier | null; fallback?: SbfasTier; subsidy?: string };
export type FasState = { apps: SbfasApplication[]; sbfasBudget: number; levels: LevelBudget[]; history: BudgetChange[]; moefas: Record<string, MoefasGrant>; familyApps: FamilyApplication[]; };
export type FasAction =
  | { type: "decide"; id: string; action: Action; draft: Draft; at: string }
  | { type: "submitFamily"; studentIds: string[]; band: Band; at: string; recommend?: Record<string, SbfasSuggestion> }
  | { type: "submitHardcopy"; studentIds: string[]; band: Band; school: string; applicant: string; contact: string; note: string; by: string; entryMode: "manual" | "ocr"; at: string; address?: string; email?: string; transportMode?: TransportMode; hasAdminIncome?: boolean; household?: HouseholdMember[]; welfareHome?: boolean; welfareLetter?: FamilyApplication["welfareLetter"]; homesOnly?: boolean; imdaHardcopy?: "yes" | "no"; declaredAt?: string; formFile?: string; recommend?: Record<string, SbfasSuggestion> }
  | { type: "submitSbfasReapply"; studentId: string; reason: string; by?: string; at: string; school?: string; applicant?: string; contact?: string; entryMode?: "manual" | "ocr" }
  | { type: "setBudget"; scope: BudgetScope; target: string; amount: number; by: string; at: string };

/** Demo paper forms a School user already scanned in, so MOE sees hardcopy rows (Source + uploaded scan) before anyone submits one. */
const SEED_HARDCOPY: FamilyApplication[] = [
  {
    id: "FAS20260005", channel: "Hardcopy", school: "Riverbank Primary School", applicant: "Benson Chua", contact: "+65 8112 9743",
    address: "Blk 412 Bedok North Ave 2, #08-115, Singapore 460412", bandLabel: "GHI Tier 1 · $0 – $2,000", homesOnly: true,
    transportMode: "Public transport", declaredAt: "2026-10-20", enteredBy: "Marcus Ong", entryMode: "ocr", formFile: "MOE-FAS-form-chua-signed.pdf",
    at: "2026-10-20T02:15:00.000Z", children: [{ studentId: "S20260009", student: "Chua Jia Hui", level: "P2", outcome: "MOEFAS granted", tier: "Tier 1" }],
  },
  {
    id: "FAS20260006", channel: "Hardcopy", school: "Riverbank Primary School", applicant: "Goh Siew Lan", contact: "+65 9023 4418",
    address: "Blk 88 Tampines St 81, #03-42, Singapore 520088", bandLabel: "GHI Tier 2 · $2,000.01 – $3,000", homesOnly: true,
    transportMode: "School bus", declaredAt: "2026-10-21", enteredBy: "Priya Nair", entryMode: "manual",
    at: "2026-10-21T06:40:00.000Z", children: [{ studentId: "S20260017", student: "Goh Yu Xuan", level: "P4", outcome: "MOEFAS granted", tier: "Tier 2" }],
  },
];

export const initialFasState = (): FasState => ({ apps: SBFAS_APPLICATIONS, sbfasBudget: SBFAS.budget, levels: MOEFAS_BY_LEVEL, history: [], moefas: {}, familyApps: [] });

// ASSUMPTION: no model scores a family-submitted application yet, so it gets a neutral mock score and tier for the school to review.
const FAMILY_EXPLANATION = "Submitted by the family through the FAS form. The income band was read from the MyInfo (SingPass) API. No fee history is available yet, so the model gives a neutral score; review the household and the student's fees before deciding.";

/** Pure. A decision is always recorded, even when the budget is already used up (overspend only warns). */
export function fasReducer(state: FasState, a: FasAction): FasState {
  if (a.type === "decide") {
    const apps = applyDecision(state.apps, a.id, a.action, a.draft).map((x) => (x.id === a.id ? { ...x, decidedAt: a.at } : x));
    return { ...state, apps };
  }
  if (a.type === "submitFamily") {
    let apps = state.apps;
    const moefas = { ...state.moefas };
    for (const id of a.studentIds) {
      const student = STUDENTS.find((s) => s.id === id);
      if (!student || moefas[id] || apps.some((x) => x.studentId === id)) continue; // one application and one grant per student
      if (a.band.tier === "MOEFAS Tier 1" || a.band.tier === "MOEFAS Tier 2") moefas[id] = { tier: a.band.tier.replace("MOEFAS ", "") as SbfasTier, at: a.at };
      // ASSUMPTION: the school has 10 working days to decide a new application.
      else if (a.band.tier === "SBFAS") {
        const rec = a.recommend?.[id];
        apps = [...apps, {
          id: nextSbfasId(apps), student: student.name, studentId: id, level: student.level,
          incomeBand: a.band.label, incomeSyncedOn: a.at.slice(0, 10), source: "MOE referral", riskScore: 50,
          recommendedTier: rec?.tier ?? rec?.fallback ?? "Tier 3", slaDays: 10,
          explanation: rec?.level
            ? `Submitted by the family through the FAS form. ${a.band.label} is grouped ${rec.level} by the school's SBFAS rules${rec.tier ? `, suggesting ${rec.tier}${rec.subsidy ?? ""}` : " but no tier is mapped to that level"} — review the household and the student's fees before deciding.`
            : FAMILY_EXPLANATION,
          status: "Pending",
        }];
      }
    }
    return { ...state, apps, moefas };
  }
  if (a.type === "submitHardcopy") {
    // A paper form a School user scanned in for a parent who cannot use the e-Service portal.
    // It goes through the SAME assessment as an online application (US-029 / AC-029): MOEFAS first,
    // and every child outside the MOEFAS bands is referred down to the school's own SBFAS queue.
    const faId = nextFamilyId(state.familyApps);
    let apps = state.apps;
    const moefas = { ...state.moefas };
    const children: FamilyChild[] = [];
    for (const id of a.studentIds) {
      const student = STUDENTS.find((s) => s.id === id);
      if (!student) continue;
      if (moefas[id] || apps.some((x) => x.studentId === id)) {
        // Cross-channel duplicate guard (AC-031): one application per student, paper or online. The
        // school user transcribes the form as the parent filled it, so the child STAYS on the family
        // record — marked covered — instead of a second application being created.
        children.push({ studentId: id, student: student.name, level: student.level, outcome: "Already covered" });
        continue;
      }
      if (a.band.tier === "MOEFAS Tier 1" || a.band.tier === "MOEFAS Tier 2") {
        const tier = a.band.tier.replace("MOEFAS ", "") as SbfasTier;
        moefas[id] = { tier, at: a.at };
        children.push({ studentId: id, student: student.name, level: student.level, outcome: "MOEFAS granted", tier });
        continue;
      }
      // ASSUMPTION (AC-024-02): a paper form outside the MOEFAS bands — including the band above both
      // schemes — is still a submitted application, so it is referred down instead of vanishing.
      const rec = a.recommend?.[id];
      apps = [...apps, {
        id: nextSbfasId(apps), student: student.name, studentId: id, level: student.level,
        incomeBand: a.band.label, source: "MOE referral", familyAppId: faId, enteredBy: a.by, riskScore: 50,
        recommendedTier: rec?.tier ?? rec?.fallback ?? "Tier 3", slaDays: 10,
        explanation: `Paper form ${a.entryMode === "ocr" ? "scanned and read by OCR, then checked" : "keyed in"} by ${a.by} for ${a.applicant}${a.note.trim() ? ` — note on the form: ${a.note.trim()}` : ""}. MOEFAS was assessed first and not granted for this band, so the case is referred to the school. The income band comes from the paper form (no MyInfo sync); review the household and the student's fees before deciding.`,
        status: "Pending",
      }];
      children.push({ studentId: id, student: student.name, level: student.level, outcome: "MOEFAS not granted" });
    }
    if (!children.some((c) => c.outcome !== "Already covered")) return state; // nothing new: every child already had an application or a grant
    const familyApp: FamilyApplication = {
      id: faId, channel: "Hardcopy", school: a.school, applicant: a.applicant, contact: a.contact, bandLabel: a.band.label,
      address: a.address || undefined, email: a.email || undefined, transportMode: a.transportMode,
      hasAdminIncome: a.hasAdminIncome, household: a.hasAdminIncome ? a.household : undefined,
      welfareHome: a.welfareHome, welfareLetter: a.welfareHome ? a.welfareLetter : undefined,
      homesOnly: a.homesOnly || undefined,
      imdaHardcopy: a.imdaHardcopy, declaredAt: a.declaredAt, note: a.note.trim() || undefined,
      enteredBy: a.by, entryMode: a.entryMode, formFile: a.formFile, at: a.at, children,
    };
    return { ...state, apps, moefas, familyApps: [familyApp, ...state.familyApps] };
  }
  if (a.type === "submitSbfasReapply") {
    // ASSUMPTION (client pending): a new SBFAS request does NOT re-run the MOEFAS assessment — it goes
    // straight to the school queue. Only allowed after a FINAL rejection: nothing pending, no MOEFAS
    // grant, a previous rejection to supersede, and a reason saying what changed.
    const student = STUDENTS.find((s) => s.id === a.studentId);
    const mine = state.apps.filter((x) => x.studentId === a.studentId);
    if (!student || state.moefas[a.studentId] || mine.some((x) => x.status === "Pending") || !a.reason.trim()) return state;
    const rejected = mine.filter((x) => x.status === "Rejected").sort((x, y) => attemptOf(y) - attemptOf(x))[0];
    if (!rejected) return state;
    // Hardcopy flow 2 (the form names a school): the paper form joins the hardcopy history as its own
    // family record, and the new request points at it. The portal re-apply (no school) creates no record.
    const faId = nextFamilyId(state.familyApps);
    const familyApp = a.school ? [{
      id: faId, channel: "Hardcopy" as const, school: a.school,
      applicant: a.applicant?.trim() || "—", contact: a.contact ?? "",
      bandLabel: rejected.incomeBand, note: a.reason.trim(),
      enteredBy: a.by ?? "School user", entryMode: a.entryMode ?? "manual", at: a.at,
      children: [{ studentId: student.id, student: student.name, level: student.level, outcome: "New SBFAS request" as const }],
    }] : [];
    return {
      ...state,
      apps: [...state.apps, {
        id: nextSbfasId(state.apps), student: student.name, studentId: a.studentId, level: student.level,
        incomeBand: rejected.incomeBand, householdBand: rejected.householdBand, incomeSyncedOn: rejected.incomeSyncedOn,
        source: "Resubmission", familyAppId: a.school ? faId : rejected.familyAppId, attemptNo: attemptOf(rejected) + 1,
        supersedesId: rejected.id, reapplyReason: a.reason.trim(), enteredBy: a.by, riskScore: 50,
        recommendedTier: rejected.recommendedTier, slaDays: 10,
        explanation: `New request after SBFAS application ${rejected.id} was rejected${a.by ? ` — handed in at the school by ${a.by}` : " — submitted through the parent portal"}. What changed: ${a.reason.trim()}. The household bands are carried over from the earlier request; review them before deciding.`,
        status: "Pending",
      }],
      familyApps: [...familyApp, ...state.familyApps],
    };
  }
  const from = a.scope === "SBFAS" ? state.sbfasBudget : (state.levels.find((l) => l.id === a.target)?.budget ?? 0);
  const entry: BudgetChange = { id: `BC-${state.history.length + 1}`, scope: a.scope, target: a.target, from, to: a.amount, by: a.by, at: a.at };
  return {
    ...state,
    sbfasBudget: a.scope === "SBFAS" ? a.amount : state.sbfasBudget,
    levels: a.scope === "MOEFAS" ? state.levels.map((l) => (l.id === a.target ? { ...l, budget: a.amount } : l)) : state.levels,
    history: [entry, ...state.history],
  };
}

const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);

/** Seeded plus live SBFAS grants per tier and class (P1 ... Sec 4), including tiers the school added beyond the seeded four. */
function sbfasByTier(apps: SbfasApplication[]) {
  const live = Object.fromEntries(LEVELS.map((c) => [c, sbfasUsage(apps.filter((a) => a.level === c)).byTier]));
  const labels = [...new Set([...SBFAS_BY_TIER.map((t) => t.label), ...LEVELS.flatMap((c) => Object.keys(live[c]))])];
  return labels.map((label) => {
    const seed = SBFAS_BY_TIER.find((t) => t.label === label);
    const by = Object.fromEntries(LEVELS.map((c, i) => [c, (seed?.byClass[i] ?? 0) + (live[c][label] ?? 0)]));
    return { label, by, value: sum(Object.values(by)) };
  });
}

/** School view. The seeded figures are what was granted before this queue; live decisions add on top. */
export function selectSbfas(s: FasState) {
  const live = sbfasUsage(s.apps);
  const used = SBFAS.absorbed + live.amount;
  return {
    budget: s.sbfasBudget,
    used,
    remaining: s.sbfasBudget - used,
    helped: sum(SBFAS_BY_TIER.flatMap((t) => t.byClass)) + live.count,
    byTier: sbfasByTier(s.apps),
  };
}

/** HQ view. The seeded spend is what was granted before; MOEFAS granted through parent applications adds on top, by the child's level. */
export function selectMoefas(s: FasState) {
  const grants = Object.entries(s.moefas).flatMap(([id, g]) => {
    const student = STUDENTS.find((x) => x.id === id);
    return student ? [{ g, cls: student.level as string, level: student.level.startsWith("P") ? "Primary" : "Secondary" }] : [];
  });
  const levels = s.levels.map((l) => {
    const mine = grants.filter((x) => x.level === l.id);
    return { ...l, used: l.used + sum(mine.map((x) => MOEFAS_TIER_AMOUNT[x.g.tier] ?? 0)), beneficiaries: l.beneficiaries + mine.length };
  });
  const budget = sum(levels.map((l) => l.budget));
  const used = sum(levels.map((l) => l.used));
  return {
    levels, budget, used, remaining: budget - used, helped: sum(levels.map((l) => l.beneficiaries)),
    byTier: MOEFAS_BY_TIER.map((t) => {
      const by = Object.fromEntries(LEVELS.map((c, i) => [c, t.byClass[i] + grants.filter((x) => x.cls === c && x.g.tier === t.label).length]));
      return { label: t.label, by, value: sum(Object.values(by)) };
    }),
  };
}

/** The student's most recent SBFAS application (highest attempt): the one every outcome reads from. */
export const latestAppFor = (apps: SbfasApplication[], studentId: string): SbfasApplication | undefined =>
  apps.filter((x) => x.studentId === studentId).sort((x, y) => attemptOf(y) - attemptOf(x))[0];

/** What the parent is told about one child: the scheme, whether it is granted yet, and why not if refused. null = no application. */
export type ChildFas = { scheme: "MOEFAS" | "SBFAS"; status: "Granted" | "Awaiting school decision" | "Not granted"; tier?: string; reason?: string };
export function selectChildFas(s: FasState, studentId: string): ChildFas | null {
  const grant = s.moefas[studentId];
  if (grant) return { scheme: "MOEFAS", status: "Granted", tier: grant.tier };
  const a = latestAppFor(s.apps, studentId);
  if (!a) return null;
  if (a.status === "Approved" || a.status === "Overridden") return { scheme: "SBFAS", status: "Granted", tier: a.sbfasTier };
  if (a.status === "Rejected") return { scheme: "SBFAS", status: "Not granted", reason: a.justification };
  return { scheme: "SBFAS", status: "Awaiting school decision" };
}

/** The school's latest SBFAS grants, newest first. Only decided, granted applications appear. */
export function selectRecentGrants(s: FasState, limit = 5) {
  return s.apps
    .filter((a) => isGranted(a) && a.sbfasTier && a.decidedAt)
    .sort((x, y) => y.decidedAt!.localeCompare(x.decidedAt!))
    .slice(0, limit)
    .map((a) => ({ id: a.id, studentId: a.studentId, student: a.student, level: a.level, tier: a.sbfasTier!, amount: SBFAS_TIER_AMOUNT[a.sbfasTier!] ?? 0, at: a.decidedAt! }));
}

/** Same shape the dashboard Budget Usage card always used. */
export function selectBudgets(s: FasState) {
  const m = selectMoefas(s);
  const b = selectSbfas(s);
  return [
    { name: "MOEFAS", owner: "MOE HQ", used: m.used, budget: m.budget },
    { name: "SBFAS", owner: "School", used: b.used, budget: b.budget },
  ];
}

const Ctx = createContext<{ state: FasState; dispatch: Dispatch<FasAction> } | null>(null);

export function FasProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(fasReducer, undefined, () => ({ ...initialFasState(), familyApps: SEED_HARDCOPY }));
  return <Ctx.Provider value={{ state, dispatch }}>{children}</Ctx.Provider>;
}

export function useFas() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useFas must be used inside FasProvider");
  return c;
}

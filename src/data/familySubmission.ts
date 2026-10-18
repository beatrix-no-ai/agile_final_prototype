// R4 parent story: one family-level application, decided per child by the school.
// Pure helpers shared by the parent e-Service (submission + status) and the admin SBFAS store.
import { children, profile } from "./parent";
import { BANDS } from "./familyFas";
import { nextSbfasId, type SbfasApplication } from "./sbfasApplications";
import { STUDENTS } from "./students";

/** The family's session record: which per-child applications one submission created. */
export type FamilyApplication = { submittedOn: string; appIds: string[] };

// Parent-side per-person bands → the admin queue's per-capita band label. Only the SBFAS band routes to the school.
const ADMIN_BAND: Record<string, string> = {
  b1: "S$451 - S$700",
  b2: "S$701 - S$1,000",
  b3: "S$1,001 - S$1,500",
};
const RISK_BY_BAND: Record<string, number> = { b1: 85, b2: 60, b3: 42 };

/**
 * Per-child SBFAS applications for one family submission. Children in a MOEFAS band are granted at MOE level and
 * never enter the school queue (BR10b: MOE FAS is assessed first); only the SBFAS band creates queue applications.
 */
export function buildFamilyApps(base: Pick<SbfasApplication, "id">[], bandId: string, syncedOn: string, note: string): SbfasApplication[] {
  const band = BANDS.find((b) => b.id === bandId);
  if (!band || band.tier !== "SBFAS") return [];
  const apps = [...base];
  const out: SbfasApplication[] = [];
  for (const child of children) {
    const s = STUDENTS.find((x) => x.name === child.name);
    if (!s) continue;
    const app: SbfasApplication = {
      id: nextSbfasId(apps),
      student: s.name,
      studentId: s.id,
      level: s.level,
      incomeBand: ADMIN_BAND[bandId],
      householdBand: "S$2,501 - S$4,000",
      incomeSyncedOn: syncedOn,
      riskScore: RISK_BY_BAND[bandId],
      recommendedTier: "Tier 3",
      slaDays: 10,
      explanation: `Family application submitted by ${profile.name} via the e-Service portal${note.trim() ? ` — note: ${note.trim()}` : ""}. Per-capita income is above the MOE FAS bands, so the school decides on SBFAS.`,
      status: "Pending",
    };
    apps.push(app);
    out.push(app);
  }
  return out;
}

export type FamilyOutcome =
  | { phase: "not-submitted" }
  | { phase: "pending" | "approved" | "not-approved"; id: string; submittedOn: string; decided: number; total: number; granted: number };

/** Card + tracker status from the school's decisions: any grant approves the family application. */
export function familyOutcome(apps: SbfasApplication[], family: FamilyApplication | null): FamilyOutcome {
  if (!family) return { phase: "not-submitted" };
  const mine = family.appIds.map((id) => apps.find((a) => a.id === id)).filter((a): a is SbfasApplication => Boolean(a));
  const granted = mine.filter((a) => a.status === "Approved" || a.status === "Overridden");
  const decided = mine.filter((a) => a.status !== "Pending");
  const common = { id: family.appIds[0], submittedOn: family.submittedOn, decided: decided.length, total: mine.length, granted: granted.length };
  if (mine.length > 0 && decided.length === mine.length) return { phase: granted.length > 0 ? "approved" : "not-approved", ...common };
  return { phase: "pending", ...common };
}

/** Review phase for trackerSteps: nothing submitted yet, waiting on the school, or all children decided. */
export const reviewPhase = (o: FamilyOutcome): "not-submitted" | "pending" | "decided" =>
  o.phase === "not-submitted" ? "not-submitted" : o.phase === "pending" ? "pending" : "decided";

import type { FasApplication, FasStatus, FasTier } from "../../../data/fasApplications";

export type Action = "approve" | "override" | "reject";
export type Draft = { justification: string; tier: FasTier };
export type DecisionError = { field: "justification" | "tier"; message: string };

const STATUS: Record<Action, FasStatus> = { approve: "Approved", override: "Overridden", reject: "Rejected" };

/** Pending first, then highest risk score first. Does not mutate. */
export function sortQueue(apps: FasApplication[]): FasApplication[] {
  const pending = (a: FasApplication) => (a.status === "Pending" ? 0 : 1);
  return [...apps].sort((a, b) => pending(a) - pending(b) || b.riskScore - a.riskScore);
}

/** A decided application counts as granted when SBFAS was approved or overridden to a tier, declined when rejected. */
export const isGranted = (a: Pick<FasApplication, "status">) => a.status === "Approved" || a.status === "Overridden";
export const isDeclined = (a: Pick<FasApplication, "status">) => a.status === "Rejected";

/** Review Focus 3: an override needs a non-blank justification and a tier different from the recommendation. */
export function validateDecision(action: Action, draft: Draft, recommended: FasTier): DecisionError | null {
  if (action !== "override") return null;
  if (!draft.justification.trim()) return { field: "justification", message: "Enter a justification to override the AI recommendation." };
  if (draft.tier === recommended) return { field: "tier", message: "Choose a tier different from the recommendation, or approve instead." };
  return null;
}

export function applyDecision(apps: FasApplication[], id: string, action: Action, draft: Draft): FasApplication[] {
  return apps.map((a) =>
    a.id !== id
      ? a
      : {
          ...a,
          status: STATUS[action],
          finalTier: action === "reject" ? undefined : action === "override" ? draft.tier : a.recommendedTier,
          justification: draft.justification.trim() || undefined,
        },
  );
}

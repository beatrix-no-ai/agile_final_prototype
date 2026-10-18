import type { SbfasApplication, SbfasStatus, SbfasTier } from "../../../data/sbfasApplications";

export type Action = "approve" | "reject";
/** `tier` is "" until the school picks one. */
export type Draft = { justification: string; tier: SbfasTier | "" };
export type DecisionError = { field: "justification" | "tier"; message: string };

const STATUS: Record<Action, SbfasStatus> = { approve: "Approved", reject: "Rejected" };

/** Pending first, then the closest decision deadline first. Does not mutate. */
export function sortQueue(apps: SbfasApplication[]): SbfasApplication[] {
  const pending = (a: SbfasApplication) => (a.status === "Pending" ? 0 : 1);
  return [...apps].sort((a, b) => pending(a) - pending(b) || a.slaDays - b.slaDays);
}

/** A decided application counts as granted when SBFAS was approved at a tier, declined when rejected. */
export const isGranted = (a: Pick<SbfasApplication, "status">) => a.status === "Approved";
export const isDeclined = (a: Pick<SbfasApplication, "status">) => a.status === "Rejected";

/** Approving needs a tier; rejecting needs a reason the parent can be told. */
export function validateDecision(action: Action, draft: Draft): DecisionError | null {
  if (action === "approve" && !draft.tier) return { field: "tier", message: "Choose a tier to approve this application." };
  if (action === "reject" && !draft.justification.trim()) return { field: "justification", message: "Enter a reason for rejecting this application." };
  return null;
}

export function applyDecision(apps: SbfasApplication[], id: string, action: Action, draft: Draft): SbfasApplication[] {
  return apps.map((a) =>
    a.id !== id
      ? a
      : {
          ...a,
          status: STATUS[action],
          sbfasTier: action === "reject" || !draft.tier ? undefined : draft.tier,
          justification: draft.justification.trim() || undefined,
        },
  );
}

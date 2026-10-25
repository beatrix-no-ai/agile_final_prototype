import { latestAppFor, type FasState } from "../data/fasStore";
import type { Student } from "../data/students";

/**
 * The student as the FAS decisions see it. A MOEFAS grant makes the record MOEFAS Approved. When the student has an SBFAS
 * application, its status and tier are the truth (Pending, Approved at a tier, or Rejected). No application = left as it is.
 */
export function withFas(s: Student, fas: Pick<FasState, "apps" | "moefas">): Student {
  const a = latestAppFor(fas.apps, s.id);
  const granted = a?.status === "Approved" || a?.status === "Overridden"; // an override is still a grant, at the school's tier
  const sbfas = a ? { ...s, sbfas: granted ? ("Approved" as const) : a.status as "Pending" | "Rejected", sbfasTier: granted ? a.sbfasTier : undefined } : s;
  return fas.moefas[s.id] ? { ...sbfas, moefas: "Approved" } : sbfas;
}

/** What moved each student's Education Account since the start, by student id: paid out (fees) and paid in (MOE top-ups). */
export type Movements = { debits: Record<string, number>; credits: Record<string, number> };

/**
 * The student's Education Account balance after the top-ups paid in and the fees paid out since the start. Safe to apply twice: records are handed
 * from page to page, so the balance it started from is kept (baseBalance) and the debits are always taken off that.
 */
export function withBalance(s: Student, m: Movements): Student {
  const base = s.baseBalance ?? s.balance;
  return { ...s, baseBalance: base, balance: Math.round((base + (m.credits[s.id] ?? 0) - (m.debits[s.id] ?? 0)) * 100) / 100 };
}

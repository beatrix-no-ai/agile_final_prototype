import type { FasState } from "../data/fasStore";
import type { Student } from "../data/students";

/**
 * The student as the FAS decisions see it. A MOEFAS grant makes the record MOEFAS Approved. When the student has an SBFAS
 * application, its status and tier are the truth (Pending, Approved at a tier, or Rejected). No application = left as it is.
 */
export function withFas(s: Student, fas: Pick<FasState, "apps" | "moefas">): Student {
  const a = fas.apps.find((x) => x.studentId === s.id);
  const sbfas = a ? { ...s, sbfas: a.status, sbfasTier: a.status === "Approved" ? a.sbfasTier : undefined } : s;
  return fas.moefas[s.id] ? { ...sbfas, moefas: "Approved" } : sbfas;
}

/**
 * The student's Education Account balance after what has been paid out of it since the start. Safe to apply twice: records are handed
 * from page to page, so the balance it started from is kept (baseBalance) and the debits are always taken off that.
 */
export function withBalance(s: Student, debits: Record<string, number>): Student {
  const base = s.baseBalance ?? s.balance;
  return { ...s, baseBalance: base, balance: Math.round((base - (debits[s.id] ?? 0)) * 100) / 100 };
}

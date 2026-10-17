import { schoolOfLevel } from "../data/schoolMgmt";
import { FEE_TYPES, TERM_DUE, type Charge, type ChargeComponent, type FasScheme, type FeeComponent, type FeeType } from "../data/fees";
import { STUDENTS, type Student } from "../data/students";

/** Mock "today" for issue and paid dates. */
export const TODAY = "2026-10-12";

const cents = (n: number) => Math.round(n * 100);
const sum = (xs: number[]) => xs.reduce((t, x) => t + cents(x), 0) / 100;

export const feeOf = (c: { components: FeeComponent[] }) => sum(c.components.map((x) => x.amount));
export const subsidyOf = (c: { components: ChargeComponent[] }) => sum(c.components.map((x) => Math.min(x.subsidy ?? 0, x.amount)));
export const payableOf = (c: { components: ChargeComponent[] }) => sum(c.components.map((x) => x.amount - Math.min(x.subsidy ?? 0, x.amount)));

// ASSUMPTION: flat rates per scheme (real per-component tiers are Sprint 2). MOEFAS subsidises more than SBFAS.
export const MOEFAS_RATE = 0.5;
export const SBFAS_RATE = 0.2;

/** The single scheme whose subsidy applies to this student's charges: MOEFAS takes precedence over SBFAS — a student never receives both. */
export function fasOf(s: Pick<Student, "moefas" | "sbfas">): { scheme: FasScheme; rate: number } | null {
  if (s.moefas === "Approved") return { scheme: "MOEFAS", rate: MOEFAS_RATE };
  if (s.sbfas === "Approved") return { scheme: "SBFAS", rate: SBFAS_RATE };
  return null;
}

export const subsidyRate = (s: Pick<Student, "moefas" | "sbfas">) => fasOf(s)?.rate ?? 0;

export const nextChargeId = (rows: { id: string }[]) => `CH-${rows.reduce((m, r) => Math.max(m, Number(r.id.replace(/\D/g, "")) || 0), 1000) + 1}`;
export const nextFeeTypeId = (rows: { id: string }[]) => `FT-${String(rows.reduce((m, r) => Math.max(m, Number(r.id.replace(/\D/g, "")) || 0), 0) + 1).padStart(2, "0")}`;

export const makeCharge = (id: string, ft: FeeType, s: Student, term: string): Charge => {
  const fas = fasOf(s);
  return {
    id, studentId: s.id, ftId: ft.id, title: ft.name, term, issued: TODAY, due: TERM_DUE[term] ?? "2026-11-13", status: "outstanding",
    fas: fas?.scheme,
    components: ft.components.map((c) => ({ name: c.name, amount: c.amount, subsidy: Math.round(c.amount * (fas?.rate ?? 0) * 100) / 100 })),
  };
};

/** A student already holds a charge of this fee type for this term. */
export const alreadyCharged = (charges: Charge[], studentId: string, ft: FeeType, term: string) =>
  charges.some((c) => c.studentId === studentId && c.ftId === ft.id && c.term === term);

/** Students of one class in one school. */
export const studentsOfClass = (school: string, klass: string) => STUDENTS.filter((s) => s.class === klass && schoolOfLevel(s.level) === school);

/** Mock history: Term 3 paid (every 7th student overdue), Term 4 outstanding, from each school's all-level fee type. */
export function seedCharges(): Charge[] {
  const out: Charge[] = [];
  STUDENTS.forEach((s, i) => {
    const ft = FEE_TYPES.find((f) => f.school === schoolOfLevel(s.level) && !f.level);
    if (!ft) return;
    const t3 = makeCharge(nextChargeId(out), ft, s, "2026 Term 3");
    out.push(i % 7 === 3 ? { ...t3, issued: "2026-08-20", status: "overdue" } : { ...t3, issued: "2026-08-20", status: "paid", paidOn: "2026-09-05" });
    out.push(makeCharge(nextChargeId(out), ft, s, "2026 Term 4"));
    const sup = FEE_TYPES.find((f) => f.school === ft.school && f.level === s.level);   // level-specific supplementary fee
    if (sup) {
      const c = makeCharge(nextChargeId(out), sup, s, "2026 Term 4");
      out.push(i % 2 ? { ...c, status: "paid", paidOn: "2026-10-05" } : c);
    }
  });
  return out;
}

export type Agg = { fee: number; subsidy: number; payable: number; collected: number; outstanding: number; overdue: number; unpaid: number; paid: number };
export function aggregate(rows: Charge[]): Agg {
  const paid = rows.filter((c) => c.status === "paid"), open = rows.filter((c) => c.status !== "paid");
  return {
    fee: sum(rows.map(feeOf)), subsidy: sum(rows.map(subsidyOf)), payable: sum(rows.map(payableOf)),
    collected: sum(paid.map(payableOf)), outstanding: sum(open.map(payableOf)),
    overdue: rows.filter((c) => c.status === "overdue").length, unpaid: open.length, paid: paid.length,
  };
}

export type FeeDraft = { name: string; level: string; components: { name: string; amount: string; on: boolean }[] };
export type FeeErrors = { name?: string; components?: string; rows: Record<number, string> };

/** Unticked rows are ignored; each included row needs a name and an amount above 0 (max 2 decimals). `others` = the school's other fee types. */
export function validateFeeType(d: FeeDraft, others: FeeType[]): { errors: FeeErrors; components: FeeComponent[] } {
  const errors: FeeErrors = { rows: {} };
  const norm = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();
  if (!norm(d.name)) errors.name = "Enter a fee type name.";
  else if (others.some((f) => norm(f.name) === norm(d.name))) errors.name = "This school already has a fee type with this name.";
  const components: FeeComponent[] = [];
  d.components.forEach((c, i) => {
    if (!c.on) return;
    const nm = c.name.trim();
    if (!nm || !/^\d{1,9}(\.\d{1,2})?$/.test(c.amount.trim()) || Number(c.amount) <= 0) errors.rows[i] = "Enter a name and an amount above 0 (max 2 decimals).";
    else components.push({ name: nm, amount: Number(c.amount) });
  });
  if (!components.length && !Object.keys(errors.rows).length) errors.components = "Include at least one component.";
  return { errors, components };
}
export const feeDraftOk = (e: FeeErrors) => !e.name && !e.components && !Object.keys(e.rows).length;

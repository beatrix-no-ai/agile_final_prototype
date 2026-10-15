import type { Account, FundRule, Target, Transaction } from "../data/topup";

export type TopUpRule = {
  ageMin: number;
  ageMax: number;
  citizenOnly: boolean;
  enrolledOnly: boolean;
  balanceMin: number;
  balanceMax: number;
};

/** count * amount in integer cents, so 3 x S$0.10 is exactly S$0.30. `amount` must already be at most 2 decimals (see parseAmount). */
export function totalFunds(count: number, amount: number): number {
  return (Math.round(amount * 100) * count) / 100;
}

/** Accounts matching every rule. Age and balance bounds are inclusive; flags only exclude when on. */
export function eligibleAccounts(rule: TopUpRule, accounts: Account[]): Account[] {
  return accounts.filter(
    (a) =>
      a.age >= rule.ageMin &&
      a.age <= rule.ageMax &&
      (!rule.citizenOnly || a.citizen) &&
      (!rule.enrolledOnly || a.enrolled) &&
      a.balance >= rule.balanceMin &&
      a.balance <= rule.balanceMax,
  );
}

/** Restricted view of a balance (HQ never sees the exact figure on this screen). */
export const balanceBand = (n: number) => (n < 100 ? "Below S$100" : n < 300 ? "S$100 to under S$300" : n < 500 ? "S$300 to under S$500" : "S$500 and above");

export type RuleCriteria = Pick<FundRule, "ageMin" | "ageMax" | "minBalance" | "maxBalance" | "schooling" | "schools">;

/** Active accounts matching every criterion: age inclusive, balance in [min, max), schooling status, school (empty = all). */
export function eligibleForRule(rule: RuleCriteria, accounts: Account[]): Account[] {
  return accounts.filter(
    (a) =>
      a.status === "Active" &&
      a.age >= rule.ageMin && a.age <= rule.ageMax &&
      a.balance >= rule.minBalance && a.balance < rule.maxBalance &&
      rule.schooling === a.schooling &&
      (!rule.schools.length || rule.schools.includes(a.school)),
  );
}

/** "TUR" + five digits, continuing from the highest existing rule (first is TUR01001). */
export function nextRuleId(rules: { id: string }[]): string {
  return `TUR${String(rules.reduce((m, r) => Math.max(m, Number(r.id.replace(/\D/g, "")) || 0), 1000) + 1).padStart(5, "0")}`;
}

/** "TUT" + DDMMYY of the execution date. Same-day transactions share a code (as in the team prototype). */
export function transactionCode(date: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  return m ? `TUT${m[3]}${m[2]}${m[1].slice(-2)}` : "TUT000000";
}

const ddmmyy = (date: string) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date); return m ? m[3] + m[2] + m[1].slice(-2) : "000000"; };

/** Per-account outcomes: stored targets, else demo ones built from `accounts` so counts match `t.accounts`. */
export function allocationsOf(t: Transaction, accounts: Account[]): Target[] {
  if (t.targets) return t.targets;
  return Array.from({ length: t.accounts }, (_, n) => {
    const a = accounts[(n + t.ref.length * 3) % accounts.length];
    const failed = t.status === "Failed" || (t.status === "Partial Success" && n % 5 === 0);
    return { student: a.name, account: a.id, status: t.status === "Pending" ? "Pending" : failed ? "Failed" : "Success", ...(failed ? { reason: "Education Account inactive at execution" } : {}) } as Target;
  });
}

/** Display IDs, index-aligned with `rows` (newest first). Top-up ID = SIN|BAT + DDMMYY + 3-digit daily seq;
 *  account txid = TUT + DDMMYY + 5-digit daily seq. Prototype only: production allocates these atomically in the backend. */
export function ledgerIds(rows: Transaction[], accounts: Account[]) {
  const seq = new Map<string, number>();
  const next = (prefix: string, date: string, digits: number) => { const k = `${prefix}|${date}`; const n = (seq.get(k) ?? 0) + 1; seq.set(k, n); return prefix + ddmmyy(date) + String(n).padStart(digits, "0"); };
  const out = rows.map(() => ({ id: "", targets: [] as Target[] }));
  for (let i = rows.length - 1; i >= 0; i--) {
    const t = rows[i];
    out[i].id = next(t.type === "Batch" ? "BAT" : "SIN", t.date, 3);
    out[i].targets = allocationsOf(t, accounts).map((a) => (a.status === "Pending" ? a : { ...a, txid: a.txid ?? next("TUT", t.date, 5) }));
  }
  return out;
}

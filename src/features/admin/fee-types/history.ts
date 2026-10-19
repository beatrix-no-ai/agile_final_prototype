import { MASTER, type Charge, type FeeType } from "../../../data/fees";

export type BillKind = "moe" | "school";
/** One issuance round: one fee type issued on one date. Rounds are pure by construction — MOE Bills and School Bills are never generated together, so a round belongs to exactly one source. */
export type Round = { key: string; kind: BillKind; issued: string; due: string; title: string; ftId: string; rows: Charge[] };

/**
 * Group the school's charges into rounds, tagged with their bill source.
 * A School Bill round counts only when the fee type belongs to this school; a MOE Bill (master)
 * round counts when the charged student belongs to this school.
 */
export function historyRounds(charges: Charge[], types: FeeType[], school: string, inSchool: (studentId: string) => boolean): Round[] {
  const byId = new Map(types.map((t) => [t.id, t]));
  const rounds = new Map<string, Round>();
  for (const c of charges) {
    const t = byId.get(c.ftId);
    if (!t) continue;
    const kind: BillKind = t.school === MASTER ? "moe" : "school";
    if (kind === "school" && t.school !== school) continue;
    if (kind === "moe" && !inSchool(c.studentId)) continue;
    const key = `${c.issued}|${c.ftId}|${kind}`;
    const r = rounds.get(key) ?? { key, kind, issued: c.issued, due: c.due, title: c.title, ftId: c.ftId, rows: [] };
    r.rows.push(c);
    rounds.set(key, r);
  }
  return [...rounds.values()].sort((a, b) => b.issued.localeCompare(a.issued));
}

/** Apply the search box, the issued-date range and the bill-kind filter. `textOf` lets the caller fold extra fields (e.g. levels) into the searchable text. */
export function filterRounds(rounds: Round[], f: { q?: string; from?: string; to?: string; kind?: "" | BillKind; textOf?: (r: Round) => string }): Round[] {
  const q = (f.q ?? "").trim().toLowerCase();
  return rounds.filter((r) => {
    if (f.kind && r.kind !== f.kind) return false;
    if (f.from && r.issued < f.from) return false;
    if (f.to && r.issued > f.to) return false;
    if (q) {
      const text = (f.textOf ? f.textOf(r) : `${r.title} ${r.issued}`).toLowerCase();
      if (!text.includes(q)) return false;
    }
    return true;
  });
}

/** Fuzzy search for small lists (mock scale): every token of the query must match some field.
 *  A token matches a field when it appears as a substring, or sits within a small edit distance
 *  of one of the field's words — so "tannya" still finds "Tannya Lim", "ju hi" finds "Tan Ji Hui". */
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

const editDistance = (a: string, b: string) => {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
};

/** Short tokens must be exact words; longer ones tolerate 1–2 edits. */
const maxDist = (tok: string) => (tok.length <= 2 ? 0 : tok.length <= 5 ? 1 : 2);

const tokenMatches = (tok: string, field: string) => {
  const f = norm(field);
  if (!f) return false;
  if (f.includes(tok)) return true;
  return f.split(" ").some((w) => w.length > 0 && editDistance(tok, w) <= maxDist(tok));
};

/** True when every token of the query matches at least one field (AND across tokens, OR across fields). */
export function fuzzyMatch(query: string, fields: string[]): boolean {
  const toks = norm(query).split(" ").filter(Boolean);
  if (!toks.length) return true;
  return toks.every((t) => fields.some((f) => tokenMatches(t, f)));
}

const full = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function formatSGD(n: number, opts?: { compact?: boolean }): string {
  if (opts?.compact) {
    const a = Math.abs(n);
    if (a >= 1e6) return `S$${(n / 1e6).toFixed(2)}M`;
    if (a >= 1e3) return `S$${+(n / 1e3).toFixed(1)}K`; // unary + trims trailing zeros
    return `S$${+n.toFixed(2)}`;
  }
  return `S$${full.format(n)}`;
}

/** "2026-09-18" -> "18 Sep 2026". Parsed as a local calendar date so it never shifts a day. Anything unparsable is returned as-is. */
export function formatDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  return d.toLocaleDateString("en-SG", { day: "numeric", month: "short", year: "numeric" });
}

/** "2026-10-21T08:03:00.000Z" -> "21 Oct 2026, 16:03" in local time. Anything unparsable is returned as-is. */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.toLocaleDateString("en-SG", { day: "numeric", month: "short", year: "numeric" })}, ${d.toLocaleTimeString("en-SG", { hour: "2-digit", minute: "2-digit", hour12: false })}`;
}

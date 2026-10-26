/** Horizontal bars, one row per item, so long lists (e.g. 14 tiers) stay readable. */
export function BarChart({
  data,
  format = (n) => n.toLocaleString("en-US"),
}: {
  data: { label: string; value: number }[];
  format?: (n: number) => string;
}) {
  const vals = data.map((d) => (Number.isFinite(d.value) ? Math.max(0, d.value) : 0));
  const max = Math.max(...vals) || 1; // || 1 only guards the all-zero case
  if (data.length === 0) return <p className="text-sm text-on-surface-variant">No data</p>;
  return (
    <ul className="space-y-2">
      {data.map((d, i) => (
        <li key={d.label} className="grid grid-cols-[5rem_1fr_4rem] items-center gap-3 text-[13px]">
          <span className="truncate text-on-surface-variant">{d.label}</span>
          <div className="h-3 rounded-full bg-surface-container" role="img" aria-label={`${d.label} ${format(vals[i])}`}>
            <div className="h-full rounded-full bg-primary" style={{ width: `${(vals[i] / max) * 100}%` }} />
          </div>
          <span className="text-right font-medium tabular-nums">{format(vals[i])}</span>
        </li>
      ))}
    </ul>
  );
}

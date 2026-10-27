/** Horizontal bars, one row per item, so long lists (e.g. 14 ranks) stay readable. `total` draws a grey full bar behind the red value. */
export function BarChart({
  data,
  format = (n) => n.toLocaleString("en-US"),
}: {
  data: { label: string; value: number; total?: number }[];
  format?: (n: number) => string;
}) {
  const clean = (n?: number) => (n !== undefined && Number.isFinite(n) ? Math.max(0, n) : 0);
  const max = Math.max(...data.map((d) => Math.max(clean(d.value), clean(d.total)))) || 1; // || 1 only guards the all-zero case
  if (data.length === 0) return <p className="text-sm text-on-surface-variant">No data</p>;
  return (
    <ul className="space-y-2">
      {data.map((d) => {
        const v = clean(d.value);
        const label = d.total === undefined ? format(v) : `${format(v)} / ${format(clean(d.total))}`;
        return (
          <li key={d.label} className="grid grid-cols-[5rem_1fr_5rem] items-center gap-3 text-[13px]">
            <span className="truncate text-on-surface-variant">{d.label}</span>
            <div className="relative h-3 rounded-full bg-surface-container" role="img" aria-label={`${d.label} ${label}`}>
              {d.total !== undefined && <div className="absolute inset-y-0 left-0 rounded-full bg-outline/40" style={{ width: `${(clean(d.total) / max) * 100}%` }} />}
              <div className="absolute inset-y-0 left-0 rounded-full bg-primary" style={{ width: `${(v / max) * 100}%` }} />
            </div>
            <span className="text-right font-medium tabular-nums">{label}</span>
          </li>
        );
      })}
    </ul>
  );
}

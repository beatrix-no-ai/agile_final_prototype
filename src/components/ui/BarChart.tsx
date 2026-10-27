/** Vertical bars, one column per item; columns narrow to fit long lists (e.g. 14 ranks). `total` draws a grey full bar behind the red value. */
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
    <div className="flex items-end gap-2">
      {data.map((d) => {
        const v = clean(d.value);
        const label = d.total === undefined ? format(v) : `${format(v)} of ${format(clean(d.total))}`;        return (
          <div key={d.label} className="flex min-w-0 flex-1 flex-col items-center gap-1" role="img" aria-label={`${d.label} ${label}`} title={label}>
            <span className="text-[11px] font-medium tabular-nums">{format(v)}</span>
            {d.total !== undefined && <span className="-mt-1 text-[10px] text-on-surface-variant tabular-nums">of {format(clean(d.total))}</span>}
            <div className="relative h-40 w-full max-w-10 border-b border-line">
              {d.total !== undefined && <div className="absolute inset-x-0 bottom-0 rounded-t-md bg-outline/40" style={{ height: `${(clean(d.total) / max) * 100}%` }} />}
              <div className="absolute inset-x-0 bottom-0 rounded-t-md bg-primary" style={{ height: `${(v / max) * 100}%` }} />            </div>
            <span className="w-full truncate text-center text-[11px] text-on-surface-variant">{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}

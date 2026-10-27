/** Vertical bars on a light grid; columns narrow to fit long lists (e.g. 14 ranks). `total` draws a grey full bar behind the red value. */
export function BarChart({
  data,
  format = (n) => n.toLocaleString("en-US"),
}: {
  data: { label: string; value: number; total?: number }[];
  format?: (n: number) => string;
}) {
  const clean = (n?: number) => (n !== undefined && Number.isFinite(n) ? Math.max(0, n) : 0);
  if (data.length === 0) return <p className="text-sm text-on-surface-variant">No data</p>;
  const peak = Math.max(...data.map((d) => Math.max(clean(d.value), clean(d.total))));
  const step = niceStep(peak / 4);
  const max = step * Math.max(1, Math.ceil(peak / step));
  const ticks = Array.from({ length: Math.round(max / step) + 1 }, (_, i) => i * step);
  const pct = (n: number) => `${(n / max) * 100}%`;
  return (
    <div className="grid grid-cols-[auto_1fr] gap-x-3">
      <div className="relative h-48 text-right text-[11px] text-on-surface-variant tabular-nums">
        {ticks.map((t) => (
          <span key={t} className="absolute right-0 translate-y-1/2" style={{ bottom: pct(t) }}>{format(t)}</span>
        ))}
        <span className="invisible">{format(max)}</span>
      </div>
      <div className="relative h-48">
        {ticks.map((t) => (
          <div key={t} className={`absolute inset-x-0 border-t ${t === 0 ? "border-line" : "border-dashed border-line/70"}`} style={{ bottom: pct(t) }} />
        ))}
        <div className="absolute inset-0 flex items-end gap-3 px-2">
          {data.map((d) => {
            const v = clean(d.value);
            const total = d.total === undefined ? undefined : clean(d.total);
            const text = total === undefined ? format(v) : `${format(v)} of ${format(total)}`;
            return (
              <div key={d.label} className="group relative flex h-full min-w-0 flex-1 justify-center" role="img" aria-label={`${d.label} ${text}`} title={text}>
                <div className="relative h-full w-full max-w-14">
                  {total !== undefined && <div className="absolute inset-x-0 bottom-0 rounded-t-lg bg-outline/30" style={{ height: pct(total) }} />}
                  <div className="absolute inset-x-0 bottom-0 rounded-t-lg bg-primary motion-safe:transition-[height] group-hover:opacity-90" style={{ height: pct(v) }} />
                  <span className="absolute left-1/2 mb-1 -translate-x-1/2 whitespace-nowrap text-xs font-semibold tabular-nums" style={{ bottom: pct(total ?? v) }}>
                    {format(v)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <span />
      <div className="mt-2 flex gap-3 px-2">
        {data.map((d) => (
          <span key={d.label} className="min-w-0 flex-1 truncate text-center text-xs text-on-surface-variant">{d.label}</span>
        ))}
      </div>
    </div>
  );
}

/** 1, 2, 2.5 or 5 times a power of ten, at least `raw`; keeps axis ticks round. */
function niceStep(raw: number) {
  if (raw <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(raw));
  return ([1, 2, 2.5, 5, 10].find((m) => m * p >= raw) ?? 10) * p;
}

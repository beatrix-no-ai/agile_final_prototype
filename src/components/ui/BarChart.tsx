export function BarChart({
  data,
  format = (n) => String(n),
}: {
  data: { label: string; value: number }[];
  format?: (n: number) => string;
}) {
  const W = 400,
    H = 180,
    top = 22,
    bottom = 24;
  const vals = data.map((d) => (Number.isFinite(d.value) ? Math.max(0, d.value) : 0));
  const max = Math.max(...vals) || 1; // || 1 only guards the all-zero case
  const slot = W / Math.max(data.length, 1);
  const bw = Math.min(40, slot * 0.6);
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={data.length === 0 ? "No data" : data.map((d, i) => `${d.label} ${format(vals[i])}`).join(", ")}
      className="w-full"
    >
      <line x1="0" x2={W} y1={H - bottom} y2={H - bottom} className="stroke-line" />
      {data.map((d, i) => {
        const h = ((H - top - bottom) * vals[i]) / max;
        const cx = slot * i + slot / 2;
        return (
          <g key={i}>
            <rect x={cx - bw / 2} y={H - bottom - h} width={bw} height={h} rx="4" className="fill-primary" />
            <text x={cx} y={H - bottom - h - 6} textAnchor="middle" className="fill-on-surface text-[11px] font-medium">
              {format(vals[i])}
            </text>
            <text x={cx} y={H - 8} textAnchor="middle" className="fill-on-surface-variant text-[11px]">
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

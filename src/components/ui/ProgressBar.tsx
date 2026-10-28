const tip = "pointer-events-none absolute left-1/2 top-full z-10 mt-3 -translate-x-1/2 whitespace-nowrap rounded-lg bg-on-surface px-3 py-1.5 text-sm text-white opacity-0 shadow transition-opacity group-hover:opacity-100";
// taller invisible hit area so the thin bar is easy to hover
const hit = "group relative h-full before:absolute before:inset-x-0 before:-inset-y-2 before:content-['']";

/** `usedHint` shows on hover over the filled part, `restHint` over the empty track. */
export function ProgressBar({ pct, tone, label, usedHint, restHint }: { pct: number; tone?: "primary" | "alert"; label: string; usedHint?: string; restHint?: string }) {
  const real = Number.isFinite(pct) ? pct : 0;
  const fill = Math.min(100, Math.max(0, real)); // bar never overflows; the text shows the true pct
  const t = tone ?? (real > 100 ? "alert" : "primary");
  const shown = Math.round(real);
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm text-on-surface-variant">
        <span>{label}</span>
        <span className="font-medium text-on-surface">
          {shown}%{real > 100 && " - over budget"}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(fill)}
        aria-valuetext={[`${shown}%${real > 100 ? " - over budget" : ""}`, usedHint, restHint].filter(Boolean).join(", ")}
        className="flex h-2 rounded-full bg-track"
      >
        <div className={`${hit} rounded-full ${t === "alert" ? "bg-alert" : "bg-primary"}`} style={{ width: `${fill}%` }}>
          {usedHint && fill > 0 && <div className={tip}>{usedHint}</div>}
        </div>
        <div className={`${hit} flex-1`}>
          {restHint && fill < 100 && <div className={tip}>{restHint}</div>}
        </div>
      </div>
    </div>
  );
}

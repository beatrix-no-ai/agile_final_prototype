export function ProgressBar({ pct, tone, label, hint }: { pct: number; tone?: "primary" | "alert"; label: string; hint?: string }) {
  const real = Number.isFinite(pct) ? pct : 0;
  const fill = Math.min(100, Math.max(0, real)); // bar never overflows; the text shows the true pct
  const t = tone ?? (real > 100 ? "alert" : "primary");
  const shown = Math.round(real);
  return (
    <div className="group relative outline-none" tabIndex={hint ? 0 : undefined}>
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
        aria-valuetext={`${shown}%${real > 100 ? " - over budget" : ""}`}
        className="h-2 overflow-hidden rounded-full bg-track"
      >
        <div className={`h-full rounded-full ${t === "alert" ? "bg-alert" : "bg-primary"}`} style={{ width: `${fill}%` }} />
      </div>
      {hint && (
        <div role="tooltip" className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-on-surface px-3 py-1.5 text-sm text-white opacity-0 shadow transition-opacity group-hover:opacity-100 group-focus:opacity-100">
          {hint}
        </div>
      )}
    </div>
  );
}

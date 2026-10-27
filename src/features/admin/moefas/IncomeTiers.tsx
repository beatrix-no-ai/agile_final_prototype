import { Fragment, useEffect, useRef, useState } from "react";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { Segmented } from "../../../components/ui/Segmented";
import {
  tierGaps, tierInUse, tierOverlap, tierProblem,
  type Range, type Rule, type TierConfig, type TierKind,
} from "../../../data/moefas";
import { formatSGD } from "../../../lib/format";

const th = "whitespace-nowrap border-b border-line bg-surface-container-low px-3 py-3 text-left text-[13px] font-medium text-on-surface-variant";
const td = "border-b border-line px-3 py-2 align-top";
const cell = "min-h-10 w-full rounded-control border border-outline bg-surface-container-lowest px-2 text-sm aria-[invalid=true]:border-alert aria-[invalid=true]:bg-error-container";

type Props = { tiers: TierConfig; setTiers: (t: TierConfig) => boolean; rules: Rule[]; notify: (m: string, bad?: boolean) => void };

const range = (r: Range) => `${formatSGD(r[0])} – ${formatSGD(r[1])}`;

/** Central GHI / PCI income tiers. A range can only be configured once: overlaps are flagged as you type and rejected when you leave the field. */
export default function IncomeTiers({ tiers, setTiers, rules, notify }: Props) {
  const [draft, setDraft] = useState<TierConfig>(() => structuredClone(tiers));
  const [kind, setKind] = useState<TierKind>("ghi");
  const [changed, setChanged] = useState(false);
  const [error, setError] = useState("");
  const before = useRef<number | null>(null); // value before the first keystroke of the field being edited
  const d = draft[kind], K = kind.toUpperCase();

  useEffect(() => {
    if (!changed) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [changed]);

  const edit = (fn: (s: TierConfig[TierKind]) => void) => {
    setDraft((x) => { const n = structuredClone(x); fn(n[kind]); return n; });
    setChanged(true); setError("");
  };
  const setBound = (i: number, j: 0 | 1, raw: string) => { before.current ??= d.ranges[i][j]; edit((s) => { s.ranges[i][j] = raw === "" ? NaN : Number(raw); }); };
  // Leaving a field that overlaps another tier (or has min > max) puts the previous value back.
  const settle = (i: number, j: 0 | 1) => {
    const [lo, hi] = d.ranges[i], o = tierOverlap(d.ranges, i, lo, hi);
    const msg = o >= 0 ? `${K} Tier ${i + 1}: S$${lo} – S$${hi} overlaps Tier ${o + 1} (${range(d.ranges[o])}). That range is already configured.` : lo > hi ? `${K} Tier ${i + 1}: minimum cannot exceed maximum.` : "";
    const prev = before.current;
    before.current = null;
    if (!msg) return;
    if (prev !== null) edit((s) => { s.ranges[i][j] = prev; });
    notify(msg, true);
  };

  const discard = () => {
    if (changed && !window.confirm("Discard unsaved GHI and PCI changes?")) return;
    setDraft(structuredClone(tiers)); setChanged(false); setError("");
  };
  const save = () => {
    const blocked = tierInUse(rules, draft, tiers) || tierProblem(draft);
    if (blocked) { setError(blocked); notify(blocked, true); return; }
    const gaps = tierGaps(draft);
    if (gaps.length && !window.confirm(`Uncovered income amounts exist in ${gaps.join(" and ").toUpperCase()}. These amounts will not match a tier. Save anyway?`)) return;
    if (!setTiers(structuredClone(draft))) return notify("Unable to save in this browser. Your changes remain on screen.", true);
    setChanged(false); setError("");
    notify("GHI and PCI configuration saved. School tier availability updated.");
  };

  return (
    <Card title="Income tiers">
      <p className="mb-4 text-sm text-on-surface-variant">Central GHI and PCI ranges used by MOEFAS and SBFAS.</p>
      <Segmented<TierKind> label="Income type" value={kind} onChange={setKind} options={[{ value: "ghi", label: "GHI · Household income" }, { value: "pci", label: "PCI · Per-capita income" }]} />
      {error && <p role="alert" className="mt-4 rounded-control border border-line bg-error-container px-3 py-2 text-sm font-medium text-alert">{error}</p>}
      <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[480px] border-collapse text-sm">
            <thead><tr><th className={th}>Income tier</th><th className={th}>Minimum (S$)</th><th className={th}>Maximum (S$)</th></tr></thead>
            <tbody>
              {d.ranges.map((r, i) => {
                const o = tierOverlap(d.ranges, i, r[0], r[1]);
                const msg = o >= 0 ? `Overlaps Tier ${o + 1} (${range(d.ranges[o])}). This range is already configured.` : r[0] > r[1] ? "Minimum cannot exceed maximum." : "";
                return (
                  <Fragment key={i}>
                    <tr>
                      <td className={`${td} font-semibold`}>Tier {i + 1}</td>
                      {([0, 1] as const).map((j) => (
                        <td key={j} className={td}>
                          <input type="number" min={0} max={999999999} step="1" required className={cell} aria-label={`${K} Tier ${i + 1} ${j ? "maximum" : "minimum"}`}
                            aria-invalid={!!msg} value={Number.isNaN(r[j]) ? "" : r[j]}
                            onChange={(e) => setBound(i, j, e.target.value)} onBlur={() => settle(i, j)} />
                        </td>
                      ))}
                    </tr>
                    {msg && <tr><td colSpan={3} role="alert" className="border-b border-line bg-error-container px-3 py-1.5 text-[13px] font-medium text-alert">Tier {i + 1}: {msg}</td></tr>}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
        <div className="flex items-center gap-3">
          <span role="status" className="text-[13px] text-on-surface-variant">{changed ? "Unsaved changes" : ""}</span>
          <Button variant="secondary" onClick={discard}>Discard changes</Button>
          <Button onClick={save}>Save</Button>
        </div>
      </div>
    </Card>
  );
}

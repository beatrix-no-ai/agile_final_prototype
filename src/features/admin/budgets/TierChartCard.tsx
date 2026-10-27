import { useState } from "react";
import { BarChart } from "../../../components/ui/BarChart";
import { Card } from "../../../components/ui/Card";
import { inputClass } from "../../../components/ui/Field";
import { Segmented } from "../../../components/ui/Segmented";
import { formatSGD } from "../../../lib/format";

type Row = { label: string; value: number; by: Record<string, number> };

/** Students helped per class (bars). Picking a rank greys the class's full bar and shows that rank's share in red. Takes the full grid row past 6 classes. */
/** `amountOf` is the yearly package value of one grant at that tier, so "Cash granted" = students x amount. */
export function TierChartCard({ byTier, classes, note, amountOf }: { byTier: Row[]; classes: readonly string[]; note: (count: string, filter: string) => string; amountOf: (tier: string) => number }) {
  const [filter, setFilter] = useState("All");
  const [metric, setMetric] = useState<"students" | "cash">("students");
  const k = (t: Row) => (metric === "cash" ? amountOf(t.label) : 1);
  const of = (c: string, tiers: Row[]) => tiers.reduce((s, t) => s + (t.by[c] ?? 0) * k(t), 0);
  const picked = byTier.filter((t) => t.label === filter);
  const data = classes.map((c) => ({
    label: c,
    value: of(c, filter === "All" ? byTier : picked),
    total: filter === "All" ? undefined : of(c, byTier),
  }));
  const sum = data.reduce((s, d) => s + d.value, 0);
  const lvl = filter === "All" ? "" : `${rank(filter)} `;
  const money = (n: number) => formatSGD(n, { compact: true });
  // axis and bar labels: S$14.4M, S$500K
  const short = (n: number) => (n >= 1e6 ? `${+(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${+(n / 1e3).toFixed(1)}K` : `${n}`);
  const picker = (
    <select aria-label="Rank" className={`${inputClass.replace("w-full", "").replace("min-h-11", "min-h-9")} w-32 shrink-0`} value={filter} onChange={(e) => setFilter(e.target.value)}>
      <option value="All">All ranks</option>
      {byTier.map((t) => <option key={t.label} value={t.label}>{rank(t.label)}</option>)}
    </select>
  );
  return (
    <Card title={metric === "cash" ? "Cash granted by class" : "Students helped by class"} action={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Segmented size="sm" label="Show" value={metric} onChange={setMetric} options={[{ value: "students", label: "Students" }, { value: "cash", label: "Cash" }]} />
          {picker}
        </div>
      } className={classes.length > 6 ? "lg:col-span-2" : ""}>
      <BarChart data={data} format={metric === "cash" ? short : undefined} axisFormat={metric === "cash" ? (n) => `S$${short(n)}` : undefined} />
      <p className="mt-2 text-sm text-on-surface-variant">
        {metric === "cash" ? `${money(sum)} granted to ${lvl}students this year, at each rank's yearly package value.` : note(sum.toLocaleString("en-US"), lvl)}
      </p>
    </Card>
  );
}

const rank = (tier: string) => tier.replace("Tier", "Rank");

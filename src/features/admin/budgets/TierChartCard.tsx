import { useState } from "react";
import { BarChart } from "../../../components/ui/BarChart";
import { Card } from "../../../components/ui/Card";
import { inputClass } from "../../../components/ui/Field";
import { Segmented } from "../../../components/ui/Segmented";
import { formatSGD } from "../../../lib/format";

type Row = { label: string; value: number; by: Record<string, number> };

/** Students helped per rank. Picking a filter greys the full bar and shows the filtered share in red. Takes the full grid row past 6 ranks. */
/** `amountOf` is the yearly package value of one grant at that tier, so "Cash granted" = students x amount. */
export function TierChartCard({ byTier, filters, filterLabel, note, amountOf }: { byTier: Row[]; filters: readonly string[]; filterLabel: string; note: (count: string, filter: string) => string; amountOf: (tier: string) => number }) {
  const [filter, setFilter] = useState("All");
  const [metric, setMetric] = useState<"students" | "cash">("students");
  const all = (t: Row) => filters.reduce((s, f) => s + (t.by[f] ?? 0), 0); // only what the viewer may see
  const k = (t: Row) => (metric === "cash" ? amountOf(t.label) : 1);
  const data = byTier.map((t) => ({
    label: t.label.replace("Tier", "Rank"),
    value: (filter === "All" ? all(t) : (t.by[filter] ?? 0)) * k(t),
    total: filter === "All" ? undefined : all(t) * k(t),
  }));
  const sum = data.reduce((s, d) => s + d.value, 0);
  const lvl = filter === "All" ? "" : `${filter} `;
  const money = (n: number) => formatSGD(n, { compact: true });
  // axis and bar labels: S$14.4M, S$500K
  const short = (n: number) => (n >= 1e6 ? `${+(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${+(n / 1e3).toFixed(1)}K` : `${n}`);
  const picker = (
    <select aria-label={filterLabel} className={`${inputClass.replace("w-full", "").replace("min-h-11", "min-h-9")} w-32 shrink-0`} value={filter} onChange={(e) => setFilter(e.target.value)}>
      <option value="All">All {filterLabel === "Class" ? "classes" : "levels"}</option>
      {filters.map((f) => <option key={f}>{f}</option>)}
    </select>
  );
  return (
    <Card title={metric === "cash" ? "Cash granted by rank" : "Students helped by rank"} action={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Segmented size="sm" label="Show" value={metric} onChange={setMetric} options={[{ value: "students", label: "Students" }, { value: "cash", label: "Cash" }]} />
          {picker}
        </div>
      } className={byTier.length > 6 ? "lg:col-span-2" : ""}>
      <BarChart data={data} format={metric === "cash" ? short : undefined} axisFormat={metric === "cash" ? (n) => `S$${short(n)}` : undefined} />
      <p className="mt-2 text-sm text-on-surface-variant">
        {metric === "cash" ? `${money(sum)} granted to ${lvl}students this year, at each rank's yearly package value.` : note(sum.toLocaleString("en-US"), lvl)}
      </p>
    </Card>
  );
}

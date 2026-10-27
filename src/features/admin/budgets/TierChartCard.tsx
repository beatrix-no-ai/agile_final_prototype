import { useState } from "react";
import { BarChart } from "../../../components/ui/BarChart";
import { Card } from "../../../components/ui/Card";
import { inputClass } from "../../../components/ui/Field";

type Row = { label: string; value: number; by: Record<string, number> };

/** Students helped per rank. Picking a filter greys the full bar and shows the filtered share in red. Takes the full grid row past 6 ranks. */
export function TierChartCard({ byTier, filters, filterLabel, note }: { byTier: Row[]; filters: readonly string[]; filterLabel: string; note: (count: string, filter: string) => string }) {
  const [filter, setFilter] = useState("All");
  const all = (t: Row) => filters.reduce((s, f) => s + (t.by[f] ?? 0), 0); // only what the viewer may see
  const data = byTier.map((t) => ({
    label: t.label.replace("Tier", "Rank"),
    value: filter === "All" ? all(t) : (t.by[filter] ?? 0),
    total: filter === "All" ? undefined : all(t),
  }));
  const count = data.reduce((s, d) => s + d.value, 0).toLocaleString("en-US");
  const picker = (
    <select aria-label={filterLabel} className={`${inputClass.replace("w-full", "")} w-36 shrink-0`} value={filter} onChange={(e) => setFilter(e.target.value)}>
      <option value="All">All {filterLabel === "Class" ? "classes" : "levels"}</option>
      {filters.map((f) => <option key={f}>{f}</option>)}
    </select>
  );
  return (
    <Card title="Students helped by rank" action={picker} className={byTier.length > 6 ? "lg:col-span-2" : ""}>
      <BarChart data={data} />
      <p className="mt-2 text-sm text-on-surface-variant">{note(count, filter === "All" ? "" : `${filter} `)}</p>
    </Card>
  );
}

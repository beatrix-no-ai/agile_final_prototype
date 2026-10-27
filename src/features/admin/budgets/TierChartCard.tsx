import { useState } from "react";
import { BarChart } from "../../../components/ui/BarChart";
import { Card } from "../../../components/ui/Card";
import { Segmented } from "../../../components/ui/Segmented";

type Filter = "All" | "Primary" | "Secondary";
const OPTIONS: { value: Filter; label: string }[] = [{ value: "All", label: "All" }, { value: "Primary", label: "Primary" }, { value: "Secondary", label: "Secondary" }];

/** Students helped per rank, filterable by level. Takes the full row of the grid once there are more than 6 ranks. */
export function TierChartCard({ byTier, note }: { byTier: { label: string; value: number; Primary: number; Secondary: number }[]; note: (count: string, level: string) => string }) {
  const [level, setLevel] = useState<Filter>("All");
  const data = byTier.map((t) => ({ label: t.label.replace("Tier", "Rank"), value: level === "All" ? t.value : t[level] }));
  const total = data.reduce((s, d) => s + d.value, 0).toLocaleString("en-US");
  return (
    <Card title="Students helped by rank" action={<Segmented label="Level" value={level} onChange={setLevel} options={OPTIONS} />} className={byTier.length > 6 ? "lg:col-span-2" : ""}>
      <BarChart data={data} />
      <p className="mt-2 text-sm text-on-surface-variant">{note(total, level === "All" ? "" : `${level} `)}</p>
    </Card>
  );
}

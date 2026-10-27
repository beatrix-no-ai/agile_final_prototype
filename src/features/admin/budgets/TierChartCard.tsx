import { useState } from "react";
import { BarChart } from "../../../components/ui/BarChart";
import { Card } from "../../../components/ui/Card";
import { Segmented } from "../../../components/ui/Segmented";
import { formatSGD } from "../../../lib/format";

type Row = { label: string; value: number; by: Record<string, number> };

/** Students helped per class (bars). Takes the full grid row past 6 classes. */
/** `amountOf` is the yearly package value of one grant at that tier, so "Cash granted" = students x amount. */
export function TierChartCard({ byTier, classes, note, amountOf }: { byTier: Row[]; classes: readonly string[]; note: (count: string) => string; amountOf: (tier: string) => number }) {
  const [metric, setMetric] = useState<"students" | "cash">("students");
  const k = (t: Row) => (metric === "cash" ? amountOf(t.label) : 1);
  const of = (c: string, tiers: Row[]) => tiers.reduce((s, t) => s + (t.by[c] ?? 0) * k(t), 0);
  const data = classes.map((c) => ({
    label: c,
    value: of(c, byTier),
  }));
  const sum = data.reduce((s, d) => s + d.value, 0);
  const money = (n: number) => formatSGD(n, { compact: true });
  // axis and bar labels: S$14.4M, S$500K
  const short = (n: number) => (n >= 1e6 ? `${+(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${+(n / 1e3).toFixed(1)}K` : `${n}`);
  return (
    <Card title={metric === "cash" ? "Cash granted by class" : "Students helped by class"} action={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Segmented size="sm" label="Show" value={metric} onChange={setMetric} options={[{ value: "students", label: "Students" }, { value: "cash", label: "Cash" }]} />
        </div>
      } className={classes.length > 6 ? "lg:col-span-2" : ""}>
      <BarChart data={data} format={metric === "cash" ? short : undefined} axisFormat={metric === "cash" ? (n) => `S$${short(n)}` : undefined} />
      <p className="mt-2 text-sm text-on-surface-variant">
        {metric === "cash" ? `${money(sum)} granted to students this year, at each rank's yearly package value.` : note(sum.toLocaleString("en-US"))}
      </p>
    </Card>
  );
}

import { useState, type ReactNode } from "react";
import { ArrowLeft } from "@phosphor-icons/react";
import { ActionCell, RowAction } from "../../../components/ui/DataTable";
import { Card } from "../../../components/ui/Card";
import { Segmented } from "../../../components/ui/Segmented";
import { SCHOOLS } from "../../../data/schools";
import { useFees } from "../../../data/feeStore";
import type { Charge, FeeType } from "../../../data/fees";
import { schoolOfLevel } from "../../../data/schoolMgmt";
import { formatSGD } from "../../../lib/format";
import { aggregate } from "../../../lib/fees";
import { FeeTypeModal, Tiles, selectClass, studentOf } from "./parts";

const studentsIn = (rows: Charge[]) => new Set(rows.map((c) => c.studentId)).size;
const inSchool = (charges: Charge[], code: string) => charges.filter((c) => { const s = studentOf(c.studentId); return s && schoolOfLevel(s.level) === code; });

const tiles = (rows: Charge[]) => {
  const a = aggregate(rows);
  return (
    <Tiles items={[
      { label: "Fee value issued", value: formatSGD(a.fee), note: `${rows.length} charges, ${studentsIn(rows)} students` },
      { label: "Collected", value: formatSGD(a.collected), good: true, note: `${a.paid} paid` },
      { label: "Outstanding", value: formatSGD(a.outstanding), alert: a.outstanding > 0, note: `${a.unpaid} unpaid${a.overdue ? `, ${a.overdue} overdue` : ""}` },
    ]} />
  );
};

function AggTable({ label, groups, extra, sub }: { label: string; groups: [string, Charge[]][]; extra?: (key: string, rows: Charge[]) => ReactNode; sub?: (rows: Charge[]) => ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[34rem] text-sm">
        <thead>
          <tr className="border-b border-line text-left text-[13px] text-on-surface-variant">
            <th className="py-2 font-semibold">{label}</th>
            {["Charges", "Fee value", "Subsidy", "Payable", "Collected", "Outstanding"].map((h) => <th key={h} className="text-right font-semibold">{h}</th>)}
            {extra && <th className="px-3 text-left font-semibold">Actions</th>}
          </tr>
        </thead>
        <tbody>
          {groups.map(([k, rows]) => {
            const a = aggregate(rows);
            return (
              <tr key={k} className="border-b border-line hover:bg-primary-fixed/30 focus-within:bg-primary-fixed/30">
                <td className="py-2 font-medium">{k}{sub && <div className="mt-1 max-w-48 font-normal">{sub(rows)}</div>}</td>
                <td className="text-right tabular-nums">{rows.length}</td>
                <td className="text-right tabular-nums">{formatSGD(a.fee)}</td>
                <td className="text-right tabular-nums text-success">{formatSGD(a.subsidy)}</td>
                <td className="text-right tabular-nums font-semibold">{formatSGD(a.payable)}</td>
                <td className="text-right tabular-nums text-success">{formatSGD(a.collected)}</td>
                <td className={`text-right tabular-nums ${a.outstanding ? "text-alert" : ""}`}>{formatSGD(a.outstanding)}</td>
                {extra && <ActionCell>{extra(k, rows)}</ActionCell>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const group = (rows: Charge[], key: (c: Charge) => string) => {
  const m = new Map<string, Charge[]>();
  rows.forEach((c) => m.set(key(c), [...(m.get(key(c)) ?? []), c]));
  return [...m];
};

/** One row per group: name and payable on top, a thick bar (length = payable, split collected / outstanding), then the split in words. */
function Bars({ groups }: { groups: [string, Charge[]][] }) {
  const aggs = groups.map(([k, rs]) => ({ k, n: rs.length, a: aggregate(rs) })).sort((x, y) => y.a.payable - x.a.payable);
  const max = Math.max(1, ...aggs.map((x) => x.a.payable));
  if (!aggs.length) return <p className="text-sm text-on-surface-variant">No charges to chart.</p>;
  return (
    <div>
      <div className="mb-5 flex flex-wrap gap-x-6 gap-y-1 text-[13px] text-on-surface-variant">
        <span className="flex items-center gap-2"><span aria-hidden className="size-3 rounded-sm bg-success" />Collected</span>
        <span className="flex items-center gap-2"><span aria-hidden className="size-3 rounded-sm bg-alert" />Outstanding</span>
        <span>Bar length = payable after FAS subsidy</span>
      </div>
      <ul className="divide-y divide-line">
        {aggs.map(({ k, n, a }) => {
          const pct = a.payable ? Math.round((a.collected / a.payable) * 100) : 0;
          return (
            <li key={k} className="py-3.5 first:pt-0 last:pb-0">
              <div className="mb-2 flex items-baseline justify-between gap-3">
                <span className="text-[15px] font-semibold">{k} <span className="text-[13px] font-normal text-on-surface-variant">{n} charge{n === 1 ? "" : "s"}</span></span>
                <span className="text-lg font-bold tabular-nums">{formatSGD(a.payable)}</span>
              </div>
              <div role="img" aria-label={`${k}: ${pct}% collected`} className="h-7 rounded-md bg-track">
                <div className="flex h-full overflow-hidden rounded-md" style={{ width: `${Math.max(2, (a.payable / max) * 100)}%` }}>
                  <div className="bg-success" style={{ width: `${pct}%` }} />
                  <div className="flex-1 bg-alert" />
                </div>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-x-5 text-[13px] tabular-nums">
                <span className="text-success"><b>{formatSGD(a.collected)}</b> collected ({pct}%)</span>
                <span className={a.outstanding ? "text-alert" : "text-on-surface-variant"}><b>{formatSGD(a.outstanding)}</b> outstanding</span>
                {a.subsidy > 0 && <span className="text-on-surface-variant">FAS saved {formatSGD(a.subsidy)}</span>}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

type Pie = "ft" | "level";

/** One school's fee breakdown: filters, tiles, composition donut, then by level, class and fee type. Shared by the HQ drill-down and the School user's dashboard tab. */
export function SchoolFeeBody({ school }: { school: string }) {
  const { state } = useFees();
  const [level, setLevel] = useState("");
  const [ftId, setFtId] = useState("");
  const [pie, setPie] = useState<Pie>("ft");
  const [typeOpen, setTypeOpen] = useState<FeeType | null>(null);

  const all = inSchool(state.charges, school);
  const levels = [...new Set(all.map((c) => studentOf(c.studentId)!.level))];
  const types = state.types.filter((f) => f.school === school);
  const rows = all.filter((c) => (!level || studentOf(c.studentId)!.level === level) && (!ftId || c.ftId === ftId));
  const byLevel = group(rows, (c) => studentOf(c.studentId)!.level);
  const byFt = group(rows, (c) => state.types.find((f) => f.id === c.ftId)?.name ?? c.title);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <select aria-label="Filter by level" className={selectClass} value={level} onChange={(e) => setLevel(e.target.value)}>
          <option value="">All levels / cohorts</option>
          {levels.map((l) => <option key={l}>{l}</option>)}
        </select>
        <select aria-label="Filter by fee type" className={selectClass} value={ftId} onChange={(e) => setFtId(e.target.value)}>
          <option value="">All fee types</option>
          {types.map((f) => <option key={f.id} value={f.id}>{f.name}{f.level ? ` (${f.level})` : ""}</option>)}
        </select>
        <span className="text-[13px] text-on-surface-variant">{level || ftId ? `Filtered: ${rows.length} of ${all.length} charges` : "Filters apply to every breakdown below."}</span>
      </div>
      {tiles(rows)}
      <Card title="Fee position" action={
        <Segmented<Pie> label="Composition" value={pie} onChange={setPie} options={[{ value: "ft", label: "By fee type" }, { value: "level", label: "By level" }]} />
      }>
        <Bars groups={pie === "level" ? byLevel : byFt} />
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="By level / cohort"><AggTable label="Level" groups={byLevel} /></Card>
        <Card title="By class"><AggTable label="Class" groups={group(rows, (c) => studentOf(c.studentId)!.class)} /></Card>
      </div>
      <Card title="By fee type">
        <AggTable label="Fee type" groups={byFt} extra={(_, rs) => {
          const f = state.types.find((x) => x.id === rs[0].ftId);
          return f ? <RowAction onClick={() => setTypeOpen(f)}>Components</RowAction> : null;
        }} />
      </Card>
      <FeeTypeModal fee={typeOpen} used={typeOpen ? new Set(all.filter((c) => c.ftId === typeOpen.id).map((c) => c.studentId)).size : 0} onClose={() => setTypeOpen(null)} />
    </div>
  );
}

/** HQ: read-only fee position of all schools; drill into a school for its breakdown. */
export default function HqFeeDashboard() {
  const { state } = useFees();
  const [school, setSchool] = useState("");
  const [kind, setKind] = useState("");

  if (school) {
    return (
      <div className="space-y-4">
        <button type="button" onClick={() => setSchool("")} className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
          <ArrowLeft size={16} weight="bold" aria-hidden="true" /> All schools
        </button>
        <h2 className="text-lg font-semibold">{SCHOOLS.find((s) => s.code === school)?.name ?? school}: fee breakdown</h2>
        <SchoolFeeBody school={school} />
      </div>
    );
  }

  const list = SCHOOLS.filter((s) => !kind || s.level === kind);
  const shown = state.charges.filter((c) => { const s = studentOf(c.studentId); return s && list.some((x) => x.code === schoolOfLevel(s.level)); });
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <select aria-label="Filter by school level" className={selectClass} value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="">All schools: Primary &amp; Secondary</option>
          <option value="Primary">Primary schools</option>
          <option value="Secondary">Secondary schools</option>
        </select>
        <span className="text-[13px] text-on-surface-variant">{list.length} school{list.length === 1 ? "" : "s"} shown. The filter applies to the tiles and the table below.</span>
      </div>
      {tiles(shown)}
      <Card title="By school">
        <p className="mb-3 text-[13px] text-on-surface-variant">Each school sets its own fees; MOE reviews them here, read-only.</p>
        <AggTable
          label="School"
          groups={list.map((s) => [s.name, inSchool(state.charges, s.code)] as [string, Charge[]]).filter(([, r]) => r.length)}
          sub={(rows) => {
            const a = aggregate(rows), pct = a.fee ? Math.round((a.collected / a.fee) * 100) : 0;
            return <div className="h-1.5 overflow-hidden rounded-full bg-track" title={`${pct}% of fee value collected`}><div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} /></div>;
          }}
          extra={(k) => <RowAction onClick={() => setSchool(SCHOOLS.find((s) => s.name === k)?.code ?? "")}>View fees</RowAction>}
        />
      </Card>
    </div>
  );
}

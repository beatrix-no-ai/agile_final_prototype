import { useMemo, useState } from "react";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { DataTable, type Column } from "../../../components/ui/DataTable";
import { EmptyState } from "../../../components/ui/EmptyState";
import { inputClass } from "../../../components/ui/Field";
import { useFees } from "../../../data/feeStore";
import type { Charge, FasScheme } from "../../../data/fees";
import { schoolOfLevel } from "../../../data/schoolMgmt";
import { formatSGD } from "../../../lib/format";
import { aggregate, feeOf, payableOf, subsidyOf } from "../../../lib/fees";
import { Badge } from "../../../components/ui/Badge";
import { ChargeModal, Chips, StatusBadge, Tiles, selectClass, studentOf } from "./parts";

type Row = { id: string; charge: Charge; student: string; studentId: string; levelClass: string; level: string; title: string; term: string; due: string; fee: number; payable: number; status: string };

/** School user: every charge issued to the school's students, with search and filters. */
export default function StudentCharges({ school }: { school: string }) {
  const { state } = useFees();
  const [q, setQ] = useState("");
  const [level, setLevel] = useState("");
  const [status, setStatus] = useState<"" | "outstanding" | "overdue" | "paid">("");
  const [term, setTerm] = useState("");
  const [open, setOpen] = useState<Charge | null>(null);

  const mine = useMemo(() => state.charges.filter((c) => { const s = studentOf(c.studentId); return s && schoolOfLevel(s.level) === school; }), [state.charges, school]);
  const levels = [...new Set(mine.map((c) => studentOf(c.studentId)!.level))];
  const rows: Row[] = useMemo(() => mine.flatMap((c) => {
    const s = studentOf(c.studentId)!;
    const text = `${s.name} ${s.id} ${s.class} ${c.title} ${c.term}`.toLowerCase();
    if ((q.trim() && !text.includes(q.trim().toLowerCase())) || (level && s.level !== level) || (term && c.term !== term) || (status && c.status !== status)) return [];
    return [{ id: c.id, charge: c, student: s.name, studentId: s.id, levelClass: `${s.level}, ${s.class}`, level: s.level, title: c.title, term: c.term, due: c.due, fee: feeOf(c), payable: payableOf(c), status: c.status }];
  }), [mine, q, level, term, status]);
  const a = aggregate(rows.map((r) => r.charge));
  const byScheme = (scheme: FasScheme) => rows.filter((r) => r.charge.fas === scheme).reduce((t, r) => t + subsidyOf(r.charge), 0);
  const terms = [...new Set(mine.map((c) => c.term))].sort();
  const count = (s: string) => mine.filter((c) => !s || c.status === s).length;
  const filtered = !!(q || level || term || status);
  const clear = () => { setQ(""); setLevel(""); setTerm(""); setStatus(""); };

  const columns: Column<Row>[] = [
    { key: "student", header: "Student", sortable: true, render: (r) => (<><span className="font-semibold">{r.student}</span><span className="block text-[13px] text-on-surface-variant">{r.studentId}</span></>) },
    { key: "levelClass", header: "Level / class", sortable: true },
    { key: "title", header: "Charge", sortable: true, render: (r) => (<>{r.title}<span className="block text-[13px] text-on-surface-variant">{r.term}, due {r.due}</span></>) },
    { key: "fee", header: "Fee", sortable: true, align: "right", render: (r) => formatSGD(r.fee) },
    { key: "fas", header: "FAS", sortable: true, render: (r) => r.charge.fas ? (
      (<><Badge tone="primary">{r.charge.fas}</Badge><span className="block text-[13px] text-success">− {formatSGD(subsidyOf(r.charge))}</span></>)
    ) : <span className="text-on-surface-variant">—</span> },
    { key: "payable", header: "Payable", sortable: true, align: "right", render: (r) => <span className="font-semibold">{formatSGD(r.payable)}</span> },
    { key: "status", header: "Status", sortable: true, render: (r) => <StatusBadge status={r.charge.status} /> },
    { key: "view", header: "", render: (r) => <Button size="sm" variant="ghost" onClick={() => setOpen(r.charge)} aria-label={`Components of ${r.id}`}>Components</Button> },
  ];

  return (
    <div className="space-y-4">
      <Tiles items={[
        { label: "Charges shown", value: rows.length, note: `${a.unpaid} unpaid, ${a.paid} paid${a.overdue ? `, ${a.overdue} overdue` : ""}` },
        { label: "Outstanding payable", value: formatSGD(a.outstanding), alert: a.outstanding > 0 },
        { label: "FAS subsidies applied", value: formatSGD(a.subsidy), good: true, note: `MOEFAS − ${formatSGD(byScheme("MOEFAS"))} · SBFAS − ${formatSGD(byScheme("SBFAS"))}` },
        { label: "Total fee value", value: formatSGD(a.fee), note: `Payable ${formatSGD(a.payable)}` },
      ]} />
      <Card title="Student fees">
        <div className="mb-4 flex flex-wrap gap-3">
          <input aria-label="Search charges" className={inputClass.replace("w-full", "min-w-48 max-w-sm flex-1")} placeholder="Search student, class, charge or term..." value={q} onChange={(e) => setQ(e.target.value)} />
          <select aria-label="Filter by level" className={selectClass} value={level} onChange={(e) => setLevel(e.target.value)}>
            <option value="">All levels</option>
            {levels.map((l) => <option key={l}>{l}</option>)}
          </select>
          <select aria-label="Filter by term" className={selectClass} value={term} onChange={(e) => setTerm(e.target.value)}>
            <option value="">All terms</option>
            {terms.map((t) => <option key={t}>{t}</option>)}
          </select>
          {filtered && <Button variant="ghost" onClick={clear}>Clear filters</Button>}
        </div>
        <div className="mb-4">
          <Chips label="Status" value={status} onChange={setStatus} options={[
            { value: "", label: "All", count: count("") }, { value: "outstanding", label: "Outstanding", count: count("outstanding") },
            { value: "overdue", label: "Overdue", count: count("overdue") }, { value: "paid", label: "Paid", count: count("paid") },
          ]} />
        </div>
        <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} pageSize={10} empty={<EmptyState title="No charges match" hint="Change the filters, or generate charges in Assign and generate." />} />
      </Card>
      <ChargeModal charge={open} feeName={open ? state.types.find((f) => f.id === open.ftId)?.name : undefined} onClose={() => setOpen(null)} />
    </div>
  );
}

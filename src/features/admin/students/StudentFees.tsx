import { useState } from "react";
import { ArrowLeft } from "@phosphor-icons/react";
import { Link } from "react-router";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { DataTable, type Column } from "../../../components/ui/DataTable";
import { EmptyState } from "../../../components/ui/EmptyState";
import { useFees } from "../../../data/feeStore";
import { benefitsFor, MOE_FAS_BENEFITS, REIMBURSEMENT_NOTE, SBFAS_PACKAGE } from "../../../data/fasBenefits";
import type { Charge, ChargeStatus } from "../../../data/fees";
import { formatDate, formatSGD } from "../../../lib/format";
import { maskNric } from "../../../lib/nric";
import { balanceOf, chargeStatus, feeOf, fasOf, paidOf, payableOf, subsidyOf } from "../../../lib/fees";
import { ChargeModal, StatusBadge, Tiles } from "../fee-types/parts";
import { statusLabel } from "../fas/review";
import { useStudent } from "./useStudent";

type Row = { id: string; charge: Charge; title: string; issued: string; due: string; fee: number; subsidy: number; payable: number; paid: number; balance: number; status: string };

/** Req 3: every charge issued to one student, with the per-component breakdown on demand. */
export default function StudentFees() {
  const student = useStudent();
  const { state } = useFees();
  const [openId, setOpenId] = useState<string | null>(null);
  // Re-resolve from state so the modal reflects a payment recorded while it is open.
  const open = state.charges.find((c) => c.id === openId) ?? null;

  if (!student) {
    return (
      <Card>
        <EmptyState as="h2" title="Student not found" action={<Link to="/admin/students" className="text-primary underline">Back to students</Link>} />
      </Card>
    );
  }
  const rows: Row[] = state.charges.filter((c) => c.studentId === student.id)
    .map((c) => ({ id: c.id, charge: c, title: c.title, issued: c.issued, due: c.due, fee: feeOf(c), subsidy: subsidyOf(c), payable: payableOf(c), paid: paidOf(c), balance: balanceOf(c), status: chargeStatus(c) }))
    .sort((a, b) => Number(a.status === "paid") - Number(b.status === "paid") || a.due.localeCompare(b.due));
  const total = rows.filter((r) => r.status !== "paid").reduce((t, r) => t + r.balance, 0);
  const fas = fasOf(student);
  const columns: Column<Row>[] = [
    { key: "title", header: "Charge", sortable: true, render: (r) => (<><span className="font-medium">{r.title}</span><span className="block text-[13px] text-on-surface-variant">Due {formatDate(r.due)} · issued {formatDate(r.issued)}</span>{r.charge.fasAdjusted && <span className="block text-[13px] text-success">{r.charge.fas ?? "FAS"} re-priced {formatDate(r.charge.fasAdjusted.on)}: {r.charge.fasAdjusted.amount > 0 ? "−" : "+"} {formatSGD(Math.abs(r.charge.fasAdjusted.amount))}</span>}</>) },
    { key: "fee", header: "Fee", sortable: true, align: "right", render: (r) => formatSGD(r.fee) },
    { key: "subsidy", header: "Subsidy", align: "right", render: (r) => (r.subsidy ? <span className="text-success">− {formatSGD(r.subsidy)}</span> : <span className="text-on-surface-variant">—</span>) },
    { key: "paid", header: "Paid", sortable: true, align: "right", render: (r) => (r.paid ? formatSGD(r.paid) : <span className="text-on-surface-variant">—</span>) },
    { key: "balance", header: "Outstanding", sortable: true, align: "right", render: (r) => r.balance ? <span className="font-semibold">{formatSGD(r.balance)}</span> : <span className="text-on-surface-variant">—</span> },
    { key: "status", header: "Status", sortable: true, render: (r) => <StatusBadge status={r.status as ChargeStatus} /> },
    { key: "view", header: "", render: (r) => <Button size="sm" variant="ghost" onClick={() => setOpenId(r.id)} aria-label={`Details of ${r.title}, due ${formatDate(r.due)}`}>View details</Button> },
  ];

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      <Link to={`/admin/students/${student.id}/account`} state={{ student }} className="inline-flex items-center gap-1.5 text-sm font-medium text-primary">
        <ArrowLeft size={16} aria-hidden /> Back to Education Account
      </Link>
      <div>
        <h2 className="text-xl font-semibold text-on-surface">Fees for {student.name}</h2>
        <p className="mt-1 text-sm text-on-surface-variant">{maskNric(student.nric)} · {student.level}, {student.class}</p>
      </div>
      <Tiles items={[
        { label: "Still to pay", value: formatSGD(total), note: `${rows.filter((r) => r.status !== "paid").length} unpaid ${rows.filter((r) => r.status !== "paid").length === 1 ? "charge" : "charges"}`, alert: rows.some((r) => r.status === "overdue") },
        { label: "Paid so far", value: formatSGD(rows.reduce((t, r) => t + r.paid, 0)), note: `${rows.filter((r) => r.status === "paid").length} ${rows.filter((r) => r.status === "paid").length === 1 ? "charge" : "charges"} settled`, good: true },
        { label: "Education Account balance", value: formatSGD(student.balance), note: total > student.balance ? "Not enough to cover what is due" : "Covers what is due" },
        { label: "Financial assistance", value: fas ? `${fas.scheme}${fas.scheme === "SBFAS" && student.sbfasTier ? ` · ${student.sbfasTier}` : ""}` : "None", note: fas ? `${Math.round(fas.rate * 100)}% off each new charge` : `MOEFAS ${statusLabel(student.moefas).toLowerCase()} · SBFAS ${statusLabel(student.sbfas).toLowerCase()}` },
      ]} />
      <Card title="Charges">
        {fas && (
          <div className="mb-4 space-y-2">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-control border border-line bg-surface-container-low px-3 py-2.5 text-sm">
              <Link to="/admin/fas" className="rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"><Badge tone="primary">{fas.scheme}</Badge></Link>
              <span>
                takes precedence — subsidy of {Math.round(fas.rate * 100)}% is deducted from each issued charge; the student does not also receive {fas.scheme === "MOEFAS" ? "SBFAS" : "MOEFAS"}.
                The subsidy reduces the fee; MOE top-ups credit the <Link to={`/admin/students/${student.id}/account`} className="text-primary underline-offset-2 hover:underline">Education Account balance</Link> — two different things.
              </span>
            </p>
            {fas.scheme === "MOEFAS" ? (
              <p className="rounded-control border border-line bg-surface-container-lowest px-3 py-2.5 text-sm">
                <b>{MOE_FAS_BENEFITS.title} ({student.level.startsWith("Sec") ? "Secondary" : "Primary"}):</b>{" "}
                {benefitsFor(student.level).join(" · ")}.
              </p>
            ) : (
              <p className="rounded-control border border-line bg-surface-container-lowest px-3 py-2.5 text-sm">
                <b>{SBFAS_PACKAGE.title}:</b> {SBFAS_PACKAGE.items.join(" · ")}. Funded from {SBFAS_PACKAGE.funding}.
              </p>
            )}
            <p className="px-1 text-[12.5px] text-on-surface-variant">{REIMBURSEMENT_NOTE}</p>
          </div>
        )}
        <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} pageSize={12} large="md" empty={<EmptyState title="No charges yet" hint="The school generates charges under Fee, Assign and generate." />} />
      </Card>
      <ChargeModal charge={open} feeName={open ? state.types.find((f) => f.id === open.ftId)?.name : undefined} onClose={() => setOpenId(null)} />
    </div>
  );
}

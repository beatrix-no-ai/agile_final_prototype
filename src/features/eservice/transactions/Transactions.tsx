import { ArrowDown, ArrowUp } from "@phosphor-icons/react";
import { useState } from "react";
import { useSearchParams } from "react-router";
import { Badge } from "../../../components/ui/Badge";
import { Card } from "../../../components/ui/Card";
import { EmptyState } from "../../../components/ui/EmptyState";
import { Field, inputClass } from "../../../components/ui/Field";
import { Segmented } from "../../../components/ui/Segmented";
import { useFees } from "../../../data/feeStore";
import { useParent } from "../../../data/parentStore";
import { useRegistry } from "../../../data/registryStore";
import { formatSGD } from "../../../lib/format";
import { fmtDate } from "../overview/shared";
import { InvoiceDetails } from "./InvoiceDetails";

type View = "transactions" | "invoices";
type Kind = "all" | "topup" | "payment";

function ChildSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { state } = useParent();
  return (
    <Field label="Child" className="w-48">
      <select className={inputClass} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">All children</option>
        {state.children.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
    </Field>
  );
}

function TransactionList() {
  const { state } = useParent();
  const [child, setChild] = useState("");
  const [kind, setKind] = useState<Kind>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const rows = state.transactions.filter((t) =>
    (!child || t.childId === child) &&
    (kind === "all" || (kind === "topup" ? t.amount > 0 : t.amount < 0)) &&
    (!from || t.date >= from) && (!to || t.date <= to));
  return (
    <>
      <p className="text-sm text-on-surface-variant">Top-ups, payments and refunds of your children's Education Accounts, and the fees paid by card.</p>
      <div className="mt-4 flex flex-wrap gap-4">
        <ChildSelect value={child} onChange={setChild} />
        <Field label="Transaction type" className="w-48">
          <select className={inputClass} value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
            <option value="all">All types</option>
            <option value="topup">Top-ups and refunds</option>
            <option value="payment">Payments</option>
          </select>
        </Field>
        <Field label="From" className="w-44"><input type="date" className={inputClass} value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field label="To" className="w-44"><input type="date" className={inputClass} value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} /></Field>
      </div>
      {rows.length === 0 ? (
        <EmptyState title="No transactions found" hint="Try another child, type or date range." />
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-sm">
            <thead className="border-b border-line text-[13px] text-on-surface-variant">
              <tr><th className="pb-3 pr-4 font-medium">Date</th><th className="pb-3 pr-4 font-medium">Description</th><th className="pb-3 pr-4 font-medium">Student</th><th className="pb-3 pr-4 font-medium">Method</th><th className="pb-3 text-right font-medium">Amount</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((t) => {
                const credit = t.amount > 0;
                return (
                  <tr key={t.id}>
                    <td className="py-3 pr-4 whitespace-nowrap">{fmtDate(t.date)}</td>
                    <td className="py-3 pr-4 font-medium">{t.invoiceId ? `Payment for ${t.description}` : t.description}</td>
                    <td className="py-3 pr-4">{state.children.find((c) => c.id === t.childId)?.name ?? "—"}</td>
                    <td className="py-3 pr-4 text-on-surface-variant">{t.method}</td>
                    <td className={`py-3 text-right font-semibold tabular-nums ${credit ? "text-success" : ""}`}>
                      <span className="inline-flex items-center gap-1">{credit ? <ArrowDown size={15} /> : <ArrowUp size={15} />}{credit ? "+" : "-"}{formatSGD(Math.abs(t.amount))}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function PaidInvoices() {
  const { state } = useParent();
  const fees = useFees();
  const { state: reg } = useRegistry();
  const [child, setChild] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const paid = state.invoices.filter((i) => i.status === "paid" && (!child || i.childId === child)).sort((a, b) => b.dueDate.localeCompare(a.dueDate));
  const charge = fees.state.charges.find((c) => c.id === open) ?? null;
  const kid = state.children.find((c) => c.id === charge?.studentId);
  return (
    <>
      <p className="text-sm text-on-surface-variant">The fee invoices of your children that are paid.</p>
      <div className="mt-4"><ChildSelect value={child} onChange={setChild} /></div>
      {paid.length === 0 ? (
        <EmptyState title="No paid invoices yet" hint="Invoices appear here once they are fully paid." />
      ) : (
        <ul className="mt-4 divide-y divide-line">
          {paid.map((i) => (
            <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
              <div className="min-w-0">
                <p className="text-[15px] font-semibold">{i.title}</p>
                <p className="text-[13px] text-on-surface-variant">{state.children.find((c) => c.id === i.childId)?.name} · was due {fmtDate(i.dueDate)} · {i.id}</p>
                <button type="button" onClick={() => setOpen(i.id)} className="mt-1 min-h-8 text-[13px] font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary">View details</button>
              </div>
              <div className="flex items-center gap-6">
                <Badge tone="success">Paid</Badge>
                <span className="w-24 text-right font-bold tabular-nums">{formatSGD(i.amount)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
      <InvoiceDetails charge={charge} child={kid} klass={reg.students.find((s) => s.id === charge?.studentId)?.class} onClose={() => setOpen(null)} />
    </>
  );
}

export default function Transactions() {
  const [params, setParams] = useSearchParams();
  const view: View = params.get("view") === "invoices" ? "invoices" : "transactions";
  return (
    <Card>
      <Segmented<View> label="Show" value={view} onChange={(v) => setParams(v === "invoices" ? { view: v } : {}, { replace: true })} options={[{ value: "transactions", label: "Transactions" }, { value: "invoices", label: "Invoices" }]} />
      <div className="mt-5">{view === "invoices" ? <PaidInvoices /> : <TransactionList />}</div>
    </Card>
  );
}

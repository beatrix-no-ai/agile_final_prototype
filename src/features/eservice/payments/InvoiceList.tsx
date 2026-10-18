import { useEffect, useRef } from "react";
import { Badge, type BadgeTone } from "../../../components/ui/Badge";
import { formatSGD } from "../../../lib/format";
import { isPayable } from "./settle";
import type { Child, Invoice } from "../../../data/parent";

const tone: Record<Invoice["status"], BadgeTone> = { unpaid: "neutral", overdue: "alert", paid: "success" };
const label: Record<Invoice["status"], string> = { unpaid: "Unpaid", overdue: "Overdue", paid: "Paid" };
const box = "size-5 shrink-0 accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
const fmtDate = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("en-SG", { day: "numeric", month: "short", year: "numeric" });

type Props = {
  invoices: Invoice[];
  kids: Child[];
  selected: ReadonlySet<string>;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
};

export function InvoiceList({ invoices, kids, selected, onToggle, onToggleAll }: Props) {
  const payable = invoices.filter(isPayable);
  const allRef = useRef<HTMLInputElement>(null);
  const all = payable.length > 0 && payable.every((i) => selected.has(i.id));
  const some = payable.some((i) => selected.has(i.id));
  useEffect(() => { if (allRef.current) allRef.current.indeterminate = some && !all; }, [some, all]);
  // Unpaid first (overdue, then by due date), paid invoices below (most recent first).
  const rank = { overdue: 0, unpaid: 1, paid: 2 } as const;
  const sorted = [...invoices].sort((a, b) => rank[a.status] - rank[b.status] || (a.status === "paid" ? b.dueDate.localeCompare(a.dueDate) : a.dueDate.localeCompare(b.dueDate)));
  const firstPaid = sorted.findIndex((i) => i.status === "paid");
  const nameOf = (id: string) => kids.find((c) => c.id === id)?.name ?? id;

  return (
    <div>
      <label className="flex min-h-11 cursor-pointer items-center gap-3 border-b border-line pb-2 text-sm font-semibold">
        <input ref={allRef} type="checkbox" className={box} checked={all} disabled={payable.length === 0} onChange={onToggleAll} />
        Select all unpaid and overdue ({payable.length})
      </label>
      <ul className="divide-y divide-line">
        {sorted.map((i, idx) => {
          const paid = i.status === "paid";
          return (
            <li key={i.id}>
              {paid && idx === firstPaid && firstPaid > 0 && <p className="border-t border-line pb-1 pt-4 text-[13px] font-semibold text-on-surface-variant">Already paid</p>}
              <label className={`flex min-h-14 items-center gap-3 py-2 ${paid ? "opacity-60" : "cursor-pointer"}`}>
                <input type="checkbox" className={box} checked={selected.has(i.id)} disabled={paid} onChange={() => onToggle(i.id)} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{i.title}</span>
                  <span className="block text-[13px] text-on-surface-variant">{nameOf(i.childId)} - {i.id} - Due {fmtDate(i.dueDate)}</span>
                </span>
                <Badge tone={tone[i.status]}>{label[i.status]}</Badge>
                <span className="w-24 text-right text-sm font-semibold tabular-nums">{formatSGD(i.amount)}</span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

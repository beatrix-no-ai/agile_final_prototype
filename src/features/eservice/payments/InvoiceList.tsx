import { useEffect, useRef } from "react";
import { Badge, type BadgeTone } from "../../../components/ui/Badge";
import { MOCK_TODAY, type Child, type Invoice } from "../../../data/parent";
import { formatDate, formatSGD } from "../../../lib/format";
import { isPayable, keysOf, partKey } from "./settle";

const tone: Record<Invoice["status"], BadgeTone> = { unpaid: "neutral", overdue: "alert", paid: "success" };
const label: Record<Invoice["status"], string> = { unpaid: "Unpaid", overdue: "Overdue", paid: "Paid" };
const box = "size-6 shrink-0 accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

const day = (iso: string) => Date.parse(`${iso}T00:00:00Z`) / 86_400_000;
const plural = (n: number) => `${n} ${n === 1 ? "day" : "days"}`;
/** Plain-language due line: "Overdue by 12 days", "Due today", "Due in 19 days". */
function dueLine(i: Invoice) {
  const n = Math.round(day(i.dueDate) - day(MOCK_TODAY));
  if (i.status === "paid") return `Paid - was due ${formatDate(i.dueDate)}`;
  if (n < 0) return `Overdue by ${plural(-n)} - was due ${formatDate(i.dueDate)}`;
  return n === 0 ? "Due today" : `Due in ${plural(n)} - ${formatDate(i.dueDate)}`;
}

type Props = {
  invoices: Invoice[];
  kids: Child[];
  selected: ReadonlySet<string>;
  onToggle: (keys: string[]) => void;
  onToggleAll: () => void;
};

export function InvoiceList({ invoices, kids, selected, onToggle, onToggleAll }: Props) {
  const payable = invoices.filter(isPayable);
  const allRef = useRef<HTMLInputElement>(null);
  const all = payable.length > 0 && payable.every((i) => keysOf(i).every((k) => selected.has(k)));
  const some = payable.some((i) => keysOf(i).some((k) => selected.has(k)));
  useEffect(() => { if (allRef.current) allRef.current.indeterminate = some && !all; }, [some, all]);
  // Unpaid first (overdue, then by due date), paid invoices below (most recent first).
  const rank = { overdue: 0, unpaid: 1, paid: 2 } as const;
  const sorted = [...invoices].sort((a, b) => rank[a.status] - rank[b.status] || (a.status === "paid" ? b.dueDate.localeCompare(a.dueDate) : a.dueDate.localeCompare(b.dueDate)));
  const firstPaid = sorted.findIndex((i) => i.status === "paid");
  const kid = (id: string) => kids.find((c) => c.id === id);

  return (
    <div>
      <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-control bg-track px-4 text-sm font-semibold">
        <input ref={allRef} type="checkbox" className={box} checked={all} disabled={payable.length === 0} onChange={onToggleAll} />
        Select all unpaid and overdue ({payable.length})
      </label>
      <ul className="mt-3 space-y-2.5">
        {sorted.map((i, idx) => {
          const paid = i.status === "paid";
          const keys = keysOf(i);
          const on = !paid && keys.every((k) => selected.has(k));
          const partial = !paid && !on && keys.some((k) => selected.has(k));
          const c = kid(i.childId);
          return (
            <li key={i.id}>
              {paid && idx === firstPaid && firstPaid > 0 && <p className="pb-1 pt-5 text-[13px] font-semibold text-on-surface-variant">Already paid</p>}
              <label
                className={`flex min-h-16 flex-wrap items-center gap-x-3 gap-y-2 rounded-control border px-4 py-3 motion-safe:transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary ${
                  paid ? "border-line opacity-60" : on || partial ? "cursor-pointer border-primary bg-primary-fixed/40" : i.status === "overdue" ? "cursor-pointer border-alert/40 bg-error-container/30 hover:border-alert" : "cursor-pointer border-line hover:border-primary-fixed-dim hover:bg-surface-container-low"
                }`}
              >
                <input type="checkbox" className={box} checked={on} ref={(el) => { if (el) el.indeterminate = partial; }} disabled={paid} onChange={() => onToggle(keys)} aria-label={`Pay all of ${i.title}`} />
                <span aria-hidden="true" className="hidden size-10 shrink-0 place-items-center rounded-full bg-primary-fixed text-sm font-bold text-primary sm:grid">{c?.name[0] ?? "?"}</span>
                <span className="min-w-0 flex-1 basis-40">
                  <span className="block text-[15px] font-semibold leading-snug">{i.title}</span>
                  <span className={`mt-0.5 block text-[13px] ${i.status === "overdue" ? "font-medium text-alert" : "text-on-surface-variant"}`}>{c?.name ?? i.childId} - {dueLine(i)}</span>
                  <span className="mt-0.5 block text-xs text-on-surface-variant">Invoice {i.id}</span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1.5 max-sm:ml-9 max-sm:w-full max-sm:flex-row max-sm:items-center max-sm:justify-between">
                  <span className="text-base font-bold tabular-nums">{formatSGD(i.amount)}</span>
                  <Badge tone={tone[i.status]}>{label[i.status]}</Badge>
                </span>
              </label>
              {!paid && (i.parts?.length ?? 0) > 0 && (
                <ul aria-label={`Fee components of ${i.title}`} className="ml-6 mt-1.5 space-y-1 border-l border-line pl-4 sm:ml-9">
                  {i.parts!.map((p) => {
                    const k = partKey(i.id, p.name);
                    return (
                      <li key={k}>
                        <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-control px-2 text-sm hover:bg-surface-container-low has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary">
                          <input type="checkbox" className={box} checked={selected.has(k)} onChange={() => onToggle([k])} />
                          <span className="flex-1">{p.name}</span>
                          <span className="font-semibold tabular-nums">{formatSGD(p.amount)}</span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

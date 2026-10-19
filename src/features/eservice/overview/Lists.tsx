import { ArrowDown, ArrowUp } from "@phosphor-icons/react";
import { Badge } from "../../../components/ui/Badge";
import { Card } from "../../../components/ui/Card";
import { EmptyState } from "../../../components/ui/EmptyState";
import type { Child, Invoice, Transaction } from "../../../data/parent";
import { formatSGD } from "../../../lib/format";
import { Button } from "../../../components/ui/Button";
import { GoLink, fmtDate } from "./shared";

const firstName = (children: Child[], id: string) => children.find((c) => c.id === id)?.name.split(" ")[0] ?? "";

export function UpcomingInvoices({ invoices, children, onPay }: { invoices: Invoice[]; children: Child[]; onPay: (ids: string[]) => void }) {
  // Only what still needs paying: overdue first, then by due date. Paid invoices show on the Transactions page.
  const open = invoices.filter((i) => i.status !== "paid").sort((a, b) => Number(b.status === "overdue") - Number(a.status === "overdue") || a.dueDate.localeCompare(b.dueDate));
  const shown = open.slice(0, 5);
  return (
    <Card title="Invoices to pay" action={open.length > shown.length ? <span className="text-[13px] text-on-surface-variant">Showing {shown.length} of {open.length}</span> : undefined}>
      {open.length === 0 ? (
        <EmptyState title="Nothing to pay" hint="New school invoices will appear here." />
      ) : (
        <ul className="divide-y divide-line">
          {shown.map((i) => (
            <li key={i.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3.5 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <p className="text-[15px] font-semibold">{i.title}</p>
                <p className="text-[13px] text-on-surface-variant">{firstName(children, i.childId)} · due {fmtDate(i.dueDate)}</p>
              </div>
              <div className="flex items-center gap-3">
                <Badge tone={i.status === "overdue" ? "alert" : "neutral"}>{i.status === "overdue" ? "Overdue" : "Unpaid"}</Badge>
                <span className="w-24 text-right text-[15px] font-semibold tabular-nums">{formatSGD(i.amount)}</span>
                <Button size="sm" variant="secondary" aria-label={`Pay ${i.title}`} onClick={() => onPay([i.id])}>Pay</Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
export function RecentTransactions({ transactions, children }: { transactions: Transaction[]; children: Child[] }) {
  const recent = transactions.slice(0, 5);
  return (
    <Card title="Recent transactions" action={<GoLink to="/parent/transactions" label="Transactions" />}>
      {recent.length === 0 ? (
        <EmptyState title="No transactions yet" hint="Payments and top-ups on your children's education accounts will be listed here." />
      ) : (
        <ul className="divide-y divide-line">
          {recent.map((t) => {
            const credit = t.amount > 0;
            const Icon = credit ? ArrowDown : ArrowUp;
            return (
              <li key={t.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <span className="grid size-9 shrink-0 place-items-center rounded-full border-[1.5px] border-primary-fixed text-primary" aria-hidden="true">
                  <Icon size={16} weight="bold" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{t.description}</p>
                  <p className="text-[13px] text-on-surface-variant">{fmtDate(t.date)} - {firstName(children, t.childId)} - {t.method}</p>
                </div>
                <span className={`shrink-0 text-sm font-semibold tabular-nums ${credit ? "text-success" : ""}`}>
                  <span className="sr-only">{credit ? "Credit " : "Payment "}</span>
                  {credit ? "+" : "-"}{formatSGD(Math.abs(t.amount))}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

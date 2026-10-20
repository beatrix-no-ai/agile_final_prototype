import { Badge } from "../../../components/ui/Badge";
import { Card } from "../../../components/ui/Card";
import { EmptyState } from "../../../components/ui/EmptyState";
import type { Child, Invoice } from "../../../data/parent";
import { settle } from "../payments/settle";
import { formatSGD } from "../../../lib/format";
import { Button } from "../../../components/ui/Button";
import { fmtDate } from "./shared";
import { childOutstanding, nextDue, outstanding, paidThisYear } from "./summary";

/** The one thing a parent comes here for: what is owed, and a clear way to pay it. */
export function Summary({ invoices, children, onPay }: { invoices: Invoice[]; children: Child[]; onPay: (ids: string[]) => void }) {
  const openIds = invoices.filter((i) => i.status !== "paid").map((i) => i.id);
  // Education Account balances are used first automatically; only the shortfall goes to card or bank.
  const split = settle(invoices, children, new Set(openIds));
  const owed = outstanding(invoices);
  const unpaid = invoices.filter((i) => i.status !== "paid").length;
  const overdue = invoices.filter((i) => i.status === "overdue").length;
  const due = nextDue(invoices);
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-on-surface-variant">{owed > 0 ? "Amount to pay" : "You are all paid up"}</p>
          <p className={`mt-1 text-4xl font-bold tracking-tight tabular-nums ${overdue ? "text-alert" : "text-on-surface"}`}>{formatSGD(owed)}</p>
          <p className="mt-1 text-sm text-on-surface-variant">
            {unpaid ? `${unpaid} unpaid ${unpaid === 1 ? "invoice" : "invoices"}` : "No unpaid invoices"}
            {overdue > 0 && <span className="font-semibold text-alert"> · {overdue} overdue</span>}
          </p>
        </div>
        {owed > 0 && <Button className="min-h-12 px-6 text-base" aria-label="Pay now for all open invoices" onClick={() => onPay(openIds)}>Pay now</Button>}
      </div>
      {owed > 0 && (
        <p className="mt-4 rounded-control bg-primary-fixed/40 px-4 py-3 text-sm">
          {split.fromAccount > 0
            ? <>Your children's Education Accounts cover <strong className="tabular-nums">{formatSGD(split.fromAccount)}</strong> automatically. {split.fromGateway > 0 ? <>You pay the remaining <strong className="tabular-nums">{formatSGD(split.fromGateway)}</strong> by card or bank.</> : "Nothing more to pay."}</>
            : <>No Education Account balance available, so the full <strong className="tabular-nums">{formatSGD(split.fromGateway)}</strong> is paid by card or bank.</>}
        </p>
      )}
      <dl className="mt-5 grid divide-y divide-line border-t border-line sm:grid-cols-2 sm:divide-x sm:divide-y-0">
        <div className="pt-4 sm:pr-6">
          <dt className="text-[13px] text-on-surface-variant">Next payment due</dt>
          <dd className="mt-0.5 text-sm font-semibold">{due ? <>{fmtDate(due.date)} <span className="font-normal text-on-surface-variant">· {formatSGD(due.amount)}</span></> : overdue ? "Only overdue invoices are left" : "Nothing coming up"}</dd>
        </div>
        <div className="pt-4 sm:pl-6">
          <dt className="text-[13px] text-on-surface-variant">Paid this year</dt>
          <dd className="mt-0.5 text-sm font-semibold">{formatSGD(paidThisYear(invoices))}</dd>
        </div>
      </dl>
    </Card>
  );
}

export function ChildCards({ children, invoices }: { children: Child[]; invoices: Invoice[] }) {
  if (!children.length) {
    return <Card><EmptyState title="No children linked" hint="Children appear here once their Education Account is created at age 7." /></Card>;
  }
  return (
    <Card title="Your children">
      <ul className="divide-y divide-line">
        {children.map((c) => {
          const owed = childOutstanding(invoices, c.id);
          const late = invoices.some((i) => i.childId === c.id && i.status === "overdue");
          return (
            <li key={c.id} className="grid items-center gap-x-6 gap-y-3 py-4 first:pt-0 last:pb-0 sm:grid-cols-[minmax(0,1.3fr)_1fr_1fr_auto]">
              <div className="min-w-0">
                <h3 className="truncate text-[15px] font-semibold">{c.name}</h3>
                <p className="truncate text-[13px] text-on-surface-variant">{c.level} · {c.school}</p>
              </div>
              <div>
                <p className="text-[13px] text-on-surface-variant">Education Account</p>
                <p className="text-lg font-bold tabular-nums">{formatSGD(c.educationBalance)}</p>
              </div>
              <div>
                <p className="text-[13px] text-on-surface-variant">To pay</p>
                <p className={`text-lg font-bold tabular-nums ${late ? "text-alert" : ""}`}>{formatSGD(owed)}</p>
              </div>
              <div className="sm:justify-self-end">
                {owed > 0 ? <Badge tone={late ? "alert" : "warning"}>{late ? "Overdue" : "Payment due"}</Badge> : <Badge tone="success">Paid up</Badge>}
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

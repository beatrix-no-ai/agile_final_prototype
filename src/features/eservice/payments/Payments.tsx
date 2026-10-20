import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle, WarningCircle } from "@phosphor-icons/react";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { EmptyState } from "../../../components/ui/EmptyState";
import { MOCK_TODAY } from "../../../data/parent";
import { useParent } from "../../../data/parentStore";
import { formatSGD } from "../../../lib/format";
import { useMockQuery } from "../../../lib/useMockQuery";
import { GatewayModal } from "./GatewayModal";
import { InvoiceList } from "./InvoiceList";
import { PaymentSummary } from "./PaymentSummary";
import { isPayable, settle } from "./settle";

export default function Payments() {
  const query = useMockQuery(null);
  const { state: data, dispatch } = useParent();
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const msgRef = useRef<HTMLDivElement>(null);
  // Focus the success message only once the gateway dialog has closed (the dialog would otherwise hold focus, then hand it back to a disabled button).
  const focusMsg = useRef(false);
  useEffect(() => { if (!open && focusMsg.current) { focusMsg.current = false; msgRef.current?.focus(); } }, [open]);

  const summary = useMemo(() => settle(data.invoices, data.children, selected), [data, selected]);
  const payable = data.invoices.filter(isPayable);
  const payableIds = payable.map((i) => i.id);
  const owed = payable.reduce((n, i) => n + i.amount, 0);
  const overdue = payable.filter((i) => i.status === "overdue");
  const toUse = new Map(summary.lines.map((l) => [l.child.id, l.fromAccount]));

  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (!n.delete(id)) n.add(id); return n; });
  const toggleAll = () => setSelected((s) => (payableIds.every((id) => s.has(id)) ? new Set() : new Set(payableIds)));

  const onPaid = useCallback(() => {
    dispatch({ type: "pay", ids: [...selected], date: MOCK_TODAY });
    setMessage(`Payment of ${formatSGD(summary.total)} received for ${selected.size} ${selected.size === 1 ? "invoice" : "invoices"}.`);
    setSelected(new Set());
    focusMsg.current = true;
  }, [dispatch, selected, summary.total]);

  return (
    <div className="space-y-4 pb-24 lg:pb-0">
      <div ref={msgRef} tabIndex={-1} aria-live="polite" className="outline-none empty:hidden">
        {message && (
          <p className="flex flex-wrap items-center gap-2 rounded-control border border-line bg-success-container px-3 py-2 text-sm font-medium text-success">
            <CheckCircle size={18} weight="bold" aria-hidden="true" /> {message}
          </p>
        )}
      </div>
      {query.status === "loading" && <div aria-busy="true" aria-label="Loading payments" className="space-y-3">{[0, 1, 2, 3].map((i) => <div key={i} className="h-14 motion-safe:animate-pulse rounded-control bg-track" />)}</div>}
      {query.status === "error" && <Card><EmptyState title="Could not load invoices" hint="Check your connection and try again." action={<Button onClick={query.retry}>Retry</Button>} /></Card>}
      {query.status === "ready" && (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_24rem]">
          <div className="space-y-4">
            <section aria-label="Your balances" className="rounded-card border border-line bg-surface-container-lowest px-6 py-5">
              <h2 className="text-[13px] font-semibold text-on-surface-variant">Education Account balances</h2>
              <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                {data.children.map((c) => (
                  <li key={c.id} className="flex items-center gap-3 rounded-control border border-line px-4 py-3">
                    <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-full bg-primary-fixed text-base font-bold text-primary">{c.name[0]}</span>
                    <span className="min-w-0">
                      <span className="block text-[13px] text-on-surface-variant">{c.name} - {c.level}</span>
                      <span className="block text-2xl font-bold tabular-nums text-primary">{formatSGD(c.educationBalance)}</span>
                      {(toUse.get(c.id) ?? 0) > 0 && <span className="block text-xs font-medium text-primary">Using {formatSGD(toUse.get(c.id)!)} for this payment</span>}
                    </span>
                  </li>
                ))}
              </ul>
              {payable.length > 0 && (
                <p className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-t border-line pt-4 text-sm text-on-surface-variant">
                  <span>You have to pay <strong className="text-xl font-bold tabular-nums text-on-surface">{formatSGD(owed)}</strong> across {payable.length} {payable.length === 1 ? "invoice" : "invoices"}</span>
                  {overdue.length > 0 && <span className="inline-flex items-center gap-1 font-semibold text-alert"><WarningCircle size={16} weight="fill" aria-hidden="true" />{overdue.length} overdue</span>}
                </p>
              )}
            </section>
            <Card title="Outstanding invoices">
              {payableIds.length === 0 ? (
                <EmptyState title="All invoices are paid" hint="You have no outstanding charges." />
              ) : (
                <InvoiceList invoices={data.invoices} kids={data.children} selected={selected} onToggle={toggle} onToggleAll={toggleAll} />
              )}
            </Card>
          </div>
          <PaymentSummary summary={summary} onAuthorize={() => setOpen(true)} />
        </div>
      )}
      <GatewayModal open={open} summary={summary} onClose={() => setOpen(false)} onPaid={onPaid} />
    </div>
  );
}

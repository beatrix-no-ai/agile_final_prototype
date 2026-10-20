import { LockKey } from "@phosphor-icons/react";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { formatSGD } from "../../../lib/format";
import type { Summary } from "./settle";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 py-1.5 text-sm">
      <dt className="text-on-surface-variant">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  );
}

type Props = { summary: Summary; onAuthorize: () => void };

export function PaymentSummary({ summary, onAuthorize }: Props) {
  const { total, fromAccount, fromGateway, lines } = summary;
  const empty = total <= 0;
  const payLabel = empty ? "Choose invoices to pay" : `Pay ${formatSGD(total)}`;
  return (
    <>
      <Card title="Payment summary" className="lg:sticky lg:top-4">
        <div aria-live="polite" className="rounded-control bg-primary-fixed/40 px-4 py-4 text-center">
          <p className="text-[13px] font-medium text-on-surface-variant">Total to pay</p>
          <p className="mt-1 text-[32px] font-bold leading-none tracking-tight tabular-nums text-primary">{formatSGD(total)}</p>
          <p className="mt-2 text-[13px] text-on-surface-variant">
            {empty ? "Tick an invoice to get started." : `For ${lines.map((l) => l.child.name.split(" ")[0]).join(" and ")}`}
          </p>
        </div>

        <dl className="mt-5 border-t border-line pt-3">
          {lines.map((l) => (
            <Row key={l.child.id} label={`${l.child.name} (${l.child.level})`} value={formatSGD(l.total)} />
          ))}
          {!empty && (
            <div className="mt-2 space-y-0.5 rounded-control bg-track px-3 py-2">
              <Row label="From Education Account" value={formatSGD(fromAccount)} />
              <Row label="By card or bank" value={formatSGD(fromGateway)} />
            </div>
          )}
        </dl>

        <Button className="mt-5 hidden min-h-12 w-full text-base lg:inline-flex" disabled={empty} onClick={onAuthorize} icon={empty ? undefined : <LockKey size={18} weight="bold" aria-hidden="true" />}>{payLabel}</Button>
        <p className="mt-3 hidden items-center justify-center gap-1.5 text-xs text-on-surface-variant lg:flex"><LockKey size={14} aria-hidden="true" /> You'll review everything before any money moves.</p>
      </Card>

      {/* Phone/tablet: the summary sits far below the invoices, so keep the total and the pay button in reach. */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface-container-lowest px-4 py-3 lg:hidden">
        <div className="mx-auto flex max-w-3xl items-center gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-on-surface-variant">Total to pay</p>
            <p className="text-xl font-bold tabular-nums text-primary">{formatSGD(total)}</p>
          </div>
          <Button className="min-h-12 shrink-0 px-6 text-base" disabled={empty} onClick={onAuthorize}>{empty ? "Choose invoices" : "Pay now"}</Button>
        </div>
      </div>
    </>
  );
}

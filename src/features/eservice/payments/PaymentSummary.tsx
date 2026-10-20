import { Bank, CreditCard, GraduationCap, LockKey } from "@phosphor-icons/react";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { formatSGD } from "../../../lib/format";
import type { Mode, Summary } from "./settle";

const OPTIONS: { value: Mode; title: string; hint: string; Icon: typeof Bank }[] = [
  { value: "account-first", title: "Use Education Account first", hint: "Each child's balance pays that child's invoices. Any shortfall is paid by card or bank.", Icon: GraduationCap },
  { value: "gateway", title: "Pay all by card or bank", hint: "Education Account balances stay untouched.", Icon: CreditCard },
];

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 py-1.5 text-sm">
      <dt className="text-on-surface-variant">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  );
}

type Props = { summary: Summary; mode: Mode; onMode: (m: Mode) => void; onAuthorize: () => void };

export function PaymentSummary({ summary, mode, onMode, onAuthorize }: Props) {
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

        <fieldset className="mt-5">
          <legend className="mb-2 text-[13px] font-semibold">How would you like to pay?</legend>
          <div className="space-y-2">
            {OPTIONS.map(({ value, title, hint, Icon }) => (
              <label key={value} className={`flex min-h-14 cursor-pointer items-start gap-3 rounded-control border p-3.5 motion-safe:transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary ${mode === value ? "border-primary bg-primary-fixed/40" : "border-line hover:border-primary-fixed-dim"}`}>
                <input type="radio" name="pay-mode" className="mt-0.5 size-5 shrink-0 accent-primary" checked={mode === value} onChange={() => onMode(value)} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 text-sm font-semibold"><Icon size={18} weight="bold" aria-hidden="true" className="text-primary" />{title}</span>
                  <span className="mt-1 block text-[13px] text-on-surface-variant">{hint}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

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

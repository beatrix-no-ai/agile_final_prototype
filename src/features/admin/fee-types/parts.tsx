import { useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { Badge, type BadgeTone } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { inputClass } from "../../../components/ui/Field";
import { Modal } from "../../../components/ui/Modal";
import type { Charge, ChargeStatus, FeeType, PayMethod } from "../../../data/fees";
import { STUDENTS } from "../../../data/students";
import { formatDate, formatSGD } from "../../../lib/format";
import { balanceOf, chargeStatus, feeOf, paidOf, paidOnOf, payableOf, subsidyOf } from "../../../lib/fees";
import { maskNric } from "../../../lib/nric";

const TONE: Record<ChargeStatus, BadgeTone> = { paid: "success", outstanding: "warning", overdue: "alert" };
export const STATUS_LABEL: Record<ChargeStatus, string> = { paid: "Paid", outstanding: "Outstanding", overdue: "Overdue" };
export const StatusBadge = ({ status }: { status: ChargeStatus }) => <Badge tone={TONE[status]}>{STATUS_LABEL[status]}</Badge>;

export const studentOf = (id: string) => STUDENTS.find((s) => s.id === id);

export function Tiles({ items }: { items: { label: string; value: ReactNode; note?: ReactNode; alert?: boolean; good?: boolean }[] }) {
  return (
    <div className="grid divide-y divide-line rounded-card border border-line bg-surface-container-lowest sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
      {items.map((t) => (
        <div key={t.label} className="px-5 py-4">
          <div className="text-[13px] font-medium text-on-surface-variant">{t.label}</div>
          <div className={`mt-1 text-2xl font-bold leading-tight tracking-tight ${t.alert ? "text-alert" : t.good ? "text-success" : "text-on-surface"}`}>{t.value}</div>
          {t.note && <div className="mt-0.5 text-[13px] text-on-surface-variant">{t.note}</div>}
        </div>
      ))}
    </div>
  );
}

export const selectClass = "min-h-11 rounded-control border border-outline bg-surface-container-lowest px-3 text-sm text-on-surface focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary";

function KV({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line py-2.5 text-sm last:border-0">
      <dt className="text-on-surface-variant">{k}</dt>
      <dd className="text-right font-semibold text-on-surface">{v}</dd>
    </div>
  );
}

/** A labelled value: small grey label over the value. */
function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[13px] text-on-surface-variant">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold text-on-surface">{children}</dd>
    </div>
  );
}

/** One charge: what is owed, how it is made up, what has been paid, and a form to record the next payment. */
export function ChargeModal({ charge, feeName, onClose, onPay }: { charge: Charge | null; feeName?: string; onClose: () => void; onPay?: (chargeId: string, amount: number, method: PayMethod) => void }) {
  const st = charge && studentOf(charge.studentId);
  const status = charge ? chargeStatus(charge) : "outstanding";
  const balance = charge ? balanceOf(charge) : 0;
  return (
    <Modal open={!!charge} onClose={onClose} title={charge ? charge.title : "Charge"} footer={<Button variant="secondary" onClick={onClose}>Close</Button>}>
      {charge && <ChargeBody key={charge.id + charge.payments.length} charge={charge} feeName={feeName} st={st} status={status} balance={balance} onPay={onPay} />}
    </Modal>
  );
}

function ChargeBody({ charge, feeName, st, status, balance, onPay }: {
  charge: Charge; feeName?: string; st: ReturnType<typeof studentOf> | null; status: ChargeStatus; balance: number;
  onPay?: (chargeId: string, amount: number, method: PayMethod) => void;
}) {
  const [amount, setAmount] = useState(balance.toFixed(2));
  const [method, setMethod] = useState<PayMethod>("Education account");
  const [err, setErr] = useState("");
  const pay = () => {
    const n = Number(amount);
    if (!/^\d+(\.\d{1,2})?$/.test(amount.trim()) || n <= 0) return setErr("Enter an amount above 0 (max 2 decimals).");
    if (n > balance + 0.005) return setErr(`At most the remaining ${formatSGD(balance)}.`);
    setErr("");
    onPay?.(charge.id, n, method);
  };
  const paidOn = paidOnOf(charge);
  const payable = payableOf(charge);
  const paid = paidOf(charge);
  const subsidy = subsidyOf(charge);
  const pct = payable > 0 ? Math.min(100, (paid / payable) * 100) : 100;
  const hasSubsidy = subsidy > 0;
  const tone = status === "paid" ? "text-success" : status === "overdue" ? "text-alert" : "text-on-surface";
  const when = status === "paid" ? (paidOn ? `Paid on ${formatDate(paidOn)}` : "Fully paid") : status === "overdue" ? `Was due ${formatDate(charge.due)}` : `Due ${formatDate(charge.due)}`;
  return (
    <div className="grid gap-5">
      <section className="rounded-card border border-line bg-surface-container-low p-5" aria-label="Amount">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[13px] font-medium text-on-surface-variant">{status === "paid" ? "Nothing left to pay" : "Still to pay"}</p>
            <p className={`mt-0.5 text-3xl font-bold tracking-tight tabular-nums ${tone}`}>{formatSGD(balance)}</p>
            <p className="mt-1 text-sm text-on-surface-variant">{when}</p>
          </div>
          <StatusBadge status={status} />
        </div>
        <div role="progressbar" aria-label="Paid so far" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} className="mt-4 h-2 overflow-hidden rounded-full bg-track">
          <div className="h-full rounded-full bg-success" style={{ width: `${pct}%` }} />
        </div>
        <dl className={`mt-3 grid gap-4 text-sm ${hasSubsidy ? "grid-cols-3" : "grid-cols-2"}`}>
          <Fact label={hasSubsidy ? "Fee" : "Total fee"}>{formatSGD(feeOf(charge))}</Fact>
          {hasSubsidy && <Fact label="Subsidy"><span className="text-success">− {formatSGD(subsidy)}</span></Fact>}
          <Fact label="Paid so far">{formatSGD(paid)}</Fact>
        </dl>
      </section>

      <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
        <Fact label="Student">{st ? <>{st.name} <span className="font-normal text-on-surface-variant">{maskNric(st.nric)}</span></> : charge.studentId}</Fact>
        {st && <Fact label="Level / class">{st.level}, {st.class}</Fact>}
        <Fact label="Issued">{formatDate(charge.issued)}</Fact>
        <Fact label="Due">{formatDate(charge.due)}</Fact>
        {feeName && <Fact label="Bill">{feeName}</Fact>}
        <Fact label="Charge number">{charge.id}</Fact>
      </dl>

      {charge.fas && (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-control border border-line bg-surface-container-low px-3 py-2.5 text-sm">
          <Link to="/admin/fas" className="rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"><Badge tone="primary">{charge.fas} applied</Badge></Link>
          <span>
            The subsidy of <strong>{formatSGD(subsidy)}</strong> is taken off the fee of {formatSGD(feeOf(charge))}, so <strong>{formatSGD(payable)}</strong> is payable. It is separate from MOE top-ups, which add to the Education Account balance.
          </span>
        </p>
      )}

      <section aria-label="What the fee covers">
        <h4 className="text-sm font-semibold text-on-surface">What the fee covers</h4>
        <ul className="mt-1 divide-y divide-line">
          {charge.components.map((c) => {
            const off = Math.min(c.subsidy ?? 0, c.amount);
            return (
              <li key={c.name} className="flex items-baseline justify-between gap-4 py-2.5 text-sm">
                <span>{c.name}</span>
                <span className="text-right tabular-nums">
                  {off > 0 && <span className="mr-3 text-[13px] text-success">− {formatSGD(off)} subsidy</span>}
                  {formatSGD(c.amount - off)}
                </span>
              </li>
            );
          })}
          <li className="flex items-baseline justify-between gap-4 py-2.5 text-sm font-semibold">
            <span>{hasSubsidy ? "Total payable" : "Total"}</span>
            <span className="tabular-nums text-primary">{formatSGD(payable)}</span>
          </li>
        </ul>
      </section>

      <section aria-label="Payments received">
        <h4 className="text-sm font-semibold text-on-surface">Payments received</h4>
        {charge.payments.length ? (
          <ul className="mt-1 divide-y divide-line">
            {charge.payments.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-4 py-2.5 text-sm">
                <span>
                  <span className="block font-medium">{p.method}</span>
                  <span className="block text-[13px] text-on-surface-variant">{formatDate(p.on)} · Receipt {p.id}</span>
                </span>
                <span className="font-semibold tabular-nums text-success">{formatSGD(p.amount)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-sm text-on-surface-variant">Nothing paid yet. The full amount is still to pay.</p>
        )}
      </section>

      {balance > 0.005 && onPay && (
        <section aria-label="Record a payment" className="rounded-card border border-line p-4">
          <h4 className="text-sm font-semibold text-on-surface">Record a payment</h4>
          <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <label className="block text-sm">
              <span className="mb-1 block text-[13px] font-medium text-on-surface-variant">Amount (up to {formatSGD(balance)})</span>
              <input className={inputClass} inputMode="decimal" value={amount} onChange={(e) => { setAmount(e.target.value); setErr(""); }} />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-[13px] font-medium text-on-surface-variant">Paid from</span>
              <select className={inputClass} value={method} onChange={(e) => setMethod(e.target.value as PayMethod)}>
                <option value="Education account">Education account</option>
                <option value="Card / PayNow">Card / PayNow (gateway)</option>
              </select>
            </label>
            <Button onClick={pay}>Record payment</Button>
          </div>
          {err && <p role="alert" className="mt-2 text-[13px] font-medium text-alert">{err}</p>}
        </section>
      )}
    </div>
  );
}
/** A fee type's components, read-only (used by the HQ drill-down). */
export function FeeTypeModal({ fee, used, onClose }: { fee: FeeType | null; used: number; onClose: () => void }) {
  return (
    <Modal open={!!fee} onClose={onClose} title={fee ? `Fee type: ${fee.name}` : "Fee type"} footer={<Button variant="secondary" onClick={onClose}>Close</Button>}>
      {fee && (
        <>
          <dl>
            <KV k="Fee type" v={`${fee.id}, ${fee.level ?? "All levels"}`} />
            <KV k="Updated" v={fee.updated} />
            <KV k="Students charged" v={used} />
          </dl>
          <table className="mt-4 w-full text-sm">
            <tbody>
              {fee.components.map((c) => <tr key={c.name} className="border-b border-line"><td className="py-2">{c.name}</td><td className="text-right tabular-nums">{formatSGD(c.amount)}</td></tr>)}
              <tr className="font-semibold"><td className="py-2">Total</td><td className="text-right tabular-nums text-primary">{formatSGD(fee.components.reduce((t, c) => t + c.amount, 0))}</td></tr>
            </tbody>
          </table>
          <p className="mt-3 text-[13px] text-on-surface-variant">Set by the school. Issued charges keep the amounts from when they were generated.</p>
        </>
      )}
    </Modal>
  );
}

/** Single-choice filter chips with counts. */
export function Chips<T extends string>({ label, value, onChange, options }: { label: string; value: T; onChange: (v: T) => void; options: { value: T; label: string; count: number }[] }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={`min-h-9 rounded-full border px-3 text-[13px] font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${value === o.value ? "border-primary bg-primary text-on-primary" : "border-line bg-surface-container-lowest text-on-surface hover:bg-surface-container-low"}`}
        >
          {o.label} <span className={value === o.value ? "opacity-80" : "text-on-surface-variant"}>{o.count}</span>
        </button>
      ))}
    </div>
  );
}

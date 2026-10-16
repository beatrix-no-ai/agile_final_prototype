import type { ReactNode } from "react";
import { Badge, type BadgeTone } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Modal } from "../../../components/ui/Modal";
import type { Charge, ChargeStatus, FeeType } from "../../../data/fees";
import { STUDENTS } from "../../../data/students";
import { formatSGD } from "../../../lib/format";
import { feeOf, payableOf } from "../../../lib/fees";

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

/** One charge with its per-component fee and payable amount. */
export function ChargeModal({ charge, feeName, onClose }: { charge: Charge | null; feeName?: string; onClose: () => void }) {
  const st = charge && studentOf(charge.studentId);
  return (
    <Modal open={!!charge} onClose={onClose} title={charge ? `Charge ${charge.id}` : "Charge"} footer={<Button variant="secondary" onClick={onClose}>Close</Button>}>
      {charge && (
        <>
          <dl>
            <KV k="Student" v={st ? `${st.name} (${st.id})` : charge.studentId} />
            {st && <KV k="Level / class" v={`${st.level}, ${st.class}`} />}
            <KV k="Charge" v={`${charge.title}, ${charge.term}`} />
            {feeName && <KV k="Fee type" v={feeName} />}
            <KV k="Issued / due" v={`${charge.issued} to ${charge.due}`} />
            {charge.status === "paid" && charge.paidOn && <KV k="Paid on" v={charge.paidOn} />}
            <KV k="Status" v={<StatusBadge status={charge.status} />} />
          </dl>
          <table className="mt-4 w-full text-sm">
            <thead><tr className="border-b border-line text-left text-[13px] text-on-surface-variant"><th className="py-2 font-semibold">Component</th><th className="text-right font-semibold">Fee</th><th className="text-right font-semibold">Payable</th></tr></thead>
            <tbody>
              {charge.components.map((c) => (
                <tr key={c.name} className="border-b border-line">
                  <td className="py-2">{c.name}</td>
                  <td className="text-right tabular-nums">{formatSGD(c.amount)}</td>
                  <td className="text-right tabular-nums">{formatSGD(c.amount - Math.min(c.subsidy ?? 0, c.amount))}</td>
                </tr>
              ))}
              <tr className="font-semibold">
                <td className="py-2">Total</td>
                <td className="text-right tabular-nums">{formatSGD(feeOf(charge))}</td>
                <td className="text-right tabular-nums text-primary">{formatSGD(payableOf(charge))}</td>
              </tr>
            </tbody>
          </table>
        </>
      )}
    </Modal>
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

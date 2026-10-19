import { useEffect, useLayoutEffect, useState, type ReactNode } from "react";
import { CheckCircle, CircleNotch, WarningOctagon } from "@phosphor-icons/react";
import { Button } from "../../../components/ui/Button";
import { Modal } from "../../../components/ui/Modal";
import { formatSGD } from "../../../lib/format";
import type { Summary } from "./settle";

type Phase = "review" | "processing" | "success" | "failed";
type Props = { open: boolean; summary: Summary; onClose: () => void; onPaid: () => void };

const TITLE: Record<Phase, string> = {
  review: "Confirm your payment",
  processing: "Processing payment",
  success: "Payment successful",
  failed: "Payment not completed",
};

/** Big centred icon + headline + detail, shared by the processing / success / failed states. */
function Outcome({ icon, title, children, role, big }: { icon: ReactNode; title: string; children?: ReactNode; role?: "status" | "alert"; big?: boolean }) {
  return (
    <div role={role} className="flex flex-col items-center px-2 py-4 text-center">
      {icon}
      <p className={`mt-4 font-semibold text-on-surface ${big ? "text-3xl font-bold tracking-tight tabular-nums" : "text-base"}`}>{title}</p>
      {children && <p className="mt-1.5 max-w-xs text-sm">{children}</p>}
    </div>
  );
}

/** Simulated payment gateway. ASSUMPTION: no real gateway; processing takes 1.5s and can be forced to fail. */
export function GatewayModal({ open, summary, onClose, onPaid }: Props) {
  const [phase, setPhase] = useState<Phase>("review");
  const [fail, setFail] = useState(false);
  // Freeze the summary at open: the page's selection is cleared once the payment succeeds.
  const [snap, setSnap] = useState(summary);
  // Reset on open AND close, before paint, so a reopened dialog never flashes the previous phase or summary.
  useLayoutEffect(() => {
    setPhase("review"); setFail(false); setSnap(summary);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- snapshot only when the modal opens or closes
  }, [open]);

  useEffect(() => {
    if (phase !== "processing") return;
    const id = setTimeout(() => {
      if (fail) return setPhase("failed");
      setPhase("success");
      onPaid();
    }, 1500);
    return () => clearTimeout(id);
  }, [phase, fail, onPaid]);

  const busy = phase === "processing";
  const viaGateway = snap.fromGateway > 0;
  const footer =
    phase === "review" ? (
      <>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button className="min-h-12 px-6" onClick={() => setPhase("processing")}>{viaGateway ? `Pay ${formatSGD(snap.fromGateway)}` : "Confirm payment"}</Button>
      </>
    ) : phase === "failed" ? (
      <>
        <Button variant="secondary" onClick={onClose}>Close</Button>
        <Button onClick={() => { setFail(false); setPhase("review"); }}>Try again</Button>
      </>
    ) : phase === "success" ? (
      <Button className="w-full" onClick={onClose}>Done</Button>
    ) : null;

  return (
    <Modal open={open} onClose={() => !busy && onClose()} title={TITLE[phase]} footer={footer}>
      <div aria-live="polite">
        {phase === "review" && (
          <>
            <div className="rounded-control bg-primary-fixed/40 px-4 py-4 text-center">
              <p className="text-[13px] font-medium">Total</p>
              <p className="mt-1 text-[32px] font-bold leading-none tracking-tight tabular-nums text-primary">{formatSGD(snap.total)}</p>
            </div>
            <dl className="mt-3 divide-y divide-line text-on-surface">
              <div className="flex justify-between py-2.5"><dt className="text-on-surface-variant">From Education Account</dt><dd className="font-medium tabular-nums">{formatSGD(snap.fromAccount)}</dd></div>
              <div className="flex justify-between py-2.5"><dt className="text-on-surface-variant">By card or bank</dt><dd className="font-medium tabular-nums">{formatSGD(snap.fromGateway)}</dd></div>
            </dl>
            {!viaGateway && <p className="mt-2">Fully covered by the Education Account, so no card or bank payment is needed.</p>}
            <label className="mt-4 flex min-h-11 cursor-pointer items-center gap-3 rounded-control border border-dashed border-line px-3 text-[13px]">
              <input type="checkbox" className="size-5 accent-primary" checked={fail} onChange={(e) => setFail(e.target.checked)} />
              Demo only: simulate a failed payment
            </label>
          </>
        )}
        {phase === "processing" && (
          <Outcome role="status" icon={<CircleNotch size={48} className="text-primary motion-safe:animate-spin" aria-hidden="true" />} title="Processing payment, please wait...">
            Please don't close this window.
          </Outcome>
        )}
        {phase === "success" && (
          <Outcome big icon={<CheckCircle size={96} weight="fill" className="text-success" aria-hidden="true" />} title={`${formatSGD(snap.total)} paid`} />
        )}
        {phase === "failed" && (
          <Outcome role="alert" icon={<WarningOctagon size={56} weight="fill" className="text-alert" aria-hidden="true" />} title="The gateway declined this payment">
            Nothing was charged and your invoices are unchanged.
          </Outcome>
        )}
      </div>
    </Modal>
  );
}

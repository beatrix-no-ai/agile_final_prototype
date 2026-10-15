import { useEffect, useRef, useState } from "react";

export const cash = (x: number) => "S$" + Number(x || 0).toLocaleString("en-SG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const sgToday = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Singapore" });

export type DialogSpec = { title: string; text: string; details: string; confirmLabel: string; onConfirm: () => void };

/** Confirm dialog from the prototype: title, line of text, pre-line summary box, Cancel / Confirm. */
export function Dialog({ spec, onClose }: { spec: DialogSpec | null; onClose: () => void }) {
  useEffect(() => {
    if (!spec) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [spec, onClose]);
  if (!spec) return null;
  return (
    <div className="modal-shade" role="dialog" aria-modal="true" aria-labelledby="tu-dialog-title">
      <div className="dialog">
        <h2 id="tu-dialog-title">{spec.title}</h2>
        <p>{spec.text}</p>
        <div className="dialog-summary">{spec.details}</div>
        <div className="buttons">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="button" className="btn primary" autoFocus onClick={spec.onConfirm}>{spec.confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

/** Dark toast, auto-hides after 3.4s. */
export function useToast() {
  const [msg, setMsg] = useState("");
  const timer = useRef<number | undefined>(undefined);
  const notify = (m: string) => { setMsg(m); window.clearTimeout(timer.current); timer.current = window.setTimeout(() => setMsg(""), 3400); };
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return { notify, toast: msg ? <div className="notice" role="status">{msg}</div> : null };
}

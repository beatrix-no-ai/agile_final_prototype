import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "@phosphor-icons/react";

// Body scroll lock is refcounted across open modals, so closing them in any order restores the original overflow once.
let locks = 0;
let savedOverflow = "";

type Props = { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; /** Wider panel with a scrollable body, for content-rich dialogs (e.g. a review with the full application). */ wide?: boolean };

/** Native <dialog> modal: showModal() gives focus trap + inert background; Esc and backdrop click call onClose. */
export function Modal({ open, onClose, title, children, footer, wide }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      opener.current = document.activeElement as HTMLElement | null;
      d.showModal();
      // React's autoFocus prop runs while the dialog is still closed (display:none) and is lost, and React does not
      // render it as an attribute. To focus a field on open, give it `data-autofocus` (or a native `autofocus`
      // attribute); the first match gets focus, otherwise the browser's default (first focusable) applies.
      d.querySelector<HTMLElement>("[data-autofocus],[autofocus]")?.focus();
    } else if (!open && d.open) {
      d.close();
      opener.current?.focus();
    }
  }, [open]);

  // Scroll lock while open; restored on close/unmount.
  useEffect(() => {
    if (!open) return;
    if (locks++ === 0) savedOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      if (--locks === 0) document.body.style.overflow = savedOverflow;
    };
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      // Native close (e.g. <form method="dialog"> inside) must not desync `open`.
      onClose={() => {
        if (open) onClose();
      }}
      // Esc: keep the dialog controlled by `open` instead of letting the browser close it.
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      // Padding lives on the inner div, so a click whose target is the dialog itself is a backdrop click.
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={wide
        ? "m-auto w-[min(64rem,calc(100vw-2rem))] rounded-card border border-line bg-surface-container-lowest p-0 text-on-surface backdrop:bg-inverse-surface/40"
        : "m-auto w-[min(32rem,calc(100vw-2rem))] rounded-card border border-line bg-surface-container-lowest p-0 text-on-surface backdrop:bg-inverse-surface/40"}
    >
      <div className={wide ? "max-h-[calc(100vh-4rem)] overflow-y-auto p-6" : "p-6"}>
        <div className="flex items-start justify-between gap-4">
          <h2 id={titleId} className="text-lg font-bold">{title}</h2>
          <button
            type="button"
            aria-label="Close dialog"
            onClick={onClose}
            className="grid size-11 shrink-0 place-items-center rounded-full border border-line text-primary hover:bg-primary-fixed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <X size={18} weight="bold" aria-hidden="true" />
          </button>
        </div>
        <div className="mt-4 text-sm text-on-surface-variant">{children}</div>
        {footer && <div className="mt-6 flex flex-wrap justify-end gap-3">{footer}</div>}
      </div>
    </dialog>
  );
}

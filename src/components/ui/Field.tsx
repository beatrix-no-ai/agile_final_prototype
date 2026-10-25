import { Children, cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from "react";

type Props = { label: string; required?: boolean; error?: string; hint?: ReactNode; className?: string; children: ReactNode };

/** Shared class for text inputs / selects placed inside <Field>. */
export const inputClass =
  "min-h-11 w-full rounded-control border border-outline bg-surface-container-lowest px-3 text-sm text-on-surface placeholder:text-on-surface-variant focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary aria-[invalid=true]:border-alert";

/**
 * Label above, hint and error below (both shown if both given). The single child control gets
 * id / aria-describedby / aria-invalid; a consumer-supplied id is kept and describedby ids are merged.
 */
export function Field({ label, required, error, hint, className, children }: Props) {
  const gen = useId();
  const child = Children.only(children);
  const props = isValidElement(child) ? (child.props as Record<string, unknown>) : {};
  const id = (props.id as string | undefined) ?? gen;
  const hintId = `${gen}-h`;
  const errId = `${gen}-e`;
  const describedBy =
    [props["aria-describedby"] as string | undefined, hint && hintId, error && errId].filter(Boolean).join(" ") || undefined;
  const control = isValidElement(child)
    ? cloneElement(child as ReactElement<Record<string, unknown>>, {
        id,
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : props["aria-invalid"],
      })
    : child;
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-semibold text-on-surface">{label}{required && <span aria-hidden className="ml-0.5 text-alert">*</span>}</label>
      {control}
      {hint && <p id={hintId} className="mt-1.5 text-[13px] text-on-surface-variant">{hint}</p>}
      {error && <p id={errId} role="alert" className="mt-1.5 text-[13px] font-medium text-alert">{error}</p>}
    </div>
  );
}

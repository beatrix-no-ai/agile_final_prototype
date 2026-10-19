import { ArrowRight } from "@phosphor-icons/react";
import { Link } from "react-router";

const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });
/** ISO yyyy-mm-dd -> "31 Oct 2026". */
export const fmtDate = (iso: string) => dateFmt.format(new Date(`${iso}T00:00:00`));

/** The "move" button each Overview card uses to open its own page. */
export function GoLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="inline-flex min-h-9 items-center gap-1.5 rounded-control border border-line px-3 text-[13px] font-semibold text-primary motion-safe:transition-colors hover:border-primary-fixed-dim hover:bg-primary-fixed/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary pointer-coarse:min-h-11"
    >
      {label} <ArrowRight size={14} weight="bold" aria-hidden="true" />
    </Link>
  );
}

import { Warning, WarningOctagon } from "@phosphor-icons/react";
import { budgetAlertText, budgetStatus } from "../../../lib/budget";

/** Warning banner for a budget that is nearly used, fully used or exceeded. Renders nothing while it is fine. */
export function BudgetAlert({ name, used, budget }: { name: string; used: number; budget: number }) {
  const text = budgetAlertText(name, used, budget);
  if (!text) return null;
  const over = budgetStatus(used, budget) === "over";
  const Icon = over ? WarningOctagon : Warning;
  return (
    <p
      role="status"
      className={`flex items-start gap-2 rounded-control border border-line px-3 py-2.5 text-sm font-medium ${over ? "bg-error-container text-alert" : "bg-warning-container text-warning"}`}
    >
      <Icon size={18} weight="bold" className="mt-0.5 shrink-0" aria-hidden="true" />
      {text}
    </p>
  );
}

import { Card } from "../../../components/ui/Card";
import { EmptyState } from "../../../components/ui/EmptyState";
import type { BudgetChange } from "../../../data/fasStore";
import { formatDate, formatSGD } from "../../../lib/format";

/** Every budget change with old value, new value, who and when. Newest first. */
export function BudgetHistory({ changes }: { changes: BudgetChange[] }) {
  return (
    <Card title="Budget history">
      {changes.length === 0 ? (
        <EmptyState title="No changes yet" hint="Each time a budget is set or revised it is listed here." />
      ) : (
        <ul className="divide-y divide-line">
          {changes.map((c) => (
            <li key={c.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3 text-sm first:pt-0 last:pb-0">
              <span className="font-semibold">
                {c.target === c.scope ? c.scope : `${c.scope} - ${c.target}`}
                <span className="ml-2 font-normal text-on-surface-variant">{formatSGD(c.from)} to {formatSGD(c.to)}</span>
              </span>
              <span className="text-[13px] text-on-surface-variant">{c.by} · {formatDate(c.at)}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

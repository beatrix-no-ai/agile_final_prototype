import { ArrowDown, ArrowUp } from "@phosphor-icons/react";
import { Card } from "../../../components/ui/Card";
import { useParent } from "../../../data/parentStore";
import { formatSGD } from "../../../lib/format";
import { fmtDate } from "../overview/shared";

export default function Transactions() {
  const { state } = useParent();
  return (
    <Card title="Education Account transactions">
      <p className="mb-4 text-sm text-on-surface-variant">A complete record of top-ups, payments and refunds for your children.</p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] text-left text-sm">
          <thead className="border-b border-line text-[13px] text-on-surface-variant">
            <tr><th className="pb-3 pr-4 font-medium">Date</th><th className="pb-3 pr-4 font-medium">Description</th><th className="pb-3 pr-4 font-medium">Student</th><th className="pb-3 pr-4 font-medium">Method</th><th className="pb-3 text-right font-medium">Amount</th></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {state.transactions.map((t) => {
              const child = state.children.find((c) => c.id === t.childId);
              const credit = t.amount > 0;
              return (
                <tr key={t.id}>
                  <td className="py-3 pr-4 whitespace-nowrap">{fmtDate(t.date)}</td>
                  <td className="py-3 pr-4 font-medium">{t.description}</td>
                  <td className="py-3 pr-4">{child?.name ?? "—"}</td>
                  <td className="py-3 pr-4 text-on-surface-variant">{t.method}</td>
                  <td className={`py-3 text-right font-semibold tabular-nums ${credit ? "text-success" : ""}`}>
                    <span className="inline-flex items-center gap-1">{credit ? <ArrowDown size={15} /> : <ArrowUp size={15} />}{credit ? "+" : "-"}{formatSGD(Math.abs(t.amount))}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

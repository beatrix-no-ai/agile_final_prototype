import { Link } from "react-router";
import { Card } from "../../../components/ui/Card";
import { EmptyState } from "../../../components/ui/EmptyState";
import type { selectRecentGrants } from "../../../data/fasStore";
import { formatDate, formatSGD } from "../../../lib/format";

const linkCls = "rounded text-primary underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

/** The latest SBFAS grants behind the "Granted" figure: who, which tier, how much, when. */
export function RecentGrants({ grants }: { grants: ReturnType<typeof selectRecentGrants> }) {
  return (
    <Card title="Recent grants" action={<Link to="/admin/fas" className={`text-sm font-medium ${linkCls}`}>Open FAS queue</Link>}>
      {grants.length === 0 ? (
        <EmptyState title="No grants yet" hint="Approve an application in the FAS queue and it is listed here, counted against the budget." />
      ) : (
        <ul className="divide-y divide-line">
          {grants.map((g) => (
            <li key={g.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3 text-sm first:pt-0 last:pb-0">
              <span>
                <Link to={`/admin/students/${g.studentId}/fees`} className={`font-semibold ${linkCls}`}>{g.student}</Link>
                <span className="block text-[13px] text-on-surface-variant">{g.level} · {g.id} · {formatDate(g.at)}</span>
              </span>
              <span className="text-right">
                <span className="font-semibold">{formatSGD(g.amount)}</span>
                <span className="block text-[13px] text-on-surface-variant">{g.tier}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

import { useCallback, useMemo, useState } from "react";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { EmptyState } from "../../../components/ui/EmptyState";
import { MOCK_TODAY } from "../../../data/parent";
import { useParent } from "../../../data/parentStore";
import { GatewayModal } from "../payments/GatewayModal";
import { settle } from "../payments/settle";
import { useMockQuery } from "../../../lib/useMockQuery";
import { FasCard } from "./FasCard";
import { RecentTransactions, UpcomingInvoices } from "./Lists";
import { ChildCards, Summary } from "./Cards";
import { GoLink } from "./shared";

const pulse = "motion-safe:animate-pulse rounded-card bg-track";

function Skeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading overview" className="space-y-4">
      <div className={`${pulse} h-28`} />
      <div className="grid gap-4 lg:grid-cols-2"><div className={`${pulse} h-48`} /><div className={`${pulse} h-48`} /></div>
      <div className="grid gap-4 xl:grid-cols-[1fr_24rem]"><div className={`${pulse} h-72`} /><div className={`${pulse} h-72`} /></div>
    </div>
  );
}

export default function Overview() {
  const query = useMockQuery(true);
  const { state, dispatch } = useParent();
  const [payIds, setPayIds] = useState<string[] | null>(null);
  // Pay always uses each child's Education Account first; only the shortfall goes to the gateway.
  const summary = useMemo(() => settle(state.invoices, state.children, new Set(payIds ?? []), "account-first"), [state.invoices, state.children, payIds]);
  const onPaid = useCallback(() => dispatch({ type: "pay", ids: payIds ?? [], mode: "account-first", date: MOCK_TODAY }), [dispatch, payIds]);

  if (query.status === "loading") return <Skeleton />;
  if (query.status === "error" || !query.data) {
    return (
      <Card>
        <EmptyState as="h2" title="Could not load your overview" hint="Check your connection and try again." action={<Button onClick={query.retry}>Retry</Button>} />
      </Card>
    );
  }
  const { children, invoices, transactions } = state;
  return (
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="space-y-4">
        <Summary invoices={invoices} children={children} onPay={setPayIds} />
        <UpcomingInvoices invoices={invoices} children={children} onPay={setPayIds} />
        <section aria-label="Children"><ChildCards children={children} invoices={invoices} /></section>
      </div>
      <div className="space-y-4">
        <FasCard progress={state.fas} children={children} outcomes={state.outcomes} />
        <RecentTransactions transactions={transactions} children={children} />
        <Card title="Your details" action={<GoLink to="/parent/settings" label="Settings" />}>
          <p className="text-sm font-semibold">{state.profile.name}</p>
          <p className="text-[13px] text-on-surface-variant">{state.profile.contact}</p>
          <p className="text-[13px] text-on-surface-variant">{state.profile.mailingAddress}</p>
        </Card>
      </div>
      <GatewayModal open={payIds !== null} summary={summary} onClose={() => setPayIds(null)} onPaid={onPaid} />
    </div>
  );
}

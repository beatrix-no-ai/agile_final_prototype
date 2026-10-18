import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { EmptyState } from "../../../components/ui/EmptyState";
import { parentData } from "../../../data/parent";
import { useParent } from "../../../data/parentStore";
import { useMockQuery } from "../../../lib/useMockQuery";
import { FasCard } from "./FasCard";
import { RecentTransactions, UpcomingInvoices } from "./Lists";
import { ChildCards, Summary } from "./Cards";

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
  const query = useMockQuery(parentData);
  const { state } = useParent();

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
        <Summary invoices={invoices} />
        <UpcomingInvoices invoices={invoices} children={children} />
        <section aria-label="Children"><ChildCards children={children} invoices={invoices} /></section>
      </div>
      <div className="space-y-4">
        <FasCard />
        <RecentTransactions transactions={transactions} children={children} />
      </div>
    </div>
  );
}

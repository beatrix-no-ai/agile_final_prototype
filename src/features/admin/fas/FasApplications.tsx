import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle } from "@phosphor-icons/react";
import { Link } from "react-router";
import { Badge, type BadgeTone } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { DataTable, RowAction, type Column } from "../../../components/ui/DataTable";
import { EmptyState } from "../../../components/ui/EmptyState";
import { SBFAS_APPLICATIONS, type SbfasApplication, type SbfasStatus } from "../../../data/sbfasApplications";
import { useFasActions } from "../../../data/fasActions";
import { useFas } from "../../../data/fasStore";
import { useFees } from "../../../data/feeStore";
import { useRegistry } from "../../../data/registryStore";
import { formatSGD } from "../../../lib/format";
import { balanceOf, chargeStatus } from "../../../lib/fees";
import { withBalance } from "../../../lib/studentFas";
import { useMockQuery } from "../../../lib/useMockQuery";
import { Tiles } from "../fee-types/parts";
import HqPermissionNote from "../HqPermissionNote";
import { ReviewModal } from "./ReviewModal";
import { isDeclined, isGranted, sortQueue, type Action, type Draft } from "./review";

type Filter = "all" | "pending" | "granted" | "declined";

const statusTone: Record<SbfasStatus, BadgeTone> = { Pending: "neutral", Approved: "success", Rejected: "alert" };
const VERB: Record<Action, string> = { approve: "approved", reject: "rejected" };

function Sla({ days }: { days: number }) {
  if (days <= 0) return <Badge tone="alert">Overdue</Badge>;
  return <span className={days <= 2 ? "font-semibold text-warning" : ""}>{days} {days === 1 ? "day" : "days"} left</span>;
}

/** What this student's family still owes on issued charges, after any FAS subsidy and payments. */
type Row = SbfasApplication & { payable: number; balance: number };

export default function SbfasApplications() {
  const query = useMockQuery(SBFAS_APPLICATIONS);
  const fees = useFees();
  const { state: fas } = useFas();
  const { state: reg } = useRegistry();
  const { decide: decideApp } = useFasActions();
  const apps = fas.apps; // shared with the Budgets pages, so a decision moves the school's statistics
  const [openId, setOpenId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [message, setMessage] = useState("");
  const msgRef = useRef<HTMLDivElement>(null);
  // The decided row moves away, so the opener is gone: park focus on the confirmation instead of losing it to <body>.
  useEffect(() => { if (message) msgRef.current?.focus(); }, [message]);

  const enriched: Row[] = useMemo(
    () => sortQueue(apps).map((a) => ({
      ...a,
      // What the family still owes (after any FAS subsidy and payments) — separate from the account's top-up balance.
      payable: fees.state.charges.filter((c) => c.studentId === a.studentId && chargeStatus(c) !== "paid").reduce((t, c) => t + balanceOf(c), 0),
      balance: withBalance(reg.students.find((s) => s.id === a.studentId)!, fees.state.debits).balance,
    })),
    [apps, fees.state.charges],
  );
  const rows: Row[] = useMemo(
    () => enriched.filter((a) => filter === "all"
      || (filter === "pending" && a.status === "Pending")
      || (filter === "granted" && isGranted(a))
      || (filter === "declined" && isDeclined(a))),
    [enriched, filter],
  );
  const pendingCount = apps.filter((a) => a.status === "Pending").length;
  const grantedCount = apps.filter(isGranted).length;
  const declinedCount = apps.filter(isDeclined).length;

  const decide = (id: string, action: Action, draft: Draft) => {
    const a = apps.find((x) => x.id === id)!;
    decideApp(id, action, draft); // updates the FAS record and re-prices the student's unpaid fees
    setOpenId(null);
    setMessage(
      `Application ${id} for ${a.student} ${VERB[action]}${action === "approve" ? ` at ${draft.tier}` : ""}.`,
    );
  };

  const columns: Column<Row>[] = [
    { key: "student", header: "Student", sortable: true, render: (a) => (
      <Link to={`/admin/students/${a.studentId}/fees`} className="rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
        <span className="font-semibold">{a.student}</span>
        <span className="block text-[13px] text-on-surface-variant">{a.level} · {a.id}</span>
      </Link>
    ) },
    { key: "incomeBand", header: "Income per person", sortable: true },
    { key: "payable", header: "Fee to pay", sortable: true, align: "right", render: (a) => (
      <Link to={`/admin/students/${a.studentId}/fees`} className="rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
        {a.payable ? <span className="font-semibold">{formatSGD(a.payable)}</span> : <span className="text-on-surface-variant">—</span>}
        <span className="block text-[13px] text-on-surface-variant" title="Education Account balance from MOE top-ups, separate from the FAS subsidy">Balance {formatSGD(a.balance)}</span>
      </Link>
    ) },
    { key: "slaDays", header: "Decide within", sortable: true, render: (a) => (a.status === "Pending" ? <Sla days={a.slaDays} /> : <span className="text-on-surface-variant">Decided</span>) },
    { key: "status", header: "Status", render: (a) => (a.status === "Pending" ? <Badge tone="neutral">Awaiting review</Badge> : <Badge tone={statusTone[a.status]}>{a.status}{a.sbfasTier ? ` · ${a.sbfasTier}` : ""}</Badge>) },
  ];
  const tabs: [Filter, string][] = [
    ["all", `All (${apps.length})`],
    ["pending", `Pending (${pendingCount})`],
    ["granted", `Granted (${grantedCount})`],
    ["declined", `Declined (${declinedCount})`],
  ];

  return (
    <div className="space-y-4">
      <HqPermissionNote />
      <Tiles items={[
        { label: "Waiting for your review", value: String(pendingCount), note: "Pending applications" },
        { label: "Overdue", value: String(apps.filter((a) => a.status === "Pending" && a.slaDays <= 0).length), note: "Past the decision deadline", alert: apps.some((a) => a.status === "Pending" && a.slaDays <= 0) },
        { label: "Granted", value: String(grantedCount), note: "Approved", good: grantedCount > 0 },
        { label: "Declined", value: String(declinedCount), note: "Rejected" },
      ]} />
      <Card
        title="SBFAS review queue"
        action={
          <div className="flex flex-wrap items-center gap-4">
            <div role="group" aria-label="Filter applications" className="flex gap-2">
              {tabs.map(([k, label]) => (
                <Button key={k} size="sm" variant={filter === k ? "primary" : "secondary"} aria-pressed={filter === k} onClick={() => setFilter(k)}>
                  {label}
                </Button>
              ))}
            </div>
          </div>
        }
      >
        <p className="mb-4 text-sm text-on-surface-variant">Closest deadline first, pending before decided. Income is shown as a band only.</p>
        <div ref={msgRef} tabIndex={-1} aria-live="polite" className="mb-3 outline-none empty:hidden">
          {message && (
            <p className="flex items-center gap-2 rounded-control border border-line bg-success-container px-3 py-2 text-sm font-medium text-success">
              <CheckCircle size={18} weight="bold" aria-hidden="true" /> {message}
            </p>
          )}
        </div>
        {query.status === "loading" && <div aria-busy="true" aria-label="Loading applications" className="space-y-3">{[0, 1, 2, 3].map((i) => <div key={i} className="h-12 motion-safe:animate-pulse rounded-control bg-track" />)}</div>}
        {query.status === "error" && <EmptyState title="Could not load applications" hint="Check your connection and try again." action={<Button onClick={query.retry}>Retry</Button>} />}
        {query.status === "ready" && (
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(a) => a.id}
            rowActions={(a) => <RowAction onClick={() => setOpenId(a.id)}>{a.status === "Pending" ? "Open review" : "View decision"}</RowAction>}
            large
            empty={<EmptyState title="No applications in this view" hint={filter === "pending" ? "Every application has been decided." : filter === "granted" ? "Nothing granted yet — approve an application from the Pending tab." : filter === "declined" ? "Nothing declined yet — rejected applications appear here with their reason." : "Nothing here yet."} action={<Button variant="secondary" onClick={() => setFilter("all")}>Show all</Button>} />}
          />
        )}
      </Card>
      <ReviewModal app={enriched.find((a) => a.id === openId) ?? null} onClose={() => setOpenId(null)} onDecide={decide} />
    </div>
  );
}

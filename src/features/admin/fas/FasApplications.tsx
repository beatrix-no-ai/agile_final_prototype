import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle } from "@phosphor-icons/react";
import { Badge, type BadgeTone } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { DataTable, RowAction, type Column } from "../../../components/ui/DataTable";
import { EmptyState } from "../../../components/ui/EmptyState";
import { FAS_APPLICATIONS, type FasApplication, type FasStatus } from "../../../data/fasApplications";
import { useMockQuery } from "../../../lib/useMockQuery";
import HqPermissionNote from "../HqPermissionNote";
import { ReviewModal, RiskBadge } from "./ReviewModal";
import { applyDecision, isDeclined, isGranted, sortQueue, type Action, type Draft } from "./review";

type Filter = "all" | "pending" | "granted" | "declined";

const statusTone: Record<FasStatus, BadgeTone> = { Pending: "neutral", Approved: "success", Overridden: "primary", Rejected: "alert" };
const VERB: Record<Action, string> = { approve: "approved", override: "overridden", reject: "rejected" };

function Sla({ days }: { days: number }) {
  if (days <= 0) return <Badge tone="alert">Overdue</Badge>;
  return <span className={days <= 2 ? "font-semibold text-warning" : ""}>{days} {days === 1 ? "day" : "days"} left</span>;
}

export default function FasApplications() {
  const query = useMockQuery(FAS_APPLICATIONS);
  const [apps, setApps] = useState<FasApplication[]>(FAS_APPLICATIONS);
  const [openId, setOpenId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [message, setMessage] = useState("");
  const msgRef = useRef<HTMLDivElement>(null);
  // The decided row moves away, so the opener is gone: park focus on the confirmation instead of losing it to <body>.
  useEffect(() => { if (message) msgRef.current?.focus(); }, [message]);

  const sorted = useMemo(() => sortQueue(apps), [apps]);
  const rows = useMemo(
    () => sorted.filter((a) => filter === "all"
      || (filter === "pending" && a.status === "Pending")
      || (filter === "granted" && isGranted(a))
      || (filter === "declined" && isDeclined(a))),
    [sorted, filter],
  );
  const pendingCount = apps.filter((a) => a.status === "Pending").length;
  const grantedCount = apps.filter(isGranted).length;
  const declinedCount = apps.filter(isDeclined).length;

  const decide = (id: string, action: Action, draft: Draft) => {
    const a = apps.find((x) => x.id === id)!;
    setApps((prev) => applyDecision(prev, id, action, draft));
    setOpenId(null);
    setMessage(
      `Application ${id} for ${a.student} ${VERB[action]}${action === "override" ? ` to ${draft.tier}` : action === "approve" ? ` at ${a.recommendedTier}` : ""}.`,
    );
  };

  const columns: Column<FasApplication>[] = [
    { key: "student", header: "Student", sortable: true, render: (a) => (<><span className="font-semibold">{a.student}</span><span className="block text-[13px] text-on-surface-variant">{a.id} - {a.level}</span></>) },
    { key: "incomeBand", header: "Per-capita income band" },
    { key: "riskScore", header: "AI risk rating", sortable: true, render: (a) => <RiskBadge score={a.riskScore} /> },
    { key: "recommendedTier", header: "Recommended tier", sortable: true },
    { key: "slaDays", header: "SLA", sortable: true, render: (a) => (a.status === "Pending" ? <Sla days={a.slaDays} /> : <span className="text-on-surface-variant">Closed</span>) },
    { key: "status", header: "Status", render: (a) => <Badge tone={statusTone[a.status]}>{a.status}{a.finalTier ? ` - ${a.finalTier}` : ""}</Badge> },
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
        <p className="mb-3 text-sm text-on-surface-variant">
          Highest AI risk first, pending applications before decided ones. Income is shown as a band only.
          Granted and Declined keep the decision history — open an application to see the tier granted and the justification recorded.
        </p>
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
            empty={<EmptyState title="No applications in this view" hint={filter === "pending" ? "Every application has been decided." : filter === "granted" ? "Nothing granted yet — approve or override an application from the Pending tab." : filter === "declined" ? "Nothing declined yet — rejected applications appear here with their reason." : "Nothing here yet."} action={<Button variant="secondary" onClick={() => setFilter("all")}>Show all</Button>} />}
          />
        )}
      </Card>
      <ReviewModal app={apps.find((a) => a.id === openId) ?? null} onClose={() => setOpenId(null)} onDecide={decide} />
    </div>
  );
}

import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Badge, type BadgeTone } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { DataTable, RowAction, type Column } from "../../../components/ui/DataTable";
import { EmptyState } from "../../../components/ui/EmptyState";
import { SBFAS_APPLICATIONS, attemptOf, sourceOf, type SbfasApplication, type SbfasStatus } from "../../../data/sbfasApplications";
import { rankOf } from "../../../data/sbfasRule";
import { useFas } from "../../../data/fasStore";
import { useFees } from "../../../data/feeStore";
import { useMovements } from "../../../data/movements";
import { useRegistry } from "../../../data/registryStore";
import { useSession } from "../../../session";
import { formatSGD } from "../../../lib/format";
import { balanceOf, chargeStatus } from "../../../lib/fees";
import { schoolOfStudent } from "../../../lib/registry";
import { withBalance } from "../../../lib/studentFas";
import { useMockQuery } from "../../../lib/useMockQuery";
import { Tiles } from "../fee-types/parts";
import HqPermissionNote from "../HqPermissionNote";
import { RiskBadge } from "./ReviewPage";
import { isDeclined, isGranted, sortQueue, statusLabel } from "./review";

type Filter = "all" | "pending" | "granted" | "declined";

const statusTone: Record<SbfasStatus, BadgeTone> = { Pending: "neutral", Approved: "success", Overridden: "success", Rejected: "alert" };

/** What this student's family still owes on issued charges, after any FAS subsidy and payments. */
type Row = SbfasApplication & { payable: number; balance: number; nationality: string };

/** SBFAS review queue (Requirement 4, school side): shown to schools with the FAS module and read-only at HQ. */
function SbfasReview() {
  const query = useMockQuery(SBFAS_APPLICATIONS);
  const fees = useFees();
  const { state: fas } = useFas();
  const { state: reg } = useRegistry();
  const movements = useMovements();
  const { role, staff } = useSession();
  // Each school reviews only its own students' applications (BR15); MOE HQ has no school and sees every one.
  // A school account without a school sees nothing rather than everything.
  const mySchool = role === "school" ? staff?.schoolCode ?? "" : null;
  // Shared with the Budgets pages, so a decision moves the school's statistics. One row per child
  // holds structurally: a parent re-request requeues the SAME application (rounds log), never a second record.
  const apps = useMemo(
    () => fas.apps.filter((a) => {
      if (mySchool === null) return true;
      const s = reg.students.find((x) => x.id === a.studentId);
      return s ? schoolOfStudent(s, reg.classes) === mySchool : false;
    }),
    [fas.apps, mySchool, reg.students, reg.classes],
  );
  const [filter, setFilter] = useState<Filter>("all");
  const navigate = useNavigate();

  const enriched: Row[] = useMemo(
    () => sortQueue(apps).map((a) => ({
      ...a,
      nationality: reg.students.find((s) => s.id === a.studentId)?.nationality ?? "Singapore Citizen",
      // What the family still owes (after any FAS subsidy and payments) — separate from the account's top-up balance.
      payable: fees.state.charges.filter((c) => c.studentId === a.studentId && chargeStatus(c) !== "paid").reduce((t, c) => t + balanceOf(c), 0),
      balance: withBalance(reg.students.find((s) => s.id === a.studentId)!, movements).balance,
    })),
    [apps, fees.state.charges, movements, reg.students],
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

  const columns: Column<Row>[] = [
    { key: "student", header: "Student", sortable: true, render: (a) => (
      <Link to={`/admin/students/${a.studentId}/fees`} className="rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
        <span className="font-semibold">{a.student}</span>
        <span className="block text-[13px] text-on-surface-variant">{a.level} · {a.id}</span>
      </Link>
    ) },
    { key: "riskScore", header: "Risk", sortable: true, render: (a) => (
      <>
        <RiskBadge score={a.riskScore} />
        <span className="mt-1 block text-[13px] text-on-surface-variant">Suggests {rankOf(a.recommendedTier)}</span>
      </>
    ) },
    { key: "incomeBand", header: "Income per person", sortable: true },
    { key: "source", header: "Source", render: (a) => (
      <>
        <Badge tone="neutral">{sourceOf(a)}</Badge>
        {attemptOf(a) > 1 && <span className="mt-1 block text-[13px] text-on-surface-variant">Round {attemptOf(a)} — re-requested by the parent</span>}
      </>
    ) },
    { key: "payable", header: "Fee to pay", sortable: true, align: "right", render: (a) => (
      <Link to={`/admin/students/${a.studentId}/fees`} className="rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
        {a.payable ? <span className="font-semibold">{formatSGD(a.payable)}</span> : <span className="text-on-surface-variant">—</span>}
        <span className="block text-[13px] text-on-surface-variant" title="Education Account balance from MOE top-ups, separate from the FAS subsidy">Balance {formatSGD(a.balance)}</span>
      </Link>
    ) },
    { key: "status", header: "Status", render: (a) => (
      <>
        <Badge tone={statusTone[a.status]}>{statusLabel(a.status)}{a.sbfasTier ? ` · ${rankOf(a.sbfasTier)}` : ""}</Badge>
        {a.amendedAt && (
          <span className="mt-1 block text-[13px] text-on-surface-variant">
            Reopened after rejection · {new Date(a.amendedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
          </span>
        )}
      </>
    ) },
  ];
  const tabs: [Filter, string][] = [
    ["all", `All (${apps.length})`],
    ["pending", `Pending (${pendingCount})`],
    ["granted", `Granted (${grantedCount})`],
    ["declined", `Rejected (${declinedCount})`],
  ];

  return (
    <div className="space-y-4">
      <HqPermissionNote />
      <Tiles cols={3} items={[
        { label: "Waiting for your review", value: String(pendingCount), note: "Pending applications" },
        { label: "Granted", value: String(grantedCount), note: "Approved or overridden", good: grantedCount > 0 },
        { label: "Declined", value: String(declinedCount), note: "Rejected" },
      ]} />
      <Card
        title="SBFAS review queue"
        action={
          <div role="group" aria-label="Filter applications" className="flex flex-wrap gap-2">
            {tabs.map(([k, label]) => (
              <Button key={k} size="sm" variant={filter === k ? "primary" : "secondary"} aria-pressed={filter === k} onClick={() => setFilter(k)}>
                {label}
              </Button>
            ))}
          </div>
        }
      >
        <p className="mb-4 text-sm text-on-surface-variant">Highest risk first, pending before decided. Income is shown as a band only. One row per child — a parent re-request requeues the same application with its reason logged.</p>
        {query.status === "loading" && <div aria-busy="true" aria-label="Loading applications" className="space-y-3">{[0, 1, 2, 3].map((i) => <div key={i} className="h-12 motion-safe:animate-pulse rounded-control bg-track" />)}</div>}
        {query.status === "error" && <EmptyState title="Could not load applications" hint="Check your connection and try again." action={<Button onClick={query.retry}>Retry</Button>} />}
        {query.status === "ready" && (
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(a) => a.id}
            rowActions={(a) => <RowAction onClick={() => navigate(`/admin/fas/review/${a.id}`)}>{a.status === "Pending" ? "Open review" : "View decision"}</RowAction>}
            large
            empty={<EmptyState title="No applications in this view" hint={filter === "pending" ? "Every application has been decided." : filter === "granted" ? "Nothing granted yet — approve or override an application from the Pending tab." : filter === "declined" ? "Nothing declined yet — rejected applications appear here with their reason." : "Nothing here yet."} action={<Button variant="secondary" onClick={() => setFilter("all")}>Show all</Button>} />}
          />
        )}
      </Card>
    </div>
  );
}

export default SbfasReview;
export { SbfasReview };

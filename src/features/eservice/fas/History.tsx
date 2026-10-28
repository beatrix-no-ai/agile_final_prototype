import { Eye } from "@phosphor-icons/react";
import { useNavigate } from "react-router";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { DataTable, RowAction } from "../../../components/ui/DataTable";
import { EmptyState } from "../../../components/ui/EmptyState";
import { useParent } from "../../../data/parentStore";
import { fmtDate } from "../overview/shared";

type Row = { id: string; submitted: string; children: string; status: string };

// ponytail: the parent store keeps one family application, so history has at most one row; add past years when the store keeps them.
export default function FasHistory() {
  const navigate = useNavigate();
  const { state } = useParent();
  const { stage, submittedOn } = state.fas;
  const outcomes = Object.values(state.outcomes);
  const status = stage === "preparing" ? "Draft"
    : outcomes.some((o) => o?.status === "Awaiting school decision" || !o) ? "Under review"
    : "Decided";
  const rows: Row[] = stage === "not-started" ? [] : [{
    id: "current",
    submitted: submittedOn ? fmtDate(submittedOn) : "—",
    children: state.children.map((c) => c.name).join(", "),
    status,
  }];
  const tone = (s: string) => (s === "Decided" ? "success" : s === "Draft" ? "neutral" : "warning");
  const open = () => navigate("/parent/fas/apply");

  return (
    <Card title="My FAS applications" action={stage === "not-started" && <Button onClick={open}>Apply</Button>}>
      <DataTable
        large
        rows={rows}
        rowKey={(r) => r.id}
        columns={[
          { key: "submitted", header: "Submitted on" },
          { key: "children", header: "Children" },
          { key: "status", header: "Status", render: (r) => <Badge tone={tone(r.status)}>{r.status}</Badge> },
        ]}
        rowActions={(r) => <RowAction icon={<Eye size={16} />} onClick={open}>{r.status === "Draft" ? "Continue application" : "View application"}</RowAction>}
        empty={<EmptyState as="h2" title="No applications yet" hint="Select Apply to start a Financial Assistance Scheme application." />}
      />
    </Card>
  );
}

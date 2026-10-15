import { useState } from "react";
import { useLocation } from "react-router";
import { Badge } from "../../../components/ui/Badge";
import { Card } from "../../../components/ui/Card";
import { DataTable, type Column } from "../../../components/ui/DataTable";
import { EmptyState } from "../../../components/ui/EmptyState";
import { inputClass } from "../../../components/ui/Field";
import type { Student } from "../../../data/students";
import { schoolOfLevel } from "../../../data/schoolMgmt";
import { SCHOOLS } from "../../../data/schools";
import { ageForLevel } from "../../../lib/accounts";
import { Plus } from "@phosphor-icons/react";
import { Button } from "../../../components/ui/Button";
import { ACCOUNTS, FUND_RULES, PAST_EXECUTIONS, type Account, type Execution, type FundRule } from "../../../data/topup";
import { formatSGD } from "../../../lib/format";
import Execute, { SCHEDULE_LABEL } from "./Execute";
import Rules from "./Rules";

const TABS = [
  { id: "history", label: "Top-up transaction" },
  { id: "rules", label: "Batch top-up rule" },
] as const;
type TabId = (typeof TABS)[number]["id"];

const columns: Column<Execution>[] = [
  { key: "id", header: "ID", sortable: true },
  { key: "type", header: "Top-up type", sortable: true },
  { key: "title", header: "Recipient / rule", sortable: true, render: (x) => (<><span className="font-semibold">{x.title}</span><span className="block text-[13px] text-on-surface-variant">{x.reason}</span></>) },
  { key: "date", header: "Date", sortable: true },
  { key: "schedule", header: "Schedule", render: (x) => SCHEDULE_LABEL[x.schedule] },
  { key: "eligible", header: "Accounts", sortable: true, align: "right" },
  { key: "amount", header: "Per account", align: "right", render: (x) => formatSGD(x.amount) },
  { key: "total", header: "Total credited", sortable: true, align: "right", render: (x) => {
    const st = x.status ?? "Success";
    return (<>{formatSGD(st === "Success" ? x.total : 0)}<span className="block text-[13px] text-on-surface-variant">{st === "Pending" ? `Expected: ${formatSGD(x.total)}` : st === "Failed" ? "Not credited" : "Credited"}</span></>);
  } },
  { key: "status", header: "Status", render: (x) => <Badge tone={x.status === "Pending" ? "warning" : x.status === "Failed" ? "alert" : "success"}>{x.status ?? "Success"}</Badge> },
  { key: "by", header: "Executed by" },
];

function History({ rows, onCreate }: { rows: Execution[]; onCreate: () => void }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("All");
  const [type, setType] = useState("All");
  const list = rows.filter((x) => `${x.id} ${x.title} ${x.reason}`.toLowerCase().includes(q.trim().toLowerCase()) && (status === "All" || (x.status ?? "Success") === status) && (type === "All" || x.type === type));
  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input aria-label="Search transactions" className={inputClass.replace("w-full", "min-w-48 max-w-xs flex-1")} placeholder="Search reference or recipient..." value={q} onChange={(e) => setQ(e.target.value)} />
        <select aria-label="Filter by status" className={inputClass.replace("w-full", "w-44")} value={status} onChange={(e) => setStatus(e.target.value)}>
          {["All", "Success", "Pending", "Failed"].map((s) => <option key={s} value={s}>{s === "All" ? "All statuses" : s}</option>)}
        </select>
        <select aria-label="Filter by type" className={inputClass.replace("w-full", "w-44")} value={type} onChange={(e) => setType(e.target.value)}>
          {["All", "Single", "Batch"].map((s) => <option key={s} value={s}>{s === "All" ? "All types" : s}</option>)}
        </select>
        <Button className="ml-auto" icon={<Plus size={16} weight="bold" aria-hidden="true" />} onClick={onCreate}>Create top-up execution</Button>
      </div>
      <DataTable columns={columns} rows={list} rowKey={(x) => x.id} pageSize={8} empty={<EmptyState title="No matching transactions" hint="Executed top-ups and schedules appear here." />} />
    </Card>
  );
}

/** Student opened from an Education Account page; the top-up form is preset to them. */
const accountOf = (s: Student): Account => ({
  id: s.id, name: s.name, school: SCHOOLS.find((x) => x.code === schoolOfLevel(s.level))?.name ?? "", class: s.class, age: ageForLevel(s.level),
  citizen: true, enrolled: s.status === "Enrolled", schooling: s.status, status: "Active", balance: s.balance,
});

export default function TopUp() {
  const preset = (useLocation().state as { student?: Student } | null)?.student;
  const [tab, setTab] = useState<TabId>("history");
  const [creating, setCreating] = useState(Boolean(preset)); // preset student opens the create form directly
  const [rules, setRules] = useState<FundRule[]>(FUND_RULES);
  const [accounts, setAccounts] = useState<Account[]>(() => (preset && !ACCOUNTS.some((a) => a.id === preset.id) ? [accountOf(preset), ...ACCOUNTS] : ACCOUNTS));
  const [history, setHistory] = useState<Execution[]>([...PAST_EXECUTIONS].reverse()); // newest first

  const done = (x: Execution, creditedIds: string[]) => {
    setHistory((h) => [x, ...h]);
    if (creditedIds.length) {
      const credit = new Set(creditedIds);
      setAccounts((as) => as.map((a) => (credit.has(a.id) ? { ...a, balance: Math.round((a.balance + x.amount) * 100) / 100 } : a)));
    }
  };

  return (
    <div className="space-y-4">
      <div role="tablist" aria-label="Top-up workspace" className="flex gap-1 border-b border-line">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            id={`topup-tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls="topup-panel"
            onClick={() => { setTab(t.id); setCreating(false); }}
            className={`-mb-px min-h-11 border-b-2 px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary ${tab === t.id ? "border-primary text-primary" : "border-transparent text-on-surface-variant hover:text-primary"}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id="topup-panel" aria-labelledby={`topup-tab-${tab}`}>
        {tab === "history" && (creating
          ? <Execute rules={rules} accounts={accounts} history={history} onDone={done} presetAccountId={preset?.id} onBack={() => setCreating(false)} />
          : <History rows={history} onCreate={() => setCreating(true)} />)}
        {tab === "rules" && <Rules rules={rules} onChange={setRules} />}
      </div>
    </div>
  );
}

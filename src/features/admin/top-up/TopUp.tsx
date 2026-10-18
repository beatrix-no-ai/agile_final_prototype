import { useMemo, useState } from "react";
import { useLocation } from "react-router";
import { useSession } from "../../../session";
import type { Student } from "../../../data/students";
import { schoolOfLevel } from "../../../data/schoolMgmt";
import { SCHOOLS } from "../../../data/schools";
import { ACCOUNT_CLOSES_AT, ageForLevel } from "../../../lib/accounts";
import { ACCOUNTS, FUND_RULES, PAST_TRANSACTIONS, type Account, type FundRule, type Target, type Transaction } from "../../../data/topup";
import { ledgerIds, topUpReportRows } from "../../../lib/topup";
import { formatDate } from "../../../lib/format";
import { maskNric } from "../../../lib/nric";
import { Tiles } from "../fee-types/parts";
import { downloadXlsx } from "../../../lib/xlsx";
import Execute from "./Execute";
import Rules from "./Rules";
import { Dialog, cash, useToast, type DialogSpec } from "./tuUi";
import "./topup.css";

const TABS = [
  { id: "transactions", label: "Top-up History" },
  { id: "rules", label: "Batch Top-up Rule" },
] as const;
type TabId = (typeof TABS)[number]["id"];

const statusClass = (s: Transaction["status"]) => (s === "Pending" ? "draft" : s === "Failed" || s === "Partial Success" ? "failed" : "");
const targetClass = (s: string) => (s === "Pending" ? "draft" : s === "Failed" ? "deactivated" : "");

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

function Fact({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-3" : undefined}>
      <dt className="text-[13px] text-on-surface-variant">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold text-on-surface">{children}</dd>
    </div>
  );
}

function History({ rows, accounts, onCreate }: { rows: Transaction[]; accounts: Account[]; onCreate: () => void }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [viewing, setViewing] = useState<number | null>(null);
  const ledger = useMemo(() => ledgerIds(rows, accounts), [rows, accounts]);
  const stats = useMemo(() => {
    let credited = 0, scheduled = 0, scheduledTotal = 0, attention = 0;
    rows.forEach((t, i) => {
      credited += ledger[i].targets.filter((a) => a.status === "Success").length * t.amount;
      if (t.status === "Pending") { scheduled++; scheduledTotal += t.amount * t.accounts; }
      if (t.status === "Failed" || t.status === "Partial Success") attention++;
    });
    return { credited, scheduled, scheduledTotal, attention };
  }, [rows, ledger]);
  const reset = () => { setQ(""); setStatus(""); setType(""); setFrom(""); setTo(""); };
  const list = rows.map((t, i) => ({ t, i })).filter(({ t, i }) => (!status || t.status === status) && (!type || t.type === type) && (!from || t.date >= from) && (!to || t.date <= to) && (!q.trim() || `${ledger[i].id} ${t.recipient} ${t.type}`.toLowerCase().includes(q.trim().toLowerCase())));
  if (viewing !== null && rows[viewing]) return <Details t={rows[viewing]} id={ledger[viewing].id} items={ledger[viewing].targets} accounts={accounts} onBack={() => setViewing(null)} />;
  return (
    <div className="grid gap-5">
      <Tiles items={[
        { label: "Credited so far", value: cash(stats.credited), note: "Money that reached Education Accounts", good: true },
        { label: "Scheduled", value: String(stats.scheduled), note: stats.scheduled ? `${cash(stats.scheduledTotal)} estimated, not credited yet` : "Nothing waiting to run" },
        { label: "Need attention", value: String(stats.attention), note: "Failed or partly failed", alert: stats.attention > 0 },
        { label: "All top-ups", value: String(rows.length), note: `${rows.filter((r) => r.type === "Batch").length} batch · ${rows.filter((r) => r.type === "Single").length} single` },
      ]} />
      <div className="card tablecard">
        <div className="toolbar filters-toolbar">
          <input className="filter-search" placeholder="Search ID or recipient..." aria-label="Search top-ups" value={q} onChange={(e) => setQ(e.target.value)} />
          <select aria-label="Filter by type" value={type} onChange={(e) => setType(e.target.value)}><option value="">All types</option><option value="Single">Single</option><option value="Batch">Batch</option></select>
          <input type="date" aria-label="From date" title="From date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <input type="date" aria-label="To date" title="To date" value={to} onChange={(e) => setTo(e.target.value)} />
          <select aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All statuses</option><option>Success</option><option>Partial Success</option><option>Pending</option><option>Failed</option></select>
          <button type="button" className="btn" onClick={reset}>Reset Filter</button>
          <button type="button" className="btn primary create-action" onClick={onCreate}>＋ Create top-up</button>
        </div>
        <div className="tablewrap"><table className="data-table roomy"><thead><tr><th>Top-up ID</th><th>Recipient / rule</th><th>Date</th><th style={{ textAlign: "right" }}>Per account</th><th style={{ textAlign: "right" }}>Total</th><th>Status</th><th>Action</th></tr></thead>
          <tbody>
            {list.length ? list.map(({ t, i }) => (
              <tr key={`${t.ref}-${i}`}>
                <td><strong>{ledger[i].id}</strong></td>
                <td><strong>{t.recipient}</strong><small>{t.type} · {plural(t.accounts, "account")}</small></td>
                <td>{formatDate(t.date)}<small>{t.schedule}</small></td>
                <td style={{ textAlign: "right" }}>{cash(t.amount)}</td>
                <td style={{ textAlign: "right" }}><strong>{cash(t.amount * t.accounts)}</strong>{t.status === "Pending" && <small>Estimated, not credited</small>}</td>
                <td><span className={`badge ${statusClass(t.status)}`}>{t.status}</span></td>
                <td><div className="actiongroup"><button type="button" onClick={() => setViewing(i)}>View details</button></div></td>
              </tr>
            )) : <tr><td colSpan={7} className="empty">No top-ups found.</td></tr>}
          </tbody></table></div>
      </div>
    </div>
  );
}

function Details({ t, id, items, accounts, onBack }: { t: Transaction; id: string; items: Target[]; accounts: Account[]; onBack: () => void }) {
  const [q, setQ] = useState("");
  const [st, setSt] = useState("");
  const pending = t.status === "Pending", batch = t.type === "Batch";
  const count = (s: string) => items.filter((a) => a.status === s).length;
  const credited = count("Success");
  const failed = count("Failed");
  const download = () => downloadXlsx(`${id}-topped-up-students.xlsx`, "Topped-up students", topUpReportRows(t, id, items, accounts));
  const shown = items.filter((a) => (!st || a.status === st) && (!q.trim() || `${a.txid ?? ""} ${a.student} ${a.account} ${maskNric(a.account)} ${a.reason ?? ""}`.toLowerCase().includes(q.trim().toLowerCase())));
  return (
    <div className="grid gap-5">
      <button type="button" className="backline" style={{ justifySelf: "start" }} onClick={onBack}>← Back to Top-up History</button>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-on-surface">{t.recipient}</h2>
          <p className="mt-0.5 text-sm text-on-surface-variant">{id} · {t.type} top-up</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`badge ${statusClass(t.status)}`}>{t.status}</span>
          <button type="button" className="btn primary" disabled={!credited} onClick={download} title={credited ? "Lists the accounts topped up. Failed accounts are not included." : "Available once accounts have been topped up."}>Download Excel report</button>
        </div>
      </div>
      <Tiles items={[
        { label: batch ? "Amount per account" : "Amount", value: cash(t.amount), note: plural(t.accounts, "account") },
        { label: pending ? "Estimated total" : "Planned total", value: cash(t.amount * t.accounts) },
        { label: "Credited", value: pending ? "Not yet" : cash(credited * t.amount), note: pending ? "Runs on the scheduled date" : plural(credited, "account"), good: !pending && credited > 0 },
        { label: "Failed", value: pending ? "-" : cash(failed * t.amount), note: pending ? undefined : plural(failed, "account"), alert: failed > 0 },
      ]} />
      <div className="card" style={{ padding: 20 }}>
        <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-3">
          <Fact label={pending ? "Scheduled for" : "Executed on"}>{formatDate(t.date)}</Fact>
          <Fact label="Schedule">{t.schedule}</Fact>
          <Fact label="Executed by">{t.by}</Fact>
          <Fact label="Reason" wide>{t.detail}</Fact>
        </dl>
      </div>
      <div className="card tablecard">
        <div className="tabletop"><h2>{pending ? "Accounts that will be topped up" : "Account transactions"}</h2></div>
        <p className="small" style={{ marginBottom: 12 }}>{pending ? "The accounts were fixed when the schedule was created. Nothing has been credited yet." : `${credited} succeeded · ${failed} failed. A reason is shown for each failed account.`}</p>
        {batch && (
          <div className="toolbar">
            <input placeholder="Search student, NRIC or transaction ID..." aria-label="Search accounts" value={q} onChange={(e) => setQ(e.target.value)} />
            <select aria-label="Filter by account status" value={st} onChange={(e) => setSt(e.target.value)}><option value="">All account statuses</option><option>Pending</option><option>Success</option><option>Failed</option></select>
            <button type="button" className="btn" onClick={() => { setQ(""); setSt(""); }}>Reset Filter</button>
          </div>
        )}
        <div className={`tablewrap${batch ? " transaction-scroll" : ""}`} {...(batch ? { role: "region", "aria-label": "Account transaction list", tabIndex: 0 } : {})}>
          <table className="data-table roomy" style={{ minWidth: 760 }}><thead><tr><th>Student</th><th>Education Account ID (NRIC)</th><th style={{ textAlign: "right" }}>Amount</th><th>Status</th><th>Transaction ID</th><th>Failure reason</th></tr></thead>
            <tbody>{shown.length ? shown.map((a) => (
              <tr key={a.account + (a.txid ?? "")}><td><strong>{a.student}</strong></td><td>{maskNric(a.account)}</td><td style={{ textAlign: "right" }}>{cash(t.amount)}</td><td><span className={`badge ${targetClass(a.status)}`}>{a.status}</span></td><td>{a.txid ?? "—"}</td><td>{a.reason ?? "—"}</td></tr>
            )) : <tr><td colSpan={6} className="empty">No account transactions found.</td></tr>}</tbody></table>
        </div>
      </div>
    </div>
  );
}
/** Student opened from an Education Account page; the top-up form is preset to them. */
const accountOf = (s: Student): Account => ({
  id: s.id, nric: s.nric, name: s.name, school: SCHOOLS.find((x) => x.code === schoolOfLevel(s.level))?.name ?? "", class: s.class, age: ageForLevel(s.level),
  citizen: true, enrolled: s.status === "Active", schooling: s.status, status: ageForLevel(s.level) >= ACCOUNT_CLOSES_AT ? "Closed" : "Active", balance: s.balance,
});

export default function TopUp() {
  const preset = (useLocation().state as { student?: Student } | null)?.student;
  // A School user with the Top-up module sees only their own school's accounts, single top-ups, and no rule tab.
  const { role, staff } = useSession();
  const ownSchool = role === "school" ? SCHOOLS.find((s) => s.code === staff?.schoolCode)?.name ?? "" : undefined;
  const tabs = ownSchool === undefined ? TABS : TABS.filter((t) => t.id === "transactions");
  const base = ownSchool === undefined ? ACCOUNTS : ACCOUNTS.filter((a) => a.school === ownSchool);
  const [tab, setTab] = useState<TabId>("transactions");
  const [creating, setCreating] = useState(Boolean(preset)); // a preset student opens the create form directly
  const [rules, setRules] = useState<FundRule[]>(FUND_RULES);
  const [accounts, setAccounts] = useState<Account[]>(() => (preset && !base.some((a) => a.id === preset.id) ? [accountOf(preset), ...base] : base));
  const [history, setHistory] = useState<Transaction[]>(ownSchool === undefined ? PAST_TRANSACTIONS : []);
  const [dialog, setDialog] = useState<DialogSpec | null>(null);
  const { notify, toast } = useToast();

  const done = (row: Transaction, creditedIds: string[]) => {
    setHistory((h) => [row, ...h]);
    if (creditedIds.length) {
      const credit = new Set(creditedIds);
      setAccounts((as) => as.map((a) => (credit.has(a.id) ? { ...a, balance: Math.round((a.balance + row.amount) * 100) / 100 } : a)));
    }
  };
  const closeAsk = () => setDialog(null);

  return (
    <div className="tu">
      <nav className="tabs" role="tablist" aria-label="Top-up workspace">
        {tabs.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={tab === t.id ? "active" : ""} onClick={() => { setTab(t.id); setCreating(false); }}>{t.label}</button>
        ))}
      </nav>
      {tab === "transactions" && (creating
        ? <Execute rules={rules} accounts={accounts} presetAccountId={preset?.id} singleOnly={ownSchool !== undefined} onBack={() => setCreating(false)} onDone={done} notify={notify} ask={setDialog} closeAsk={closeAsk} />
        : <History rows={history} accounts={accounts} onCreate={() => setCreating(true)} />)}
      {tab === "rules" && <Rules rules={rules} onChange={setRules} notify={notify} ask={setDialog} closeAsk={closeAsk} />}
      <Dialog spec={dialog} onClose={closeAsk} />
      {toast}
    </div>
  );
}

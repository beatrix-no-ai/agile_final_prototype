import { useMemo, useState } from "react";
import { useLocation } from "react-router";
import { useSession } from "../../../session";
import type { Student } from "../../../data/students";
import { schoolOfLevel } from "../../../data/schoolMgmt";
import { SCHOOLS } from "../../../data/schools";
import { ACCOUNT_CLOSES_AT, ageForLevel } from "../../../lib/accounts";
import { ACCOUNTS, FUND_RULES, PAST_TRANSACTIONS, type Account, type FundRule, type Target, type Transaction } from "../../../data/topup";
import { ledgerIds, topUpReportRows } from "../../../lib/topup";
import { maskNric } from "../../../lib/nric";
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

function History({ rows, accounts, onCreate }: { rows: Transaction[]; accounts: Account[]; onCreate: () => void }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [viewing, setViewing] = useState<number | null>(null);
  const ledger = useMemo(() => ledgerIds(rows, accounts), [rows, accounts]);
  const reset = () => { setQ(""); setStatus(""); setType(""); setFrom(""); setTo(""); };
  const list = rows.map((t, i) => ({ t, i })).filter(({ t, i }) => (!status || t.status === status) && (!type || t.type === type) && (!from || t.date >= from) && (!to || t.date <= to) && (!q.trim() || `${ledger[i].id} ${t.recipient} ${t.type}`.toLowerCase().includes(q.trim().toLowerCase())));
  if (viewing !== null && rows[viewing]) return <Details t={rows[viewing]} id={ledger[viewing].id} items={ledger[viewing].targets} accounts={accounts} onBack={() => setViewing(null)} />;
  return (
    <div className="card tablecard">
      <div className="toolbar filters-toolbar">
        <input className="filter-search" placeholder="Search ID or recipient..." aria-label="Search top-ups" value={q} onChange={(e) => setQ(e.target.value)} />
        <select aria-label="Filter by type" value={type} onChange={(e) => setType(e.target.value)}><option value="">All types</option><option value="Single">Single</option><option value="Batch">Batch</option></select>
        <input type="date" aria-label="From date" title="From date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <input type="date" aria-label="To date" title="To date" value={to} onChange={(e) => setTo(e.target.value)} />
        <select aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All statuses</option><option>Success</option><option>Partial Success</option><option>Pending</option><option>Failed</option></select>
        <button type="button" className="btn" onClick={reset}>Reset Filter</button>
        <button type="button" className="btn primary create-action" onClick={onCreate}>＋ Create top-up execution</button>
      </div>
      <div className="tablewrap"><table className="data-table"><thead><tr><th>Top-up ID</th><th>Top-up Type</th><th>Recipient / rule</th><th>Date</th><th>Schedule</th><th>Accounts</th><th>Per account</th><th>Total</th><th>Status</th><th>Executed by</th><th>Action</th></tr></thead>
        <tbody>
          {list.length ? list.map(({ t, i }) => (
            <tr key={`${t.ref}-${i}`}>
              <td><strong>{ledger[i].id}</strong></td><td>{t.type}</td><td><strong>{t.recipient}</strong><small>{t.detail}</small></td><td>{t.date}</td><td>{t.schedule}</td>
              <td style={{ textAlign: "right" }}>{t.accounts}</td><td>{cash(t.amount)}</td>
              <td>{cash(t.amount * t.accounts)}{t.status === "Pending" && <small>Estimated · Not credited</small>}</td>
              <td><span className={`badge ${statusClass(t.status)}`}>{t.status}</span></td><td>{t.by}</td>
              <td><div className="actiongroup"><button type="button" onClick={() => setViewing(i)}>View</button></div></td>
            </tr>
          )) : <tr><td colSpan={11} className="empty">No top-ups found.</td></tr>}
        </tbody></table></div>
    </div>
  );
}

function Details({ t, id, items, accounts, onBack }: { t: Transaction; id: string; items: Target[]; accounts: Account[]; onBack: () => void }) {
  const [q, setQ] = useState("");
  const [st, setSt] = useState("");
  const pending = t.status === "Pending", batch = t.type === "Batch";
  const count = (s: string) => items.filter((a) => a.status === s).length;
  const row = (k: string, v: string) => <div className="summaryrow"><span>{k}</span><strong>{v}</strong></div>;
  const credited = count("Success");
  const download = () => downloadXlsx(`${id}-topped-up-students.xlsx`, "Topped-up students", topUpReportRows(t, id, items, accounts));
  const shown = items.filter((a) => (!st || a.status === st) && (!q.trim() || `${a.txid ?? ""} ${a.student} ${a.account} ${maskNric(a.account)} ${a.reason ?? ""}`.toLowerCase().includes(q.trim().toLowerCase())));
  return (
    <div>
      <button type="button" className="backline" onClick={onBack}>← Back to Top-up History</button>
      <div className="card tablecard">
        <div className="tabletop"><h2>Top-up Details · {id}</h2><span className={`badge ${statusClass(t.status)}`}>{t.status}</span></div>
        <div className="toolbar" style={{ marginBottom: 12 }}>
          <button type="button" className="btn primary" disabled={!credited} onClick={download}>Download Excel report</button>
          <span className="small">{credited ? `Lists the ${credited} account(s) topped up. Failed accounts are not included.` : "Available once accounts have been topped up."}</span>
        </div>
        {row("Type", t.type)}{row("Recipient / rule", t.recipient)}{row(pending ? "Scheduled date" : "Execution date", t.date)}{row("Schedule", t.schedule)}
        {batch && row("Eligible account(s)", String(t.accounts))}
        {row(batch ? "Amount per account" : "Amount", cash(t.amount))}
        {batch && <>
          {row(pending ? "Estimated total" : "Planned total", cash(t.amount * t.accounts))}
          {row("Successfully credited", pending ? "—" : cash(count("Success") * t.amount))}
          {row("Failed amount", pending ? "—" : cash(count("Failed") * t.amount))}
        </>}
        <h2 style={{ marginTop: 24 }}>{pending ? "Eligible Account(s) (Pending)" : "Account Transaction History"}</h2>
        <p className="small" style={{ marginBottom: 12 }}>{pending ? "Eligible accounts were fixed when the schedule was created. No ledger transactions exist yet." : `Success: ${count("Success")} · Failed: ${count("Failed")} · Failure reasons are shown for failed accounts.`}</p>
        {batch && (
          <div className="toolbar">
            <input placeholder="Search student, account or transaction ID..." aria-label="Search accounts" value={q} onChange={(e) => setQ(e.target.value)} />
            <select aria-label="Filter by account status" value={st} onChange={(e) => setSt(e.target.value)}><option value="">All account statuses</option><option>Pending</option><option>Success</option><option>Failed</option></select>
            <button type="button" className="btn" onClick={() => { setQ(""); setSt(""); }}>Reset Filter</button>
          </div>
        )}
        <div className={`tablewrap${batch ? " transaction-scroll" : ""}`} {...(batch ? { role: "region", "aria-label": "Account transaction list", tabIndex: 0 } : {})}>
          <table className="data-table" style={{ minWidth: 850 }}><thead><tr><th>Transaction ID</th><th>Student</th><th>Education Account ID (NRIC)</th><th>Amount</th><th>Status</th><th>Failure Reason</th></tr></thead>
            <tbody>{shown.length ? shown.map((a) => (
              <tr key={a.account + (a.txid ?? "")}><td>{a.txid ?? "—"}</td><td>{a.student}</td><td>{maskNric(a.account)}</td><td>{cash(t.amount)}</td><td><span className={`badge ${targetClass(a.status)}`}>{a.status}</span></td><td>{a.reason ?? "—"}</td></tr>
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

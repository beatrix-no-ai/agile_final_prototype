import { useState } from "react";
import { useLocation } from "react-router";
import type { Student } from "../../../data/students";
import { schoolOfLevel } from "../../../data/schoolMgmt";
import { SCHOOLS } from "../../../data/schools";
import { ageForLevel } from "../../../lib/accounts";
import { ACCOUNTS, FUND_RULES, PAST_TRANSACTIONS, type Account, type FundRule, type Transaction } from "../../../data/topup";
import Execute from "./Execute";
import Rules from "./Rules";
import { Dialog, cash, useToast, type DialogSpec } from "./tuUi";
import "./topup.css";

const TABS = [
  { id: "transactions", label: "Top-up Transaction" },
  { id: "rules", label: "Batch Top-up Rule" },
] as const;
type TabId = (typeof TABS)[number]["id"];

const statusClass = (s: Transaction["status"]) => (s === "Pending" ? "draft" : s === "Failed" ? "failed" : "");

function History({ rows, onCreate }: { rows: Transaction[]; onCreate: () => void }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const list = rows.filter((x) => (!status || x.status === status) && (!type || x.type === type) && (!q.trim() || `${x.ref} ${x.recipient} ${x.type}`.toLowerCase().includes(q.trim().toLowerCase())));
  return (
    <div className="card tablecard">
      <div className="toolbar">
        <input placeholder="Search ID or recipient..." aria-label="Search transactions" value={q} onChange={(e) => setQ(e.target.value)} />
        <select aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All statuses</option><option>Success</option><option>Pending</option><option>Failed</option></select>
        <select aria-label="Filter by type" value={type} onChange={(e) => setType(e.target.value)}><option value="">All types</option><option value="Single">Single</option><option value="Batch">Batch</option></select>
        <button type="button" className="btn primary" onClick={onCreate}>＋ Create top-up execution</button>
      </div>
      <div className="tablewrap"><table className="data-table"><thead><tr><th>ID</th><th>Top-up Type</th><th>Recipient / rule</th><th>Date</th><th>Schedule</th><th>Accounts</th><th>Per account</th><th>Total</th><th>Status</th><th>Executed by</th></tr></thead>
        <tbody>
          {list.length ? list.map((t, i) => (
            <tr key={`${t.ref}-${i}`}>
              <td>{t.ref}</td><td>{t.type}</td><td><strong>{t.recipient}</strong><small>{t.detail}</small></td><td>{t.date}</td><td>{t.schedule}</td>
              <td style={{ textAlign: "right" }}>{t.accounts}</td><td>{cash(t.amount)}</td>
              <td>{cash(t.status === "Success" ? t.amount * t.accounts : 0)}<small>{t.status === "Pending" ? `Expected: ${cash(t.amount * t.accounts)}` : t.status === "Failed" ? "Not credited" : "Credited"}</small></td>
              <td><span className={`badge ${statusClass(t.status)}`}>{t.status}</span></td><td>{t.by}</td>
            </tr>
          )) : <tr><td colSpan={10} className="empty">No transactions found.</td></tr>}
        </tbody></table></div>
    </div>
  );
}

/** Student opened from an Education Account page; the top-up form is preset to them. */
const accountOf = (s: Student): Account => ({
  id: s.id, name: s.name, school: SCHOOLS.find((x) => x.code === schoolOfLevel(s.level))?.name ?? "", class: s.class, age: ageForLevel(s.level),
  citizen: true, enrolled: s.status === "Enrolled", schooling: s.status, status: "Active", balance: s.balance,
});

export default function TopUp() {
  const preset = (useLocation().state as { student?: Student } | null)?.student;
  const [tab, setTab] = useState<TabId>("transactions");
  const [creating, setCreating] = useState(Boolean(preset)); // a preset student opens the create form directly
  const [rules, setRules] = useState<FundRule[]>(FUND_RULES);
  const [accounts, setAccounts] = useState<Account[]>(() => (preset && !ACCOUNTS.some((a) => a.id === preset.id) ? [accountOf(preset), ...ACCOUNTS] : ACCOUNTS));
  const [history, setHistory] = useState<Transaction[]>(PAST_TRANSACTIONS);
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
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={tab === t.id ? "active" : ""} onClick={() => { setTab(t.id); setCreating(false); }}>{t.label}</button>
        ))}
      </nav>
      {tab === "transactions" && (creating
        ? <Execute rules={rules} accounts={accounts} presetAccountId={preset?.id} onBack={() => setCreating(false)} onDone={done} notify={notify} ask={setDialog} closeAsk={closeAsk} />
        : <History rows={history} onCreate={() => setCreating(true)} />)}
      {tab === "rules" && <Rules rules={rules} onChange={setRules} notify={notify} ask={setDialog} closeAsk={closeAsk} />}
      <Dialog spec={dialog} onClose={closeAsk} />
      {toast}
    </div>
  );
}

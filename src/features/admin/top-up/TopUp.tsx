import { useMemo, useState } from "react";
import { useLocation } from "react-router";
import { useSession } from "../../../session";
import type { Student } from "../../../data/students";
import { useMovements } from "../../../data/movements";
import { useRegistry } from "../../../data/registryStore";
import { useTopUp } from "../../../data/topupStore";
import { accountsOf } from "../../../lib/accounts";
import type { Account, Target, Transaction } from "../../../data/topup";
import { ledgerIds, retryableAccounts, topUpReport } from "../../../lib/topup";
import { formatDate } from "../../../lib/format";
import { maskNric } from "../../../lib/nric";
import { Tiles } from "../fee-types/parts";
import { downloadXlsx } from "../../../lib/xlsx";
import Execute, { type Followup } from "./Execute";
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

const typeLabel = (t: Transaction["type"]) => (t === "Batch" ? "Batch" : "Specific Accounts");
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

function Fact({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-3" : undefined}>
      <dt className="text-[13px] text-on-surface-variant">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold text-on-surface">{children}</dd>
    </div>
  );
}

type Ledger = ReturnType<typeof ledgerIds>;

function History({ rows, accounts, ledger, viewingId, setViewingId, onCreate, onFollowup }: { rows: Transaction[]; accounts: Account[]; ledger: Ledger; viewingId: string | null; setViewingId: (id: string | null) => void; onCreate: () => void; onFollowup: (id: string, picked: string[]) => void }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
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
  const list = rows.map((t, i) => ({ t, i })).filter(({ t, i }) => (!status || t.status === status) && (!type || t.type === type) && (!from || t.date >= from) && (!to || t.date <= to) && (!q.trim() || `${ledger[i].id} ${t.recipient} ${typeLabel(t.type)}`.toLowerCase().includes(q.trim().toLowerCase())));
  const viewing = viewingId === null ? -1 : ledger.findIndex((l) => l.id === viewingId);
  if (viewing >= 0 && rows[viewing]) return <Details key={viewingId} t={rows[viewing]} id={ledger[viewing].id} items={ledger[viewing].targets} accounts={accounts} rows={rows} ledger={ledger} onOpen={setViewingId} onBack={() => setViewingId(null)} onFollowup={onFollowup} />;
  return (
    <div className="grid gap-5">
      <Tiles items={[
        { label: "Credited so far", value: cash(stats.credited), note: "Money that reached Education Accounts", good: true },
        { label: "Scheduled", value: String(stats.scheduled), note: stats.scheduled ? `${cash(stats.scheduledTotal)} estimated, not credited yet` : "Nothing waiting to run" },
        { label: "Need attention", value: String(stats.attention), note: "Failed or partly failed", alert: stats.attention > 0 },
        { label: "All top-ups", value: String(rows.length), note: `${rows.filter((r) => r.type === "Batch").length} batch · ${rows.filter((r) => r.type === "Single").length} specific accounts` },
      ]} />
      <div className="card tablecard">
        <div className="toolbar filters-toolbar">
          <input className="filter-search" placeholder="Search ID or recipient..." aria-label="Search top-ups" value={q} onChange={(e) => setQ(e.target.value)} />
          <select aria-label="Filter by type" value={type} onChange={(e) => setType(e.target.value)}><option value="">All types</option><option value="Single">Specific Accounts</option><option value="Batch">Batch</option></select>
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
                <td><strong>{t.recipient}</strong><small>{typeLabel(t.type)} · {plural(t.accounts, "account")}</small></td>
                <td>{formatDate(t.date)}<small>{t.schedule}</small></td>
                <td style={{ textAlign: "right" }}>{cash(t.amount)}</td>
                <td style={{ textAlign: "right" }}><strong>{cash(t.amount * t.accounts)}</strong>{t.status === "Pending" && <small>Estimated, not credited</small>}</td>
                <td><span className={`badge ${statusClass(t.status)}`}>{t.status}</span></td>
                <td><div className="actiongroup"><button type="button" onClick={() => setViewingId(ledger[i].id)}>View details</button></div></td>
              </tr>
            )) : <tr><td colSpan={7} className="empty">No top-ups found.</td></tr>}
          </tbody></table></div>
      </div>
    </div>
  );
}

function Details({ t, id, items, accounts, rows, ledger, onOpen, onBack, onFollowup }: { t: Transaction; id: string; items: Target[]; accounts: Account[]; rows: Transaction[]; ledger: Ledger; onOpen: (id: string) => void; onBack: () => void; onFollowup: (id: string, picked: string[]) => void }) {
  const [q, setQ] = useState("");
  const [st, setSt] = useState("");
  // A Failed / Partial Success top-up can be retried: tick its failed accounts and open a NEW Specific Accounts top-up (this record never changes).
  const retry = useMemo(() => (t.status === "Failed" || t.status === "Partial Success" ? retryableAccounts(t, id, rows, accounts) : []), [t, id, rows, accounts]);
  const canRetry = t.status === "Failed" || t.status === "Partial Success";
  const [pick, setPick] = useState<string[]>(() => retry.map((a) => a.nric));
  const origin = t.followupOf ? ledger.find((l) => l.id === t.followupOf) : undefined;
  const followups = rows.map((r, i) => ({ r, id: ledger[i].id })).filter((x) => x.r.followupOf === id);
  const pending = t.status === "Pending", batch = t.type === "Batch";
  const count = (s: string) => items.filter((a) => a.status === s).length;
  const credited = count("Success");
  const failed = count("Failed");
  const hasReport = credited + failed > 0;
  const download = () => { const r = topUpReport(t, id, items, accounts); downloadXlsx(`${id}-top-up-report.xlsx`, "Top-up report", r.rows, r.opts); };
  const shown = items.filter((a) => (!st || a.status === st) && (!q.trim() || `${a.txid ?? ""} ${a.student} ${a.account} ${maskNric(a.account)} ${a.reason ?? ""}`.toLowerCase().includes(q.trim().toLowerCase())));
  return (
    <div className="grid gap-5">
      <button type="button" className="backline" style={{ justifySelf: "start" }} onClick={onBack}>← Back to Top-up History</button>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-on-surface">{t.recipient}</h2>
          <p className="mt-0.5 text-sm text-on-surface-variant">{id} · {typeLabel(t.type)} top-up</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`badge ${statusClass(t.status)}`}>{t.status}</span>
          <button type="button" className="btn primary" disabled={!hasReport} onClick={download} title={hasReport ? "Successful and failed records, in the Student Finance System format." : "Available once the top-up has run."}>Download Excel report</button>
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
          {t.followupOf && <Fact label="Created from failed top-up" wide>{origin ? <button type="button" className="inline-link" onClick={() => onOpen(t.followupOf!)}>{t.followupOf} ↗</button> : t.followupOf}</Fact>}
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
          <table className="data-table roomy" style={{ minWidth: 760 }}><thead><tr><th>{canRetry ? "Select / Student" : "Student"}</th><th>Education Account ID (NRIC)</th><th style={{ textAlign: "right" }}>Amount</th><th>Status</th><th>Transaction ID</th><th>Failure reason</th></tr></thead>
            <tbody>{shown.length ? shown.map((a) => (
              <tr key={a.account + (a.txid ?? "")}><td>{canRetry && a.status === "Failed" && (() => { const ok = retry.some((x) => x.nric === a.account); return <input type="checkbox" className="failed-pick" disabled={!ok} checked={ok && pick.includes(a.account)} onChange={(e) => setPick(e.target.checked ? [...pick, a.account] : pick.filter((x) => x !== a.account))} aria-label={`Select failed account ${a.student}`} title={ok ? "Include in a new Specific Accounts top-up" : "Account is not Active, or was already credited by a follow-up"} />; })()}<strong>{a.student}</strong></td><td>{maskNric(a.account)}</td><td style={{ textAlign: "right" }}>{cash(t.amount)}</td><td><span className={`badge ${targetClass(a.status)}`}>{a.status}</span></td><td>{a.txid ?? "—"}</td><td>{a.reason ?? "—"}</td></tr>
            )) : <tr><td colSpan={6} className="empty">No account transactions found.</td></tr>}</tbody></table>
        </div>
      </div>
      {canRetry && (
        <div className="card" style={{ padding: 20 }}>
          <h2 className="text-base font-semibold text-on-surface">Create a new Specific Accounts top-up</h2>
          <p className="small" style={{ margin: "8px 0 12px" }}>Tick the Failed accounts above, then continue to a new Specific Accounts top-up. The accounts, original amount and reason are pre-filled and you can review them before confirming. This original top-up stays unchanged.</p>
          <p className="small">{retry.length} failed account(s) available for follow-up. Accounts that are not Active, or were already credited by a follow-up, cannot be selected.</p>
          <div className="buttons"><button type="button" className="btn primary" disabled={!pick.some((x) => retry.some((a) => a.nric === x))} onClick={() => onFollowup(id, pick.filter((x) => retry.some((a) => a.nric === x)))}>＋ Continue with selected Failed accounts</button></div>
        </div>
      )}
      {followups.length > 0 && (
        <div className="card" style={{ padding: 20 }}>
          <h2 className="text-base font-semibold text-on-surface">Follow-up top-up(s)</h2>
          <ul className="followup-list">{followups.map((f) => <li key={f.id}><span>{typeLabel(f.r.type)} · {f.r.status} · {plural(f.r.accounts, "account")}</span><button type="button" className="inline-link" onClick={() => onOpen(f.id)}>{f.id} ↗</button></li>)}</ul>
        </div>
      )}
    </div>
  );
}
export default function TopUp() {
  const preset = (useLocation().state as { student?: Student } | null)?.student;
  // A School user with the Top-up module sees only their own school's accounts, single top-ups, and no rule tab.
  const { role, staff } = useSession();
  const { state: reg } = useRegistry();
  const movements = useMovements();
  const { state: tu, dispatch } = useTopUp();
  const ownSchool = role === "school" ? reg.schools.find((s) => s.code === staff?.schoolCode)?.name ?? "" : undefined;
  const tabs = ownSchool === undefined ? TABS : TABS.filter((t) => t.id === "transactions");
  // Every account is a real student, with the balance after top-ups paid in and fees paid out.
  const accounts = useMemo(
    () => accountsOf(reg.students, reg.classes, reg.schools, movements).filter((a) => ownSchool === undefined || a.school === ownSchool),
    [reg, movements, ownSchool],
  );
  const history = ownSchool === undefined ? tu.history : tu.history.filter((h) => h.school === ownSchool);
  const [tab, setTab] = useState<TabId>("transactions");
  const [creating, setCreating] = useState(Boolean(preset)); // a preset student opens the create form directly
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [retrying, setRetrying] = useState<{ id: string; picked: string[] } | null>(null); // a follow-up of a failed top-up (picked = NRICs)
  const [dialog, setDialog] = useState<DialogSpec | null>(null);
  const { notify, toast } = useToast();

  // The credit goes to the Education Account itself, so the student's page, the school and the parent all show it.
  const done = (row: Transaction, creditedIds: string[]) => dispatch({ type: "topUp", row: ownSchool === undefined ? row : { ...row, school: ownSchool }, creditedIds });
  const closeAsk = () => setDialog(null);
  const ledger = useMemo(() => ledgerIds(history, accounts), [history, accounts]);
  const followup = useMemo<Followup | undefined>(() => {
    const i = retrying ? ledger.findIndex((l) => l.id === retrying.id) : -1;
    if (!retrying || i < 0) return undefined;
    const row = history[i], pool = retryableAccounts(row, retrying.id, history, accounts);
    return {
      id: retrying.id, row, pool,
      picked: pool.filter((a) => retrying.picked.includes(a.nric)).map((a) => a.id),
      failed: ledger[i].targets.filter((x) => x.status === "Failed").map((x) => ({ student: x.student, account: x.account, ready: pool.some((a) => a.nric === x.account) })),
    };
  }, [retrying, ledger, history, accounts]);

  return (
    <div className="tu">
      <nav className="tabs" role="tablist" aria-label="Top-up workspace">
        {tabs.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={tab === t.id ? "active" : ""} onClick={() => { setTab(t.id); setCreating(false); setRetrying(null); }}>{t.label}</button>
        ))}
      </nav>
      {tab === "transactions" && (creating || followup
        ? <Execute key={followup?.id ?? "new"} rules={tu.rules} accounts={accounts} presetAccountId={followup ? undefined : preset?.id} singleOnly={ownSchool !== undefined} followup={followup} onBack={() => { setCreating(false); setRetrying(null); }} onDone={done} notify={notify} ask={setDialog} closeAsk={closeAsk} />
        : <History rows={history} accounts={accounts} ledger={ledger} viewingId={viewingId} setViewingId={setViewingId} onCreate={() => setCreating(true)} onFollowup={(id, picked) => setRetrying({ id, picked })} />)}
      {tab === "rules" && <Rules rules={tu.rules} onChange={(rules) => dispatch({ type: "setRules", rules })} notify={notify} ask={setDialog} closeAsk={closeAsk} />}
      <Dialog spec={dialog} onClose={closeAsk} />
      {toast}
    </div>
  );
}

import { useMemo, useState } from "react";
import { FREQUENCIES, type Account, type FundRule, type Transaction } from "../../../data/topup";
import { eligibleForRule, transactionCode } from "../../../lib/topup";
import { cash, sgToday, type DialogSpec } from "./tuUi";

type Props = {
  rules: FundRule[]; accounts: Account[]; presetAccountId?: string;
  onBack: () => void; onDone: (row: Transaction, creditedIds: string[]) => void;
  notify: (m: string) => void; ask: (d: DialogSpec) => void; closeAsk: () => void;
};

export default function Execute({ rules, accounts, presetAccountId, onBack, onDone, notify, ask, closeAsk }: Props) {
  const [mode, setMode] = useState<"single" | "batch">("single");
  const [accountId, setAccountId] = useState(presetAccountId ?? "");
  const [query, setQuery] = useState(() => { const a = accounts.find((x) => x.id === presetAccountId); return a ? `${a.name} (${a.id})` : ""; });
  const [open, setOpen] = useState(false);
  const [ruleId, setRuleId] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [timing, setTiming] = useState<"now" | "later">("now");
  const [date, setDate] = useState("");
  const [freq, setFreq] = useState<string>("Once");

  const student = accounts.find((a) => a.id === accountId) ?? null;
  const rule = rules.find((r) => r.id === ruleId && r.status === "Active") ?? null;
  const found = useMemo(() => { const q = query.trim().toLowerCase(); return accounts.filter((a) => !q || `${a.id} ${a.name}`.toLowerCase().includes(q)); }, [accounts, query]);
  const eligible = useMemo(() => (rule ? eligibleForRule(rule, accounts) : []), [rule, accounts]);
  const single = mode === "single";
  const amt = single ? Number(amount) || 0 : rule?.amount ?? 0;
  const n = single ? (student?.status === "Active" ? 1 : 0) : eligible.length;

  const changeMode = (m: "single" | "batch") => { setMode(m); setAccountId(""); setQuery(""); setOpen(false); setRuleId(""); setAmount(""); };
  const reset = () => { setReason(""); setDate(""); setFreq("Once"); setTiming("now"); changeMode("single"); };
  const pick = (a: Account) => { setAccountId(a.id); setQuery(`${a.name} (${a.id})`); setOpen(false); };

  const review = () => {
    const later = timing === "later";
    if (single && !student) return notify("Please select a student.");
    if (single && student!.status !== "Active") return notify("Education Account is not Active.");
    if (!single && !rule) return notify("Please select an active Batch Top-up Rule.");
    if (!Number.isInteger(amt) || amt <= 0) return notify("Enter a valid whole-dollar top-up amount.");
    if (!reason.trim()) return notify("Please enter a reason.");
    if (later && !date) return notify("Please select the execution date.");
    const targets = single ? [student!] : eligible;
    const label = single ? student!.name : rule!.name;
    ask({
      title: "Review and confirm",
      text: later ? "Review the scheduled top-up details." : "Review the top-up details before confirming.",
      details: `Top-up Type: ${single ? "Single" : "Batch"}\nRecipient: ${label}\nEligible accounts: ${targets.length}\n${single ? "Amount: " : "Amount per account: "}${cash(amt)}${single ? "" : `\nEstimated total: ${cash(targets.length * amt)}`}\nReason: ${reason.trim()}\nExecution: ${later ? `${date} · ${freq}` : "Execute now"}`,
      confirmLabel: "Confirm",
      onConfirm: () => {
        const d = later ? date : sgToday();
        onDone({
          ref: transactionCode(d), type: single ? "Single" : "Batch",
          recipient: single ? `${student!.name} (${student!.id})` : rule!.name,
          detail: single ? `Education Account ${student!.id} · ${reason.trim()}` : reason.trim(),
          date: d, schedule: later ? freq : "Run now (ad-hoc)", accounts: targets.length, amount: amt, status: later ? "Pending" : "Success", by: "Daniel Lee",
        }, later ? [] : targets.map((a) => a.id));
        closeAsk(); notify(later ? "Schedule recorded in demo." : "Top-up simulated successfully."); onBack();
      },
    });
  };

  const row = (k: string, v: string) => <div className="summaryrow"><span>{k}</span><strong>{v}</strong></div>;

  return (
    <div>
      <button type="button" className="backline" onClick={onBack}>← Back to top-up transactions</button>
      <div className="two">
        <div className="card leftcard"><h2>Create top-up</h2>
          <div className="field"><label>Top-up Type</label><div className="switch">
            <button type="button" className={single ? "selected" : ""} onClick={() => changeMode("single")}>Single</button>
            <button type="button" className={!single ? "selected" : ""} onClick={() => changeMode("batch")}>Batch</button></div></div>

          {single ? (
            <div>
              <div className="field"><label htmlFor="student-input">Find student by name or ID <span className="required">*</span></label>
                <div className="combo" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false); }}>
                  <input id="student-input" type="text" autoComplete="off" role="combobox" aria-expanded={open} aria-controls="student-dropdown" placeholder="Select or search student name / ID..."
                    value={query} onFocus={() => setOpen(true)}
                    onChange={(e) => { setQuery(e.target.value); setAccountId(""); setOpen(true); }}
                    onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); if (e.key === "Enter") { e.preventDefault(); if (found[0]) pick(found[0]); } }} />
                  {open && (
                    <div className="combo-pop" id="student-dropdown">
                      {found.length ? found.map((a) => (
                        <button key={a.id} type="button" className="studentitem" onClick={() => pick(a)}>
                          <span><strong>{a.name}</strong><small>{a.school || "No current school"}</small></span>
                          <span className="studentaccount"><strong>{cash(a.balance)}</strong><small>{a.id} · {a.status}</small></span>
                        </button>
                      )) : <div className="empty">No students found</div>}
                    </div>
                  )}
                </div>
                <div className="help">Exact Education Account balance is shown to MOE HQ.</div></div>
              {student && (
                <div className="selected-account">
                  <div><small>Student name</small><strong>{student.name}</strong></div>
                  <div><small>Education account</small><strong>{student.id}</strong></div>
                  <div><small>Account status</small><strong>{student.status}</strong></div>
                  <div><small>Account balance</small><strong>{cash(student.balance)}</strong></div>
                </div>
              )}
            </div>
          ) : (
            <div>
              <div className="field"><label htmlFor="selected-rule">Batch Top-up Rule <span className="required">*</span></label>
                <select id="selected-rule" value={ruleId} onChange={(e) => setRuleId(e.target.value)}>
                  <option value="">Select an active rule...</option>
                  {rules.filter((r) => r.status === "Active").map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
                <div className="help">Rules are created in the Batch Top-up Rule tab. Only Active rules appear here.</div></div>
              {rule && <div className="rule-summary">{`Top-up per account: ${cash(rule.amount)} · ${rule.ageMin}–${rule.ageMax} yrs · ${cash(rule.minBalance)} to under ${cash(rule.maxBalance)} · ${rule.schooling} · ${rule.schools.length ? `${rule.schools.length} schools` : "All schools"}`}</div>}
            </div>
          )}

          {single && <div className="field"><label htmlFor="amount">Amount (S$) <span className="required">*</span></label>
            <input id="amount" type="number" min={1} step={1} placeholder="e.g. 200" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>}
          <div className="field"><label htmlFor="reason">Reason <span className="required">*</span></label>
            <textarea id="reason" maxLength={500} placeholder="e.g. ad-hoc student assistance" value={reason} onChange={(e) => setReason(e.target.value)} />
            <div className="help">Required for Single and Batch top-ups. Max 500 characters. Kept in transaction history.</div></div>
          <div className="field"><label>Execution timing</label><div className="switch">
            <button type="button" className={timing === "now" ? "selected" : ""} onClick={() => setTiming("now")}>Execute now</button>
            <button type="button" className={timing === "later" ? "selected" : ""} onClick={() => setTiming("later")}>Schedule for later</button></div></div>
          {timing === "later" && (<>
            <div className="field"><label htmlFor="schedule-date">Execution date <span className="required">*</span></label><input type="date" id="schedule-date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <div className="field"><label htmlFor="schedule-frequency">Frequency <span className="required">*</span></label>
              <select id="schedule-frequency" value={freq} onChange={(e) => setFreq(e.target.value)}>{FREQUENCIES.map((f) => <option key={f}>{f}</option>)}</select></div>
          </>)}
          <div className="buttons"><button type="button" className="btn" onClick={reset}>Reset</button><button type="button" className="btn primary" onClick={review}>Review and confirm</button></div>
        </div>

        <div className="card rightcard"><h2>Top-up summary</h2>
          {row("Type", single ? "Single" : "Batch")}
          {row(single ? "Recipient" : "Target", single ? student?.name ?? "Not selected" : rule?.name ?? "Not selected")}
          {!single && row("Eligible accounts", rule ? String(n) : "Preview required")}
          {row(single ? "Amount" : "Per account", cash(amt))}
          {row("Reason", reason.trim() || "Not entered")}
          {row("Execution", timing === "now" ? "Execute now" : `Schedule for later · ${freq}`)}
          {!single && row("Estimated total", n && amt ? cash(n * amt) : "-")}
          {!single && (
            <div className="summary-eligible-list"><h3>Eligible accounts</h3>
              <div className="scroll-small">
                {!rule ? <div className="empty">Select an active rule to view eligible accounts.</div>
                  : eligible.length ? eligible.map((a) => <div className="eligible-item" key={a.id}><div><strong>{a.name}</strong><small>{a.id}</small></div><span className="account-id">{a.id}</span></div>)
                  : <div className="empty">No eligible accounts found.</div>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

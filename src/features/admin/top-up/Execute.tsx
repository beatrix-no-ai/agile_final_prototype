import { useMemo, useState } from "react";
import { FREQUENCIES, type Account, type FundRule, type Transaction } from "../../../data/topup";
import { activeRulesInOrder, overlapCount, stackRules, transactionCode } from "../../../lib/topup";
import { maskNric } from "../../../lib/nric";
import { cash, sgToday, type DialogSpec } from "./tuUi";

type Props = {
  rules: FundRule[]; accounts: Account[]; presetAccountId?: string;
  onBack: () => void; onDone: (row: Transaction, creditedIds: string[]) => void;
  notify: (m: string) => void; ask: (d: DialogSpec) => void; closeAsk: () => void;
};

/** Batches this big or bigger are expected to run off-hours; the form suggests a night time. ASSUMPTION: threshold and 02:00 are placeholders until MOE confirms. */
const LARGE_BATCH = 20;
const NIGHT_TIME = "02:00";
/** Batch rule picker value that runs every Active rule, one after another in creation order. */
const ALL = "ALL";
/** Input sanity only, not a business limit (the customer does not want limits on top-up rules). */
const MAX_AMOUNT = 99_999_999;

export default function Execute({ rules, accounts, presetAccountId, onBack, onDone, notify, ask, closeAsk }: Props) {
  const [mode, setMode] = useState<"single" | "batch">("single");
  const [accountId, setAccountId] = useState(presetAccountId ?? "");
  const [query, setQuery] = useState(() => { const a = accounts.find((x) => x.id === presetAccountId); return a ? `${a.name} (${maskNric(a.nric)})` : ""; });
  const [open, setOpen] = useState(false);
  const [ruleId, setRuleId] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [timing, setTiming] = useState<"now" | "later">("now");
  const [date, setDate] = useState("");
  const [freq, setFreq] = useState<string>("Once");
  const [time, setTime] = useState(NIGHT_TIME);

  const student = accounts.find((a) => a.id === accountId) ?? null;
  const active = useMemo(() => activeRulesInOrder(rules), [rules]);
  const all = ruleId === ALL;
  const rule = active.find((r) => r.id === ruleId) ?? null;
  const picked = useMemo(() => (all ? active : rule ? [rule] : []), [all, active, rule]);
  const found = useMemo(() => { const q = query.trim().toLowerCase(); return accounts.filter((a) => a.status === "Active" && (!q || `${a.nric} ${maskNric(a.nric)} ${a.name}`.toLowerCase().includes(q))); }, [accounts, query]);
  const stack = useMemo(() => stackRules(picked, accounts), [picked, accounts]);
  const eligible = useMemo(() => stack.flatMap((s) => s.accounts), [stack]);
  const stacked = overlapCount(stack);
  const single = mode === "single";
  const amt = single ? Number(amount) || 0 : picked[0]?.amount ?? 0;
  const batchTotal = stack.reduce((t, s) => t + s.accounts.length * s.rule.amount, 0);
  const n = single ? (student?.status === "Active" ? 1 : 0) : eligible.length;
  const large = !single && n >= LARGE_BATCH;

  const changeMode = (m: "single" | "batch") => { setMode(m); setAccountId(""); setQuery(""); setOpen(false); setRuleId(""); setAmount(""); };
  const reset = () => { setReason(""); setDate(""); setFreq("Once"); setTiming("now"); changeMode("single"); };
  const pick = (a: Account) => { setAccountId(a.id); setQuery(`${a.name} (${maskNric(a.nric)})`); setOpen(false); };

  const review = () => {
    const later = timing === "later";
    if (single && !student) return notify("Please select a student.");
    if (single && student!.status !== "Active") return notify("Education Account is not Active.");
    if (!single && !picked.length) return notify("Please select an active Batch Top-up Rule.");
    if (single && (!Number.isSafeInteger(amt) || amt <= 0 || amt > MAX_AMOUNT)) return notify(`Enter a whole-dollar top-up amount from S$1 to ${cash(MAX_AMOUNT)}.`);
    if (!reason.trim()) return notify("Please enter a reason.");
    if (later && !date) return notify("Please select the execution date.");
    if (later && !time) return notify("Please select the execution time.");
    const runs = single
      ? [{ name: student!.name, rule: undefined as FundRule | undefined, amount: amt, targets: [student!] }]
      : stack.map((s) => ({ name: s.rule.name, rule: s.rule as FundRule | undefined, amount: s.rule.amount, targets: s.accounts }));
    if (!single && runs.every((r) => !r.targets.length)) return notify("No eligible accounts found.");
    const total = runs.reduce((t, r) => t + r.targets.length * r.amount, 0);
    const when = later ? `${date} at ${time}` : "Execute now";
    ask({
      title: "Review and confirm",
      text: later ? "Review the scheduled top-up details." : "Review the top-up details before confirming.",
      details: `Top-up Type: ${single ? "Single" : "Batch"}\nRecipient: ${all ? `All active rules (${runs.length}), in creation order` : runs[0].name}\nEligible accounts: ${single ? 1 : eligible.length}${!single && stacked ? ` (${stacked} qualify for more than one rule and receive each top-up)` : ""}\n${single ? "Amount: " : "Estimated total: "}${cash(single ? amt : total)}\nReason: ${reason.trim()}\nExecution: ${later ? `${when} · ${freq}` : when}`,
      confirmLabel: "Confirm",
      onConfirm: () => {
        const d = later ? date : sgToday();
        // One history row per rule, oldest rule first, so overlapping rules stack in creation order.
        for (const r of runs) {
          if (!single && !r.targets.length) continue;
          onDone({
            ref: transactionCode(d), type: single ? "Single" : "Batch",
            recipient: single ? `${student!.name} (${maskNric(student!.nric)})` : r.name,
            detail: single ? `Education Account ${maskNric(student!.nric)} · ${reason.trim()}` : reason.trim(),
            date: d, schedule: later ? `${freq} · ${time}` : "Run now (ad-hoc)", targets: r.targets.map((a) => ({ student: a.name, account: a.nric, status: later ? ("Pending" as const) : ("Success" as const) })), accounts: r.targets.length, amount: r.amount, status: later ? "Pending" : "Success", by: "Daniel Lee",
          }, later ? [] : r.targets.map((a) => a.id));
        }
        closeAsk(); notify(later ? "Schedule recorded in demo." : "Top-up simulated successfully."); onBack();
      },
    });
  };

  const row = (k: string, v: string) => <div className="summaryrow"><span>{k}</span><strong>{v}</strong></div>;

  return (
    <div>
      <button type="button" className="backline" onClick={onBack}>← Back to Top-up History</button>
      <div className="two">
        <div className="card leftcard"><h2>Create top-up</h2>
          <div className="field"><label>Top-up Type</label><div className="switch">
            <button type="button" className={single ? "selected" : ""} onClick={() => changeMode("single")}>Single</button>
            <button type="button" className={!single ? "selected" : ""} onClick={() => changeMode("batch")}>Batch</button></div></div>

          {single ? (
            <div>
              <div className="field"><label htmlFor="student-input">Find student by name or NRIC <span className="required">*</span></label>
                <div className="combo" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false); }}>
                  <input id="student-input" type="text" autoComplete="off" role="combobox" aria-expanded={open} aria-controls="student-dropdown" placeholder="Select or search student name / NRIC..."
                    value={query} onFocus={() => setOpen(true)}
                    onChange={(e) => { setQuery(e.target.value); setAccountId(""); setOpen(true); }}
                    onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); if (e.key === "Enter") { e.preventDefault(); if (found[0]) pick(found[0]); } }} />
                  {open && (
                    <div className="combo-pop" id="student-dropdown">
                      {found.length ? found.map((a) => (
                        <button key={a.id} type="button" className="studentitem" onClick={() => pick(a)}>
                          <span><strong>{a.name}</strong><small>{a.school || "No current school"}</small></span>
                          <span className="studentaccount"><strong>{cash(a.balance)}</strong><small>{maskNric(a.nric)} · {a.status}</small></span>
                        </button>
                      )) : <div className="empty">No students found</div>}
                    </div>
                  )}
                </div>
                <div className="help">Only students with an Active Education Account can be selected. Exact balance is shown to MOE HQ.</div></div>
              {student && (
                <div className="selected-account">
                  <div><small>Student name</small><strong>{student.name}</strong></div>
                  <div><small>Education Account ID (NRIC)</small><strong>{maskNric(student.nric)}</strong></div>
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
                  {active.length > 1 && <option value={ALL}>All active rules ({active.length}), in creation order</option>}
                  {active.map((r) => <option key={r.id} value={r.id}>{r.id} · {r.name}</option>)}
                </select>
                <div className="help">Rules are created in the Batch Top-up Rule tab. Only Active rules appear here. Rules may overlap: a student who matches several rules receives each top-up, in the order the rules were created.</div></div>
              {all && <div className="rule-summary">{active.map((r) => `${r.id} ${r.name}: ${cash(r.amount)}`).join(" → ")}</div>}
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
          {timing === "now" && large && <div className="help" role="note" style={{ marginBottom: 12 }}>This batch has {n} top-ups. Large batches are best scheduled for off-hours (for example {NIGHT_TIME}) to keep the system responsive.</div>}
          {timing === "later" && (<>
            <div className="field"><label htmlFor="schedule-date">Execution date <span className="required">*</span></label><input type="date" id="schedule-date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <div className="field"><label htmlFor="schedule-time">Execution time <span className="required">*</span></label><input type="time" id="schedule-time" value={time} onChange={(e) => setTime(e.target.value)} />
              <div className="help">{single ? "Choose when the top-up runs." : `Large batches should run off-hours. Night time ${NIGHT_TIME} is suggested.`}</div></div>
            <div className="field"><label htmlFor="schedule-frequency">Frequency <span className="required">*</span></label>
              <select id="schedule-frequency" value={freq} onChange={(e) => setFreq(e.target.value)}>{FREQUENCIES.map((f) => <option key={f}>{f}</option>)}</select></div>
          </>)}
          <div className="buttons"><button type="button" className="btn" onClick={reset}>Reset</button><button type="button" className="btn primary" onClick={review}>Review and confirm</button></div>
        </div>

        <div className="card rightcard"><h2>Top-up summary</h2>
          {row("Type", single ? "Single" : "Batch")}
          {row(single ? "Recipient" : "Target", single ? student?.name ?? "Not selected" : all ? `All active rules (${active.length})` : rule?.name ?? "Not selected")}
          {!single && row("Top-ups to run", picked.length ? `${eligible.length}${stacked ? ` (${stacked} account(s) stack more than one rule)` : ""}` : "Preview required")}
          {single ? row("Amount", cash(amt)) : row("Per account", all ? "Varies by rule" : cash(amt))}
          {row("Reason", reason.trim() || "Not entered")}
          {row("Execution", timing === "now" ? "Execute now" : `Schedule for later · ${freq}${time ? ` · ${time}` : ""}`)}
          {!single && row("Estimated total", batchTotal ? cash(batchTotal) : "-")}
          {!single && (
            <div className="summary-eligible-list"><h3>Eligible accounts</h3>
              <div className="scroll-small">
                {!picked.length ? <div className="empty">Select an active rule to view eligible accounts.</div>
                  : eligible.length ? stack.flatMap((s) => s.accounts.map((a) => <div className="eligible-item" key={`${s.rule.id}-${a.id}`}><div><strong>{a.name}</strong><small>{maskNric(a.nric)}{all ? ` · ${s.rule.id}` : ""}</small></div><span className="account-id">{cash(s.rule.amount)}</span></div>))
                  : <div className="empty">No eligible accounts found.</div>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

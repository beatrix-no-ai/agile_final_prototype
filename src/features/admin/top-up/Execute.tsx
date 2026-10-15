import { useMemo, useState, type ReactNode } from "react";
import { ArrowLeft } from "@phosphor-icons/react";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { Field, inputClass } from "../../../components/ui/Field";
import { Modal } from "../../../components/ui/Modal";
import { Segmented } from "../../../components/ui/Segmented";
import { Badge } from "../../../components/ui/Badge";
import type { Account, Execution, FundRule, Schedule } from "../../../data/topup";
import { parseAmount } from "../../../lib/amount";
import { formatSGD } from "../../../lib/format";
import { balanceBand, eligibleForRule, nextExecutionId, totalFunds } from "../../../lib/topup";

/** Today in Singapore (UTC+8), as YYYY-MM-DD, regardless of the browser time zone. */
export const sgToday = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Singapore" });

export const SCHEDULE_LABEL: Record<Schedule, string> = {
  now: "Run now (ad-hoc)", once: "Once, on a date", weekly: "Weekly", monthly: "Monthly", quarterly: "Quarterly", yearly: "Yearly",
};
const LATER: Schedule[] = ["once", "weekly", "monthly", "quarterly", "yearly"];

type Props = { rules: FundRule[]; accounts: Account[]; history: Execution[]; onDone: (x: Execution, creditedIds: string[]) => void; presetAccountId?: string; onBack: () => void };

function Row({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line py-2.5 text-sm last:border-0">
      <dt className="text-on-surface-variant">{k}</dt>
      <dd className="text-right font-semibold text-on-surface">{v}</dd>
    </div>
  );
}

export default function Execute({ rules, accounts, history, onDone, presetAccountId, onBack }: Props) {
  const [mode, setMode] = useState<"single" | "batch">("single");
  const [accountId, setAccountId] = useState(presetAccountId ?? "");
  const [ruleId, setRuleId] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [find, setFind] = useState(() => { const a = presetAccountId ? accounts.find((x) => x.id === presetAccountId) : undefined; return a ? `${a.name} (${a.id})` : ""; });
  const [open, setOpen] = useState(false);
  const [timing, setTiming] = useState<"now" | "later">("now");
  const [date, setDate] = useState("");
  const [freq, setFreq] = useState<Schedule>("once");
  const [snapshot, setSnapshot] = useState<string[] | null>(null); // eligible ids frozen at Preview
  const [attempted, setAttempted] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [signed, setSigned] = useState(false);

  const today = sgToday();
  const later = timing === "later";
  const rule = rules.find((r) => r.id === ruleId && r.status === "Active");
  const account = accounts.find((a) => a.id === accountId);
  const ids = mode === "single" ? (account ? [account.id] : []) : snapshot ?? [];
  const amt = parseAmount(amount);
  const per = "value" in amt ? amt.value : 0;
  const known = mode === "single" ? Boolean(account) : snapshot !== null;
  const matches = useMemo(() => {
    const q = find.trim().toLowerCase();
    return accounts.filter((a) => (!q || `${a.name} ${a.id}`.toLowerCase().includes(q)));
  }, [accounts, find]);
  const preview = useMemo(() => (snapshot ?? []).flatMap((id) => accounts.find((a) => a.id === id) ?? []), [snapshot, accounts]);

  const errors = {
    target:
      mode === "single"
        ? !account ? "Select an Education Account." : account.status !== "Active" ? "This Education Account is not Active. Top-up cannot proceed." : ""
        : !rule ? "Select an active funding rule." : snapshot?.length ? "" : "No account matches this rule.",
    amount: "error" in amt ? amt.error : "",
    reason: reason.trim() ? "" : "Enter a reason for this top-up.",
    date: later ? (!date ? "Choose the first execution date." : date < today ? "Choose today or a future date." : "") : "",
  };
  // Untouched fields stay quiet until the first Review attempt.
  const show = attempted ? errors : { target: account && account.status !== "Active" ? errors.target : "", amount: amount !== "" ? errors.amount : "", reason: "", date: "" };
  const valid = !errors.target && !errors.amount && !errors.reason && !errors.date;

  const reset = () => {
    setMode("single"); setAccountId(""); setFind(""); setOpen(false); setRuleId(""); setAmount(""); setReason(""); setTiming("now"); setDate(""); setFreq("once"); setSnapshot(null); setAttempted(false);
  };
  const pickRule = (id: string) => {
    setRuleId(id);
    const r = rules.find((x) => x.id === id && x.status === "Active");
    setSnapshot(r ? eligibleForRule(r, accounts).map((a) => a.id) : null); // eligible ids frozen when the rule is picked
    setAmount(r ? String(r.amount) : "");
  };
  const pickAccount = (a: Account) => { setAccountId(a.id); setFind(`${a.name} (${a.id})`); setOpen(false); };
  const clearAccount = () => { setAccountId(""); setFind(""); };
  const review = () => { setAttempted(true); if (valid) setConfirm(true); };
  const close = () => { setConfirm(false); setSigned(false); };

  const execute = () => {
    const x: Execution = {
      id: nextExecutionId(history),
      type: mode === "batch" ? "Batch" : "Single",
      title: mode === "batch" ? rule!.name : `Single top-up: ${account!.name}`,
      reason: reason.trim(), schedule: later ? freq : "now", eligible: ids.length, amount: per, total: totalFunds(ids.length, per),
      date: later ? date : today, by: "HQ Officer", status: later ? "Pending" : "Success",
    };
    onDone(x, later ? [] : ids);
    close();
    reset();
    onBack();
  };

  return (
    <div>
    <button type="button" onClick={onBack} className="mb-3 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
      <ArrowLeft size={16} weight="bold" aria-hidden="true" /> Back to top-up transactions
    </button>
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(17rem,1fr)] lg:items-start">
      <Card title="Create top-up">
        <div className="space-y-5">
          <div>
            <p className="mb-1.5 text-[13px] font-semibold">Top-up type</p>
            <Segmented label="Top-up type" value={mode} onChange={(m) => { setMode(m); setAttempted(false); setAmount(""); setSnapshot(null); setRuleId(""); }} options={[{ value: "single", label: "Single" }, { value: "batch", label: "Batch" }]} />
          </div>

          {mode === "single" ? (
            <div className="space-y-3">
              <div className="relative" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false); }}>
                <Field label="Find student by name or ID" required error={show.target} hint="Exact balances are restricted; a balance range is shown instead.">
                  <input className={inputClass} role="combobox" aria-expanded={open} aria-controls="topup-student-results" autoComplete="off" placeholder="Select or search student name / ID..." value={find}
                    onFocus={() => setOpen(true)}
                    onChange={(e) => { setFind(e.target.value); if (accountId) setAccountId(""); setOpen(true); }}
                    onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); if (e.key === "Enter" && open && matches[0]) { e.preventDefault(); pickAccount(matches[0]); } }} />
                </Field>
                {open && (
                  <ul id="topup-student-results" role="listbox" className="absolute inset-x-0 z-20 mt-1 max-h-64 divide-y divide-line overflow-auto rounded-control border border-line bg-surface-container-lowest shadow-lg">
                    {matches.map((a) => (
                      <li key={a.id} role="option" aria-selected={a.id === accountId}>
                        <button type="button" onClick={() => pickAccount(a)} className="flex min-h-11 w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary">
                          <span><span className="font-semibold">{a.name}</span><span className="block text-[13px] text-on-surface-variant">{a.id} · {a.school} · {a.class}</span></span>
                          <span className="text-right text-[13px]"><span className="block">{balanceBand(a.balance)}</span><Badge tone={a.status === "Active" ? "success" : "alert"}>{a.status}</Badge></span>
                        </button>
                      </li>
                    ))}
                    {!matches.length && <li className="px-3 py-3 text-sm text-on-surface-variant">No students found. Try another name, ID or school.</li>}
                  </ul>
                )}
              </div>
              {account && (
                <dl className="rounded-control border border-line bg-surface-container-low px-3 text-sm">
                  <div className="flex items-center justify-between gap-3 border-b border-line py-2"><dt className="font-semibold">Selected student</dt><dd><Button size="sm" variant="ghost" onClick={clearAccount}>Change student</Button></dd></div>
                  <Row k="Student" v={account.name} />
                  <Row k="Education account" v={account.id} />
                  <Row k="Balance range" v={balanceBand(account.balance)} />
                  <Row k="Account status" v={account.status} />
                </dl>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <Field required label="Funding rule" hint="Rules are created in the Batch top-up rule tab. Only Active rules appear here." error={show.target}>
                <select className={inputClass} value={ruleId} onChange={(e) => pickRule(e.target.value)}>
                  <option value="">Select an active rule...</option>
                  {rules.filter((r) => r.status === "Active").map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </Field>
              {rule && (
                <div className="rounded-control border border-line bg-surface-container-low p-3 text-sm">
                  <p className="font-semibold">{rule.name}</p>
                  <p className="mt-0.5 text-on-surface-variant">Age {rule.ageMin}-{rule.ageMax}, balance {formatSGD(rule.minBalance)} to under {formatSGD(rule.maxBalance)}, schooling: {rule.schooling}, {rule.schools.length ? `${rule.schools.length} selected school(s)` : "all schools"}. Active accounts only.</p>
                </div>
              )}
            </div>
          )}

          {mode === "single" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field required label="Amount (S$)" error={show.amount}>
                <input className={inputClass} inputMode="decimal" placeholder="e.g. 200" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </Field>
            </div>
          )}
          <Field label="Reason" required error={show.reason} hint="Required for single and batch top-ups. Max 500 characters. Kept in transaction history.">
            <textarea className={`${inputClass} py-2`} rows={3} maxLength={500} placeholder="e.g. ad-hoc student assistance" value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>

          <div>
            <p className="mb-1.5 text-[13px] font-semibold">Execution timing</p>
            <Segmented label="Execution timing" value={timing} onChange={setTiming} options={[{ value: "now", label: "Execute now" }, { value: "later", label: "Schedule for later" }]} />
          </div>
          {later && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field required label="First execution date" error={show.date}>
                <input className={inputClass} type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} />
              </Field>
              <Field label="Frequency">
                <select className={inputClass} value={freq} onChange={(e) => setFreq(e.target.value as Schedule)}>
                  {LATER.map((s) => <option key={s} value={s}>{SCHEDULE_LABEL[s]}</option>)}
                </select>
              </Field>
            </div>
          )}
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={reset}>Reset</Button>
          <Button onClick={review}>{later ? "Review schedule" : "Review and confirm"}</Button>
        </div>
      </Card>

      <Card title="Top-up summary" className="lg:sticky lg:top-6">
        <dl>
          <Row k="Type" v={mode === "single" ? "Single" : "Batch"} />
          <Row k={mode === "single" ? "Recipient" : "Target"} v={mode === "single" ? account?.name ?? "Not selected" : rule?.name ?? "Not selected"} />
          <Row k="Eligible accounts" v={known ? ids.length : "-"} />
          <Row k={mode === "batch" ? "Per account" : "Amount"} v={formatSGD(per)} />
          <Row k="Reason" v={<span className="break-words">{reason.trim() || "Not entered"}</span>} />
          <Row k="Execution" v={later ? `${SCHEDULE_LABEL[freq]}${date ? `, from ${date}` : ""}` : "Execute now"} />
          <Row k="Estimated total" v={<span className="text-lg text-primary">{known ? formatSGD(totalFunds(ids.length, per)) : "-"}</span>} />
        </dl>
        {mode === "batch" && (
          <div className="mt-4 border-t border-line pt-3">
            <h3 className="text-[13px] font-semibold">Eligible accounts</h3>
            {preview.length ? (
              <ul className="mt-2 max-h-64 divide-y divide-line overflow-auto text-sm">
                {preview.map((a) => (
                  <li key={a.id} className="flex justify-between gap-3 py-2"><span className="font-semibold">{a.name}</span><span className="text-[13px] text-on-surface-variant">{a.id}</span></li>
                ))}
              </ul>
            ) : <p className="mt-2 text-sm text-on-surface-variant">{snapshot ? "No eligible accounts found." : "Select an active rule to view eligible accounts."}</p>}
          </div>
        )}
      </Card>

      <Modal
        open={confirm}
        onClose={close}
        title={later ? "Confirm top-up schedule" : "Confirm top-up"}
        footer={<><Button variant="secondary" onClick={close}>Cancel</Button><Button onClick={execute} disabled={!signed}>{later ? "Save schedule" : "Execute top-up"}</Button></>}
      >
        <dl>
          <Row k="Recipient" v={mode === "batch" ? rule?.name : account?.name} />
          {mode === "batch" && <Row k="Accounts" v={ids.length} />}
          <Row k={mode === "batch" ? "Per account" : "Amount"} v={formatSGD(per)} />
          {mode === "batch" && <Row k="Total funds" v={formatSGD(totalFunds(ids.length, per))} />}
          <Row k="Reason" v={<span className="break-words">{reason.trim()}</span>} />
          <Row k="Execution" v={later ? `${SCHEDULE_LABEL[freq]}, from ${date}` : "Now"} />
        </dl>
        {/* ASSUMPTION: dual sign-off is one confirmation checkbox; the real second-officer approval flow is undefined. */}
        <label className="mt-4 flex min-h-11 cursor-pointer items-start gap-3 rounded-control border border-line bg-surface-container-low p-3 text-on-surface">
          <input type="checkbox" checked={signed} onChange={(e) => setSigned(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-primary" />
          <span className="font-semibold">A second authorised officer has approved this top-up (required)</span>
        </label>
      </Modal>
    </div>
    </div>
  );
}

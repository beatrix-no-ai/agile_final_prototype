import { useState } from "react";
import { useRegistry } from "../../../data/registryStore";
import { SCHOOLING, type FundRule, type RuleSchooling, type RuleStatus } from "../../../data/topup";
import { nextRuleId } from "../../../lib/topup";
import { cash, type DialogSpec } from "./tuUi";

type Props = { rules: FundRule[]; onChange: (next: FundRule[]) => void; notify: (m: string) => void; ask: (d: DialogSpec) => void; closeAsk: () => void };

const badgeClass = (s: RuleStatus) => (s === "Draft" ? "draft" : s === "Deactivated" ? "deactivated" : "");
const range = (r: FundRule) => `${cash(r.minBalance)} to under ${cash(r.maxBalance)}`;

export default function Rules(props: Props) {
  const [form, setForm] = useState<{ view: FundRule | null } | null>(null);
  return form ? <RuleForm {...props} view={form.view} onBack={() => setForm(null)} /> : <RuleList {...props} onAdd={() => setForm({ view: null })} onView={(r) => setForm({ view: r })} />;
}

function RuleList({ rules, onChange, onAdd, onView, notify, ask, closeAsk }: Props & { onAdd: () => void; onView: (r: FundRule) => void }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const list = rules.filter((r) => (!q.trim() || `${r.id} ${r.name}`.toLowerCase().includes(q.trim().toLowerCase())) && (!status || r.status === status));
  const setStatusOf = (id: string, s: RuleStatus) => onChange(rules.map((r) => (r.id === id ? { ...r, status: s } : r)));
  const toggle = (r: FundRule) => {
    if (r.status === "Active") { setStatusOf(r.id, "Deactivated"); notify(`Rule ${r.id} deactivated.`); return; }
    ask({
      title: "Activate Batch Top-up Rule?", text: "Are you sure you want to activate this rule?",
      details: `Rule: ${r.name}\nOnce activated, this rule will be available for Batch Top-up Execution.`, confirmLabel: "Activate",
      onConfirm: () => { closeAsk(); setStatusOf(r.id, "Active"); notify(`Rule ${r.id} activated.`); },
    });
  };
  return (
    <div className="card tablecard">
      <div className="toolbar">
        <input type="search" placeholder="Search rule name or ID..." value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search rules" />
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status"><option value="">All statuses</option><option>Active</option><option>Draft</option><option>Deactivated</option></select>
        <button type="button" className="btn primary" onClick={onAdd}>＋ Add rule</button>
      </div>
      <div className="tablewrap"><table className="data-table"><thead><tr><th>Rule ID</th><th>Rule name</th><th>Age range</th><th>Balance range</th><th>Schooling status</th><th>Schools</th><th>Top-up</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>
          {list.length ? list.map((r) => (
            <tr key={r.id}>
              <td>{r.id}</td><td><strong>{r.name}</strong></td><td>{r.ageMin}–{r.ageMax} yrs</td><td>{range(r)}</td><td>{r.schooling}</td>
              <td>{r.schools.length ? `${r.schools.length} selected` : "All schools"}</td><td>{cash(r.amount)}</td>
              <td><span className={`badge ${badgeClass(r.status)}`}>{r.status}</span></td>
              <td><div className="actiongroup">
                <button type="button" onClick={() => onView(r)}>View</button>
                <button type="button" onClick={() => toggle(r)}>{r.status === "Active" ? "Deactivate" : "Activate"}</button>
              </div></td>
            </tr>
          )) : <tr><td className="empty" colSpan={9}>No Batch Top-up Rules found.</td></tr>}
        </tbody></table></div>
    </div>
  );
}

function RuleForm({ rules, onChange, onBack, view: v, notify, ask, closeAsk }: Props & { onBack: () => void; view: FundRule | null }) {
  const ro = Boolean(v);
  const [name, setName] = useState(v?.name ?? "");
  const [amount, setAmount] = useState(String(v?.amount ?? 200));
  const [ageMin, setAgeMin] = useState(String(v?.ageMin ?? 7));
  const [ageMax, setAgeMax] = useState(String(v?.ageMax ?? 16));
  const [balMin, setBalMin] = useState(String(v?.minBalance ?? 0));
  const [balMax, setBalMax] = useState(String(v?.maxBalance ?? 500));
  const [schooling, setSchooling] = useState<string>(v?.schooling ?? "");
  const { state: reg } = useRegistry();
  const [find, setFind] = useState("");
  const [schools, setSchools] = useState<string[]>(v?.schools ?? []);
  const [error, setError] = useState("");

  const shown = reg.schools.filter((s) => `${s.name} ${s.level}`.toLowerCase().includes(find.trim().toLowerCase()));

  const save = (status: RuleStatus) => {
    const a = Number(amount), mn = Number(ageMin), mx = Number(ageMax), bmin = Number(balMin), bmax = Number(balMax);
    const err = !name.trim() ? "Rule name is required."
      : !Number.isInteger(a) || a <= 0 ? "Top-up amount must be a positive whole number."
      : !Number.isInteger(mn) || !Number.isInteger(mx) || mn < 0 || mn > mx ? "Minimum and maximum age are invalid."
      : !Number.isFinite(bmin) || !Number.isFinite(bmax) || bmin < 0 || bmax <= bmin ? "Balance range is invalid."
      : !schooling ? "Schooling status is required." : "";
    if (err) { setError(err); return; }
    onChange([...rules, { id: nextRuleId(rules), name: name.trim(), amount: a, ageMin: mn, ageMax: mx, minBalance: bmin, maxBalance: bmax, schooling: schooling as RuleSchooling, schools, status }]);
    onBack(); notify("Batch Top-up Rule saved.");
  };
  const activate = () => ask({
    title: "Activate Batch Top-up Rule?", text: "Are you sure you want to activate this rule?",
    details: `Rule: ${name.trim() || "New Top-up Rule"}\nOnce activated, this rule will be available for Batch Top-up Execution.`, confirmLabel: "Activate",
    onConfirm: () => { closeAsk(); save("Active"); },
  });

  const req = <span className="required">*</span>;
  return (
    <div>
      <button type="button" className="backline" onClick={onBack}>← Back to Batch Top-up Rule</button>
      <div className={`card ruleformcard${ro ? " rule-view-mode" : ""}`}><fieldset disabled={ro} className="rule-fieldset">
        <div className="ruletitle">{ro ? "View Batch Top-up Rule" : "Create Batch Top-up Rule"}</div>
        <div className="sectionlabel">1. RULE DETAILS</div>
        <div className="formgrid">
          <div className="field"><label htmlFor="rule-id">Rule ID</label><input id="rule-id" readOnly value={v?.id ?? nextRuleId(rules)} /><div className="rule-form-help">Generated automatically on save.</div></div>
          <div className="field"><label htmlFor="rule-name">Rule name {req}</label><input id="rule-name" placeholder="e.g. Primary Student Support" maxLength={100} value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="field full-row"><label htmlFor="rule-amount">Top-up per account (S$) {req}</label><input type="number" id="rule-amount" min={1} step={1} value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
        </div>
        <div className="sectionlabel">2. RECIPIENT CRITERIA (ALL MUST MATCH)</div>
        <div className="formgrid">
          <div className="field"><label htmlFor="age-min">Minimum age (inclusive) {req}</label><input type="number" id="age-min" min={0} step={1} value={ageMin} onChange={(e) => setAgeMin(e.target.value)} /></div>
          <div className="field"><label htmlFor="age-max">Maximum age (inclusive) {req}</label><input type="number" id="age-max" min={0} step={1} value={ageMax} onChange={(e) => setAgeMax(e.target.value)} /></div>
          <div className="field"><label htmlFor="bal-min">Minimum balance, inclusive (S$) {req}</label><input type="number" id="bal-min" min={0} step={0.01} value={balMin} onChange={(e) => setBalMin(e.target.value)} /></div>
          <div className="field"><label htmlFor="bal-max">Maximum balance, exclusive (S$) {req}</label><input type="number" id="bal-max" min={0} step={0.01} value={balMax} onChange={(e) => setBalMax(e.target.value)} />
            <div className="rule-form-help">Min &lt;= balance &lt; Max, so S$0–300 and S$300–500 never overlap at S$300.</div></div>
        </div>
        <div className="field"><label htmlFor="schooling">Schooling status {req}</label>
          <select id="schooling" value={schooling} onChange={(e) => setSchooling(e.target.value)}><option value="">Select schooling status...</option>{SCHOOLING.map((o) => <option key={o}>{o}</option>)}</select>
          <div className="rule-form-help">Status options are illustrative, pending MOE confirmation.</div></div>
        <div className="sectionlabel">3. SCHOOLS (OPTIONAL)</div>
        <div className="schools-row">
          <input placeholder="Search school name..." aria-label="Search schools" value={find} onChange={(e) => setFind(e.target.value)} />
          <button type="button" className="btn small" onClick={() => setSchools([...new Set([...schools, ...shown.map((s) => s.name)])])}>Select shown</button>
          <button type="button" className="btn small" style={{ border: 0 }} onClick={() => setSchools([])}>Clear all</button>
        </div>
        <div className="schools-list">
          {shown.length ? shown.map((s) => (
            <label className="schoolitem" key={s.code}>
              <input type="checkbox" checked={schools.includes(s.name)} onChange={(e) => setSchools(e.target.checked ? [...schools, s.name] : schools.filter((x) => x !== s.name))} />
              <span>{s.name}</span><small>{s.level}</small>
            </label>
          )) : <div className="empty">No schools found.</div>}
        </div>
        <div className="rule-form-help">{schools.length ? `${schools.length} selected` : "None selected: applies to all schools."}</div>
        {error && <div className="alert" role="alert">{error}</div>}
        </fieldset>
        {!ro && <div className="formfoot">
          <button type="button" className="btn small" onClick={onBack}>Cancel</button>
          <button type="button" className="btn small" onClick={() => save("Draft")}>Save draft</button>
          <button type="button" className="btn small primary" onClick={activate}>Activate</button>
        </div>}
      </div>
    </div>
  );
}

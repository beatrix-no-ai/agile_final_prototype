import { useState } from "react";
import { CheckCircle, X } from "@phosphor-icons/react";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { DataTable, type Column } from "../../../components/ui/DataTable";
import { EmptyState } from "../../../components/ui/EmptyState";
import { Field, inputClass } from "../../../components/ui/Field";
import { Modal } from "../../../components/ui/Modal";
import { useFees } from "../../../data/feeStore";
import { DEFAULT_DUE_DAYS, MASTER, type Charge, type FeeType } from "../../../data/fees";
import { SCHOOLS } from "../../../data/schools";
import { CLASS_RECORDS } from "../../../data/schoolMgmt";
import { formatSGD } from "../../../lib/format";
import { addDays, alreadyCharged, chargeStatus, currentTerm, fasOf, feeOf, payableOf, studentsOfClass, TERMS, type Term, TODAY } from "../../../lib/fees";
import { selectClass, studentOf } from "./parts";
import { filterRounds, historyRounds, type BillKind, type Round } from "./history";
import { fuzzyMatch } from "../../../lib/fuzzy";

type Result = { created: number; skipped: number; level: string; term: string };
type Scope = "level" | "class" | "student";
const total = (f: FeeType) => f.components.reduce((t, c) => t + c.amount, 0);
const scopeOf = (f: FeeType) => f.scope ?? f.level ?? "All levels";

/** School user: MOE Bills and School Bills are two separate flows on their own tabs (US-014). A MOE Bill goes to the whole cohort; a School Bill can target a level, a class or one student. Duplicates are skipped. */
export default function AssignCharges({ school, presetFee }: { school: string; presetFee: string }) {
  const [tab, setTab] = useState<"moe" | "school" | "history">(presetFee ? "school" : "moe");
  const tabs = [["moe", "MOE Bill"], ["school", "School Bill"], ["history", "Charge history"]] as const;
  return (
    <div className="space-y-4">
      <div role="tablist" aria-label="Assign fees" className="grid grid-cols-3 overflow-hidden rounded-card border border-line bg-surface-container-lowest">
        {tabs.map(([id, label]) => (
          <button key={id} role="tab" type="button" aria-selected={tab === id} onClick={() => setTab(id)}
            className={`min-h-11 px-4 text-left text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary ${tab === id ? "bg-primary-fixed text-primary" : "text-on-surface hover:bg-surface-container-low"}`}>{label}</button>
        ))}
      </div>
      {tab === "moe" && <Assign school={school} source="moe" />}
      {tab === "school" && <Assign school={school} source="school" presetFee={presetFee} />}
      {tab === "history" && <History school={school} />}
    </div>
  );
}

function Assign({ school, presetFee, source }: { school: string; presetFee?: string; source: "moe" | "school" }) {
  const { state, dispatch } = useFees();
  const [picked, setPicked] = useState<string[]>(presetFee ? [presetFee] : []);
  const [level, setLevel] = useState("");
  const [scope, setScope] = useState<Scope>("level");
  const [cls, setCls] = useState("");
  const [clsLevel, setClsLevel] = useState("");
  const [pickLevel, setPickLevel] = useState("");
  const [pickClass, setPickClass] = useState("");
  const [studentIds, setStudentIds] = useState<string[]>([]);
  const [pickOpen, setPickOpen] = useState(false);
  const [term, setTerm] = useState<Term>(currentTerm());
  const [result, setResult] = useState<Result | null>(null);

  const kind = SCHOOLS.find((s) => s.code === school)?.level;
  const master = state.types.filter((f) => f.school === MASTER && (!f.scope || f.scope === kind));
  const own = state.types.filter((f) => f.school === school);
  const pool = source === "moe" ? master : own;
  const chosen = pool.filter((f) => picked.includes(f.id));
  const levels = [...new Set(CLASS_RECORDS.filter((c) => c.school === school).map((c) => c.level))];
  const classes = CLASS_RECORDS.filter((c) => c.school === school);
  const schoolStudents = classes.flatMap((c) => studentsOfClass(school, c.name));
  // A MOE Bill always goes to the whole level (cohort); only a School Bill can be narrowed to a class or one student.
  const effScope: Scope = source === "school" ? scope : "level";
  const perStudent = chosen.reduce((t, f) => t + total(f), 0);

  // Each fee applies to a student only when its own level (if any) matches that student's level.
  const students = effScope === "level" ? (level ? classes.filter((c) => c.level === level).flatMap((c) => studentsOfClass(school, c.name)) : [])
    : effScope === "class" ? (cls ? studentsOfClass(school, cls) : [])
    : schoolStudents.filter((s) => studentIds.includes(s.id));
  const target = effScope === "level" ? level : effScope === "class" ? cls
    : students.length === 1 ? `${students[0].name} (${pickClass})` : pickClass ? `${pickClass} — ${students.length} students` : "";
  const plan = chosen.flatMap((fee) => students.filter((s) => !fee.level || fee.level === s.level).map((s) => ({ fee, s, dup: alreadyCharged(state.charges, s.id, fee, TODAY) })));
  const todo = plan.filter((p) => !p.dup);
  const withFas = students.map((s) => fasOf(s)).filter((f): f is NonNullable<typeof f> => f !== null);
  const fasSummary = ["MOEFAS", "SBFAS"].map((k) => `${withFas.filter((f) => f.scheme === k).length} ${k}`).filter((x) => !x.startsWith("0")).join(" + ") || "FAS";

  const add = (id: string) => { if (id && !picked.includes(id)) { setPicked([...picked, id]); setResult(null); } };
  const generate = () => {
    const due = addDays(TODAY, DEFAULT_DUE_DAYS);   // no due-date input anymore: every charge carries the standard 30-day window
    for (const fee of chosen) {
      const s = todo.filter((p) => p.fee.id === fee.id).map((p) => p.s);
      if (s.length) dispatch({ type: "generate", fee, students: s, issued: TODAY, due, term });
    }
    setResult({ created: todo.length, skipped: plan.length - todo.length, level: target, term });
  };
  const label = (f: FeeType) => `${f.name}${f.school === MASTER ? ` · ${scopeOf(f)}` : f.level ? ` · ${f.level}` : ""} (${formatSGD(total(f))})`;

  return (
    <Card>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={source === "moe" ? "MOE Bill" : "School Bill"} hint={source === "moe" ? "Mandatory, whole cohort. Created by MOE HQ." : "Created by your school. Target a level, a class or one student."}>
          <select className={inputClass} value="" onChange={(e) => add(e.target.value)}>
            <option value="">{source === "moe" ? "＋ Add MOE Bill…" : "＋ Add School Bill…"}</option>
            {pool.filter((f) => !picked.includes(f.id)).map((f) => <option key={f.id} value={f.id}>{label(f)}</option>)}
          </select>
        </Field>
      </div>

      <h3 className="mt-6 border-b border-line pb-2 text-[13px] font-semibold uppercase tracking-wide text-on-surface-variant">Selected bills &amp; total</h3>
      {chosen.length ? (
        <table className="mt-3 w-full text-sm">
          <thead>
              <tr className="bg-surface-container-low text-left text-[13px] uppercase tracking-wide text-on-surface-variant">
                <th className="px-3 py-2 font-semibold">Fee type &amp; components to assign</th>
                <th className="px-3 text-right font-semibold">Amount per student</th>
                <th className="w-10"><span className="sr-only">Remove</span></th>
              </tr>
            </thead>
            <tbody>
              {chosen.map((f) => (
                <tr key={f.id} className="border-b border-line align-top">
                  <td className="px-3 py-3">
                    <b>{f.name}</b> <code className="text-[13px] text-on-surface-variant">{f.id}</code> · {f.level ?? "all levels of this school"}
                    <div className="mt-0.5 text-[13px] text-on-surface-variant">{f.components.map((c) => `${c.name} (${formatSGD(c.amount)})`).join(" · ")}</div>
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">{formatSGD(total(f))}</td>
                  <td><Button size="sm" variant="ghost" aria-label={`Remove ${f.name}`} onClick={() => { setPicked(picked.filter((x) => x !== f.id)); setResult(null); }}><X size={16} aria-hidden="true" /></Button></td>
                </tr>
              ))}
              <tr className="bg-surface-container-low font-semibold">
                <td className="px-3 py-2.5">Total fee per student</td>
                <td className="px-3 text-right tabular-nums text-primary">{formatSGD(perStudent)}</td>
                <td />
              </tr>
          </tbody>
        </table>
      ) : (
        <p className="py-8 text-center text-sm text-on-surface-variant">{source === "moe" ? "Add one or more MOE Bills above — each is assigned whole to the cohort." : "Add one or more School Bills above, then choose who to charge."}</p>
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {source === "school" && (
          <Field required label="Assign to">
            <select className={inputClass} value={scope} onChange={(e) => { setScope(e.target.value as Scope); setClsLevel(""); setCls(""); setPickLevel(""); setPickClass(""); setStudentIds([]); setResult(null); }}>
              <option value="level">A level</option>
              <option value="class">A class</option>
              <option value="student">Student(s)</option>
            </select>
          </Field>
        )}
        {effScope === "level" && (
          <Field required label="Level / cohort">
            <select className={inputClass} value={level} onChange={(e) => { setLevel(e.target.value); setResult(null); }}>
              <option value="">— select level —</option>
              {levels.map((l) => <option key={l}>{l}</option>)}
            </select>
          </Field>
        )}
        {effScope === "class" && (
          <Field required label="Level">
            <select className={inputClass} value={clsLevel} onChange={(e) => { setClsLevel(e.target.value); setCls(""); setResult(null); }}>
              <option value="">— select level —</option>
              {levels.map((l) => <option key={l}>{l}</option>)}
            </select>
          </Field>
        )}
        {effScope === "class" && (
          <Field required label="Class">
            <select className={inputClass} value={cls} disabled={!clsLevel} onChange={(e) => { setCls(e.target.value); setResult(null); }}>
              <option value="">— select class —</option>
              {classes.filter((c) => c.level === clsLevel).map((c) => <option key={c.name}>{c.name}</option>)}
            </select>
          </Field>
        )}
        {effScope === "student" && (
          <Field required label="Level">
            <select className={inputClass} value={pickLevel} onChange={(e) => { setPickLevel(e.target.value); setPickClass(""); setStudentIds([]); setResult(null); }}>
              <option value="">— select level —</option>
              {levels.map((l) => <option key={l}>{l}</option>)}
            </select>
          </Field>
        )}
        {effScope === "student" && (
          <Field required label="Class">
            <select className={inputClass} value={pickClass} disabled={!pickLevel} onChange={(e) => { setPickClass(e.target.value); setStudentIds([]); setResult(null); }}>
              <option value="">— select class —</option>
              {classes.filter((c) => c.level === pickLevel).map((c) => <option key={c.name}>{c.name}</option>)}
            </select>
          </Field>
        )}
        <Field required label="Term">
          <select className={inputClass} value={term} onChange={(e) => { setTerm(e.target.value as Term); setResult(null); }}>
            {TERMS.map((t) => <option key={t}>{t}</option>)}
          </select>
        </Field>
      </div>

      {effScope === "student" && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button variant="secondary" disabled={!pickClass} onClick={() => setPickOpen(true)}>{pickClass ? `Pick students in ${pickClass}…` : "Pick students…"}</Button>
          {studentIds.length > 0 && (
            <p className="text-[13px] text-on-surface-variant">
              <b className="text-on-surface">{studentIds.length} student{studentIds.length === 1 ? "" : "s"} picked</b> — {studentIds.map((id) => studentOf(id)?.name ?? id).join(", ")}
            </p>
          )}
        </div>
      )}

      {target && chosen.length ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button onClick={generate} disabled={!todo.length}>Generate {todo.length} {todo.length === 1 ? "charge" : "charges"} ({chosen.length} fee type{chosen.length === 1 ? "" : "s"} · {formatSGD(perStudent)} per student)</Button>
          <span className="text-[13px] text-on-surface-variant">{todo.length} to create · {plan.length - todo.length} already charged (skipped)</span>
        </div>
      ) : (
        <div className="mt-2"><EmptyState title={chosen.length ? "Choose who the charges are for." : "Nothing to generate yet"} /></div>
      )}
      {level && chosen.length && withFas.length ? (
        <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-on-surface-variant">
          <Badge tone="primary">FAS</Badge>
          <span>
            {withFas.length} of {students.length} students receive {fasSummary} — for them the subsidy is deducted from the fee when the charge is generated, so their payable is lower than {formatSGD(perStudent)}. A student never receives both schemes: MOEFAS takes precedence over SBFAS.
          </span>
        </p>
      ) : null}
      {result && (
        <p role="status" className="mt-4 flex items-center gap-2 rounded-card border border-line bg-success-container px-4 py-3 text-sm font-medium text-success">
          <CheckCircle size={18} weight="bold" aria-hidden="true" />
          Created {result.created}, skipped {result.skipped}: {result.level}, {result.term}. Charges are outstanding and appear under Student fees.
        </p>
      )}
      {pickOpen && pickClass && (
        <StudentPicker key={pickClass} school={school} klass={pickClass} picked={studentIds}
          onToggle={(id) => setStudentIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]))}
          onClose={() => setPickOpen(false)} />
      )}
    </Card>
  );
}

/** Pick the students of one class: tick any number of them, with a fuzzy name search (level → class already chosen outside). */
function StudentPicker({ school, klass, picked, onToggle, onClose }: { school: string; klass: string; picked: string[]; onToggle: (id: string) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const all = studentsOfClass(school, klass);
  const shown = all.filter((s) => fuzzyMatch(q, [s.name, s.id, s.class])).sort((a, b) => a.name.localeCompare(b.name));
  return (
    <Modal open onClose={onClose} title={`Pick students — ${klass}`} footer={<Button onClick={onClose}>Done — {picked.length} picked</Button>}>
      <div className="space-y-3 text-on-surface">
        <input data-autofocus className={inputClass} aria-label="Search students" placeholder="Search by name…" value={q} onChange={(e) => setQ(e.target.value)} />
        <p className="text-[13px] text-on-surface-variant">{picked.length} of {all.length} student{all.length === 1 ? "" : "s"} ticked{q ? ` · ${shown.length} match “${q}”` : ""}</p>
        {shown.length ? (
          <ul className="max-h-72 divide-y divide-line overflow-y-auto rounded-card border border-line px-3">
            {shown.map((s) => (
              <li key={s.id}>
                <label className="flex cursor-pointer items-center gap-3 py-2.5 text-sm">
                  <input type="checkbox" className="size-4 accent-primary" checked={picked.includes(s.id)} onChange={() => onToggle(s.id)} />
                  <b>{s.name}</b> <span className="text-on-surface-variant">{s.id} · {s.class}</span>
                </label>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-4 text-center text-sm text-on-surface-variant">No students in {klass} match “{q}”.</p>
        )}
      </div>
    </Modal>
  );
}

const studentCols: Column<Charge>[] = [
  { key: "studentId", header: "Student", render: (c) => (<><b className="text-on-surface">{studentOf(c.studentId)?.name ?? c.studentId}</b> <span className="text-on-surface-variant">({c.studentId} · {studentOf(c.studentId)?.class})</span></>) },
  { key: "fas", header: "FAS", render: (c) => (c.fas ? <Badge tone="primary">{c.fas}</Badge> : <span className="text-on-surface-variant">—</span>) },
  { key: "status", header: "Status", render: (c) => <span className="capitalize">{chargeStatus(c)}</span> },
  { key: "fee", header: "Fee value", align: "right", render: (c) => formatSGD(feeOf(c)) },
  { key: "payable", header: "To pay", align: "right", render: (c) => <b>{formatSGD(payableOf(c))}</b> },
];

/** One round's affected students: the fee components to pay, then the student list with the app's standard 10-per-page pagination. */
function AffectedModal({ round, onClose }: { round: Round | null; onClose: () => void }) {
  const comps = round?.rows[0]?.components ?? [];
  const per = comps.reduce((t, c) => t + c.amount, 0);
  return (
    <Modal open={!!round} onClose={onClose} title={round ? `Students affected — ${round.title}` : ""}>
      {round && (
        <div className="space-y-5 text-on-surface">
          <p>{round.rows[0].term ? `${round.rows[0].term} · ` : ""}Issued {round.issued} · due {round.due} · {round.rows.length} charge{round.rows.length === 1 ? "" : "s"} · total fee value {formatSGD(round.rows.reduce((t, c) => t + feeOf(c), 0))}</p>
          <div>
            <h3 className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-on-surface-variant">Fee components to pay (per student)</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-container-low text-left text-[13px] uppercase tracking-wide text-on-surface-variant">
                  <th className="px-3 py-2 font-semibold">Component</th>
                  <th className="px-3 text-right font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody>
                {comps.map((c) => (
                  <tr key={c.name} className="border-b border-line">
                    <td className="px-3 py-2">{c.name}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatSGD(c.amount)}</td>
                  </tr>
                ))}
                <tr className="bg-surface-container-low font-semibold">
                  <td className="px-3 py-2">Total per student</td>
                  <td className="px-3 py-2 text-right tabular-nums text-primary">{formatSGD(per)}</td>
                </tr>
              </tbody>
            </table>
            <p className="mt-1 text-[13px] text-on-surface-variant">A student with FAS pays less — see the To pay column below.</p>
          </div>
          <div>
            <h3 className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-on-surface-variant">Students affected ({round.rows.length})</h3>
            <DataTable columns={studentCols} rows={round.rows} rowKey={(c) => c.id} empty={null} />
          </div>
        </div>
      )}
    </Modal>
  );
}

function History({ school }: { school: string }) {
  const { state } = useFees();
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [kind, setKind] = useState<"" | BillKind>("");
  const [viewing, setViewing] = useState<Round | null>(null);

  // A round belongs here when it is the school's own bill or a MOE Bill for one of this school's students.
  const classes = CLASS_RECORDS.filter((c) => c.school === school);
  const schoolIds = new Set(classes.flatMap((c) => studentsOfClass(school, c.name)).map((s) => s.id));
  const lvl = (r: Round) => [...new Set(r.rows.map((c) => studentOf(c.studentId)?.level ?? ""))].filter(Boolean);
  const allRounds = historyRounds(state.charges, state.types, school, (id) => schoolIds.has(id));
  const list = filterRounds(allRounds, { q, from, to, kind, textOf: (r) => `${r.title} ${r.issued} ${lvl(r).join(" ")}` });
  const all = list.flatMap((r) => r.rows);
  const sections: BillKind[] = kind ? [kind] : ["moe", "school"];

  const roundRow = (r: Round) => {
    const n = new Set(r.rows.map((c) => c.studentId)).size;
    return (
      <tr key={r.key} className="border-b border-line align-top">
        <td className="py-3 pr-3 whitespace-nowrap">{r.issued}</td>
        <td className="py-3 pr-3">
          <b>{r.title}</b>
          <div className="text-[13px] text-on-surface-variant">{r.rows[0].term ? `${r.rows[0].term} · ` : ""}{lvl(r).join(", ")} · 1 fee type · {n} student{n === 1 ? "" : "s"} · {r.rows.length} charge{r.rows.length === 1 ? "" : "s"}</div>
          <div className="mt-0.5 text-[13px] text-on-surface-variant">{r.rows[0].components.map((c) => `${c.name} (${formatSGD(c.amount)})`).join(" · ")}</div>
          <div className="mt-2"><Button size="sm" variant="secondary" onClick={() => setViewing(r)}>View {n} student{n === 1 ? "" : "s"} affected</Button></div>
        </td>
        <td className="py-3 pr-3">{r.due}</td>
        <td className="px-3 py-3 text-right font-bold tabular-nums">{formatSGD(r.rows.reduce((t, c) => t + feeOf(c), 0))}</td>
      </tr>
    );
  };

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-3">
        <input aria-label="Search charge history" className={`${inputClass.replace("w-full", "min-w-48 flex-1")}`} placeholder="Search fee type, charge, level…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select aria-label="Bill kind" className={selectClass} value={kind} onChange={(e) => setKind(e.target.value as "" | BillKind)}>
          <option value="">All bills</option>
          <option value="moe">MOE bills</option>
          <option value="school">School bills</option>
        </select>
        <input type="date" aria-label="Issued from" className={selectClass} value={from} onChange={(e) => setFrom(e.target.value)} />
        <span aria-hidden>→</span>
        <input type="date" aria-label="Issued to" className={selectClass} value={to} onChange={(e) => setTo(e.target.value)} />
      </div>
      <p className="my-4 text-sm">{all.length} charges in {list.length} issuance round{list.length === 1 ? "" : "s"} · total fee value {formatSGD(all.reduce((t, c) => t + feeOf(c), 0))}{kind ? ` · ${kind === "moe" ? "MOE bills only" : "School bills only"}` : ""}</p>
      {list.length ? sections.map((k) => {
        const rows = list.filter((r) => r.kind === k);
        if (!rows.length) return <p key={k} className="pb-3 text-[13px] text-on-surface-variant">No {k === "moe" ? "MOE Bill" : "School Bill"} charges match your filters.</p>;
        const nCh = rows.reduce((t, r) => t + r.rows.length, 0);
        const tot = rows.reduce((t, r) => t + r.rows.reduce((x, c) => x + feeOf(c), 0), 0);
        return (
          <div key={k} className="mb-6">
            <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
              <Badge tone={k === "moe" ? "primary" : "neutral"}>{k === "moe" ? "MOE Bill" : "School Bill"}</Badge>
              <b>{k === "moe" ? "MOE bills" : "School bills"}</b>
              <span className="text-on-surface-variant">{rows.length} issuance round{rows.length === 1 ? "" : "s"} · {nCh} charge{nCh === 1 ? "" : "es"} · total fee value {formatSGD(tot)}</span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-container-low text-left text-[13px] uppercase tracking-wide text-on-surface-variant">
                  <th className="px-3 py-2 font-semibold">Issued</th><th className="font-semibold">Charge</th><th className="font-semibold">Due</th><th className="px-3 text-right font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody>{rows.map(roundRow)}</tbody>
            </table>
          </div>
        );
      }) : <p className="py-6 text-center text-sm text-on-surface-variant">No charges match.</p>}
      <AffectedModal round={viewing} onClose={() => setViewing(null)} />
    </Card>
  );
}

import { useState, type ReactNode } from "react";
import { ArrowLeft } from "@phosphor-icons/react";
import { Badge, type BadgeTone } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { DataTable, RowAction, type Column } from "../../../components/ui/DataTable";
import { EmptyState } from "../../../components/ui/EmptyState";
import { inputClass } from "../../../components/ui/Field";
import { FAMILIES, OUTCOMES, refreshIncome, type Family } from "../../../data/moefas";
import { formatSGD } from "../../../lib/format";

const TONE: Record<string, BadgeTone> = {
  "MOEFAS granted": "success", Granted: "success", Matched: "success",
  "Awaiting data": "warning",
  "SBFAS review": "primary", "Pending school review": "primary",
};
const Pill = ({ s }: { s: string }) => <Badge tone={TONE[s] ?? "neutral"}>{s}</Badge>;

function KV({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line py-2.5 text-sm last:border-0">
      <dt className="text-on-surface-variant">{k}</dt>
      <dd className="text-right font-semibold text-on-surface">{v}</dd>
    </div>
  );
}

// Demo fee lines for the new-charge preview (percent subsidy of the fee).
const FEES = [
  { name: "Tuition", note: "MFC-001 · 100%", source: "MOE master", fee: 100, pct: 100 },
  { name: "Standard miscellaneous", note: "MFC-002 · 50%", source: "MOE master", fee: 20, pct: 50 },
  { name: "School activity", note: "No subsidy mapping", source: "School-created", fee: 30, pct: 0 },
];

const th = "whitespace-nowrap border-b border-line bg-surface-container-low px-3 py-3 text-left text-[13px] font-medium text-on-surface-variant";
const td = "border-b border-line px-3 py-3 align-top";

function Detail({ f, onBack, onRefresh }: { f: Family; onBack: () => void; onRefresh: () => void }) {
  const [child, setChild] = useState(0);
  const s = f.status[child];
  const ok = s === "Granted";
  const pending = s === "Awaiting data";
  const missing = !!f.missingInfo?.includes(child);
  const noBand = f.band === "Unavailable";
  const check = noBand ? "Awaiting data" : s === "Not granted" ? "Not matched" : "Matched";
  const explain = ok
    ? "All configured criteria matched. MOEFAS Tier 2 was granted automatically."
    : pending
      ? missing ? "Student information is incomplete. Assessment is awaiting an update." : "Income information is not yet available. Assessment will continue when the information is available."
      : "The returned income bands do not match the MOEFAS rules. An eligible SBFAS case has been routed to the school for review.";
  const total = FEES.reduce((t, x) => ({ fee: t.fee + x.fee, sub: t.sub + x.fee * x.pct / 100 }), { fee: 0, sub: 0 });

  return (
    <div className="space-y-4">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 rounded text-sm font-semibold text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
        <ArrowLeft size={16} weight="bold" aria-hidden="true" /> All applications
      </button>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[13px] text-on-surface-variant">Family application / {f.id}</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight">{f.parent}’s application</h2>
          <p className="mt-1 text-sm text-on-surface-variant">Submitted 18 Oct 2026 · All linked children included</p>
        </div>
        <Pill s={f.outcome} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
        <Card title="Household & submitted information">
          <dl>
            <KV k="Applicant" v={f.parent} />
            <KV k="Spouse" v={f.spouse} />
            <KV k="Contact number" v={f.contact} />
            <KV k="Mailing address" v={f.address} />
            <KV k="Additional information" v="No additional information provided" />
          </dl>
          <p className="mt-3 text-[13px] text-on-surface-variant">Declaration accepted · {f.parent} · 18 Oct 2026. Income retrieval and school sharing consent recorded.</p>
        </Card>
        <Card title="Income information">
          <dl>
            <KV k="Household income band / month" v={f.band} />
            <KV k="Per-capita income band / month" v={f.pci} />
            <KV k="Last income sync" v={f.sync} />
          </dl>
        </Card>
      </div>

      <Card title="Assessment per child" action={<span className="text-[13px] text-on-surface-variant">One family submission · Separate child outcomes</span>}>
        <div role="group" aria-label="Child" className="flex flex-wrap gap-2">
          {f.children.map((n, i) => (
            <Button key={n} size="sm" variant={child === i ? "primary" : "secondary"} aria-pressed={child === i} onClick={() => setChild(i)}>{n}</Button>
          ))}
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <dl>
            <KV k="Student / level" v={`${f.children[child]} · ${f.levels[child]}`} />
            <KV k="School" v={f.schools[child]} />
            <KV k="MOEFAS result" v={<Pill s={s} />} />
            <KV k="Tier / effective period" v={ok ? "Tier 2 · 01 Jan–31 Dec 2026" : "Not assigned"} />
          </dl>
          <div className="rounded-control bg-surface-container-low p-4 text-sm leading-relaxed">
            <b>Assessment explanation</b>
            <p className="mt-2">{explain}</p>
            <p className="mt-2 text-[13px] text-on-surface-variant">
              Policy snapshot: MOEFAS 2026 · Version 1<br />
              {pending ? "No decision recorded" : "Assessed automatically · 18 Oct 2026, 09:15 SGT"}
            </p>
            {pending && !missing && <Button size="sm" variant="secondary" className="mt-3" onClick={onRefresh}>Refresh income information</Button>}
          </div>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead><tr><th className={th}>Criterion</th><th className={th}>Retrieved value</th><th className={th}>Policy rule · Tier 2</th><th className={th}>Check</th></tr></thead>
            <tbody>
              <tr><td className={td}>Household income band</td><td className={td}>{f.band}</td><td className={td}>S$1,501–S$4,000</td><td className={td}><Pill s={check} /></td></tr>
              <tr><td className={td}>Per-capita income band</td><td className={td}>{f.pci}</td><td className={td}>S$451–S$1,000</td><td className={td}><Pill s={check} /></td></tr>
            </tbody>
          </table>
        </div>
      </Card>

      {ok && (
        <Card title="Fee impact · New charge preview" action={<Badge tone="success">MOEFAS · Tier 2</Badge>}>
          <p className="mb-3 text-[13px] text-on-surface-variant">Fees for {f.children[child]} · Not an issued charge</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-sm">
              <thead><tr><th className={th}>Fee component</th><th className={th}>Source</th><th className={`${th} text-right`}>Fee</th><th className={`${th} text-right`}>Subsidy</th><th className={`${th} text-right`}>Payable</th></tr></thead>
              <tbody>
                {FEES.map((x) => (
                  <tr key={x.name}>
                    <td className={td}>{x.name}<span className="block text-[13px] text-on-surface-variant">{x.note}</span></td>
                    <td className={td}>{x.source}</td>
                    <td className={`${td} text-right tabular-nums`}>{formatSGD(x.fee)}</td>
                    <td className={`${td} text-right tabular-nums`}>{x.pct ? `− ${formatSGD(x.fee * x.pct / 100)}` : formatSGD(0)}</td>
                    <td className={`${td} text-right tabular-nums`}>{formatSGD(x.fee * (100 - x.pct) / 100)}</td>
                  </tr>
                ))}
                <tr className="font-bold">
                  <td className={td} colSpan={2}>Total</td>
                  <td className={`${td} text-right tabular-nums`}>{formatSGD(total.fee)}</td>
                  <td className={`${td} text-right tabular-nums`}>− {formatSGD(total.sub)}</td>
                  <td className={`${td} text-right tabular-nums`}>{formatSGD(total.fee - total.sub)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[13px] text-on-surface-variant">Education Account balance is unchanged: granting MOEFAS does not create a top-up transaction.</p>
        </Card>
      )}
      {!ok && !pending && (
        <Card title="SBFAS handover">
          <dl>
            <KV k="School / case" v={`${f.schools[child]} · SBFAS0013`} />
            <KV k="Status" v={<Pill s="Pending school review" />} />
          </dl>
          <p className="mt-3 text-[13px] text-on-surface-variant">School users decide Approve / Override / Reject. No SBFAS subsidy is applied while the case is pending.</p>
        </Card>
      )}

      <Card title="Parent-facing progress preview">
        {[
          { mark: "✓", title: "Application submitted", body: `One application for ${f.children.length} ${f.children.length === 1 ? "child" : "children"}.` },
          { mark: pending ? "…" : "✓", title: pending ? "Assessment awaiting data" : ok ? "MOEFAS granted automatically" : "Referred for school-based assistance", body: `Result shown here is for ${f.children[child]}.` },
          { mark: "3", title: ok ? "Subsidy ready for eligible fees" : "Subsidy not applied", body: ok ? "See the fee breakdown when a charge is issued." : "No subsidy is applied before a grant decision." },
        ].map((x) => (
          <div key={x.title} className="flex gap-3.5 py-3">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-success-container text-sm font-bold text-success" aria-hidden="true">{x.mark}</span>
            <div><b className="text-sm">{x.title}</b><p className="mt-1 text-[13px] text-on-surface-variant">{x.body}</p></div>
          </div>
        ))}
      </Card>
    </div>
  );
}

export default function Applications({ notify }: { notify: (m: string) => void }) {
  const [families, setFamilies] = useState(FAMILIES);
  const [q, setQ] = useState("");
  const [outcome, setOutcome] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const open = families.find((f) => f.id === openId);

  if (open) {
    return <Detail key={open.id} f={open} onBack={() => setOpenId(null)} onRefresh={() => {
      setFamilies(families.map((f) => (f.id === open.id ? refreshIncome(f) : f)));
      notify(`Simulated income API succeeded. ${open.id} was assessed against the Active rule and granted Tier 2. No real API call was made.`);
    }} />;
  }

  const rows = families.filter((f) => (!outcome || f.outcome === outcome) && [f.id, f.parent, ...f.children].join(" ").toLowerCase().includes(q.trim().toLowerCase()));
  const columns: Column<Family>[] = [
    { key: "id", header: "Application", sortable: true, render: (f) => <><span className="font-semibold">{f.id}</span><span className="block text-[13px] text-on-surface-variant">18 Oct 2026</span></> },
    { key: "parent", header: "Applicant", sortable: true, render: (f) => <>{f.parent}<span className="block text-[13px] text-on-surface-variant">Parent / guardian</span></> },
    { key: "children", header: "Children", render: (f) => <>{f.children.length} {f.children.length > 1 ? "children" : "child"}<span className="block text-[13px] text-on-surface-variant">{f.children.join(", ")}</span></> },
    { key: "outcome", header: "Assessment outcome", sortable: true, render: (f) => <Pill s={f.outcome} /> },
  ];

  return (
    <Card
      title="Family applications"
      action={<span className="text-[13px] text-on-surface-variant">Academic year 2026</span>}
    >
      <p className="mb-4 text-sm text-on-surface-variant">Submitted through the parent e-Service portal. Each child is assessed separately.</p>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input className={`${inputClass} max-w-sm`} aria-label="Search applications" placeholder="Search application, parent or child" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className={`${inputClass} max-w-52`} aria-label="Filter outcome" value={outcome} onChange={(e) => setOutcome(e.target.value)}>
          <option value="">All outcomes</option>
          {OUTCOMES.map((o) => <option key={o}>{o}</option>)}
        </select>
        <Button variant="secondary" onClick={() => { setQ(""); setOutcome(""); }}>Reset</Button>
      </div>
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(f) => f.id}
        rowActions={(f) => <RowAction onClick={() => setOpenId(f.id)}>View details</RowAction>}
        large
        empty={<EmptyState title="No matching applications" hint="Try another search or reset the filters." action={<Button variant="secondary" onClick={() => { setQ(""); setOutcome(""); }}>Reset</Button>} />}
      />
      <p className="mt-3 text-[13px] text-on-surface-variant">Showing {rows.length} of {families.length} family applications</p>
    </Card>
  );
}

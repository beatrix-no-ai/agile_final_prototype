import { useMemo, useState } from "react";
import { Check } from "@phosphor-icons/react";
import { Badge, type BadgeTone } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { DataTable, RowAction, type Column } from "../../../components/ui/DataTable";
import { EmptyState } from "../../../components/ui/EmptyState";
import { inputClass } from "../../../components/ui/Field";
import { INCOME_API_SOURCE } from "../../../data/sbfasApplications";
import {
  HOUSEHOLD_BANDS, PER_CAPITA_BANDS, activeRuleOf, assessChild, bandLabel, familyOutcome, feeImpact,
  schoolNameOf, type ChildOutcome, type FamilyOutcome, type FasRule, type MoefasFamily,
} from "../../../data/moefasRules";
import { useMoefas } from "../../../data/moefasStore";
import { TODAY } from "../../../lib/fees";
import { formatDate, formatSGD } from "../../../lib/format";
import { Chips } from "../fee-types/parts";

const OUTCOME_TONE: Record<FamilyOutcome, BadgeTone> = {
  "MOEFAS granted": "success",
  "SBFAS review": "primary",
  "Awaiting income data": "warning",
  "Mixed outcomes": "alert",
};

type Row = MoefasFamily & { outcome: FamilyOutcome; childNames: string };

function KV({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line py-2.5 text-sm last:border-0">
      <dt className="text-on-surface-variant">{k}</dt>
      <dd className="text-right font-semibold text-on-surface">{v}</dd>
    </div>
  );
}

/** Per-child verdict pill. */
function ResultBadge({ outcome }: { outcome: ChildOutcome }) {
  if (outcome.kind === "granted") return <Badge tone="success">MOEFAS granted · Tier {outcome.tier + 1}</Badge>;
  if (outcome.kind === "sbfas") return <Badge tone="primary">Referred for SBFAS review</Badge>;
  return <Badge tone="warning">Awaiting data</Badge>;
}

function Step({ state, index, title, note }: { state: "done" | "wait"; index: number; title: string; note: string }) {
  return (
    <div className="flex gap-3 border-b border-line py-3 last:border-0">
      <span
        aria-hidden
        className={`grid size-7 shrink-0 place-items-center rounded-full text-sm font-bold ${state === "done" ? "bg-success-container text-success" : "bg-track text-on-surface-variant"}`}
      >
        {state === "done" ? <Check size={15} weight="bold" /> : index}
      </span>
      <div>
        <p className="text-sm font-semibold text-on-surface">{title}</p>
        <p className="mt-0.5 text-[13px] text-on-surface-variant">{note}</p>
      </div>
    </div>
  );
}

function FamilyDetail({ family, rule, onBack }: { family: MoefasFamily; rule: FasRule | null; onBack: () => void }) {
  const { dispatch } = useMoefas();
  const [childIdx, setChildIdx] = useState(0);
  const child = family.children[childIdx];
  const outcome = assessChild(rule, family.income, child);
  const outcomes = family.children.map((c) => assessChild(rule, family.income, c));
  const granted = outcome.kind === "granted";
  const awaiting = outcome.kind === "awaiting";
  const refreshed = !family.income.failed && family.income.syncedOn === TODAY;

  const explanation =
    outcome.kind === "granted"
      ? `All configured criteria matched. MOEFAS Tier ${outcome.tier + 1} was granted automatically.`
      : outcome.kind === "awaiting"
        ? outcome.reason === "student-info"
          ? "Student information is incomplete. Assessment is awaiting an update."
          : "Income information is not yet available. Assessment will continue when the information is available."
        : "The returned income bands do not match the MOEFAS rules. The case has been routed to the school for SBFAS review.";

  // Criteria compare against the child's granted tier, or the last (weakest) tier when nothing matched.
  const tierIdx = outcome.kind === "granted" ? outcome.tier : (rule?.tiers.length ?? 1) - 1;
  const tier = rule?.tiers[tierIdx];
  const tierPeriod = granted && rule && outcome.kind === "granted"
    ? `Tier ${outcome.tier + 1} · ${formatDate(rule.from)} – ${formatDate(rule.to)}`
    : "Not assigned";
  const impact = granted && rule && outcome.kind === "granted" ? feeImpact(rule, child.level, outcome.tier) : null;

  return (
    <div className="space-y-4">
      <div>
        <Button variant="secondary" size="sm" onClick={onBack}>← All applications</Button>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[13px] text-on-surface-variant">Family application / {family.id}</p>
            <h2 className="text-xl font-bold text-on-surface">{family.parent}'s application</h2>
            <p className="mt-1 text-sm text-on-surface-variant">Submitted {formatDate(family.submittedOn)} · All linked children included</p>
          </div>
          <Badge tone={OUTCOME_TONE[familyOutcome(outcomes)]}>{familyOutcome(outcomes)}</Badge>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Household & submitted information">
          <dl>
            <KV k="Applicant" v={family.parent} />
            <KV k="Spouse" v={family.spouse} />
            <KV k="Contact number" v={family.contact} />
            <KV k="Mailing address" v={family.address} />
            <KV k="Additional information" v={family.note} />
          </dl>
          <p className="mt-3 text-[13px] text-on-surface-variant">
            Declaration accepted · {family.parent} · {formatDate(family.submittedOn)}<br />
            Income retrieval and school sharing consent recorded.
          </p>
        </Card>
        <Card title="Income information">
          <dl>
            <KV k="Household income band / month" v={bandLabel(HOUSEHOLD_BANDS, family.income.household)} />
            <KV k="Per-capita income band / month" v={bandLabel(PER_CAPITA_BANDS, family.income.perCapita)} />
            <KV
              k="Last sync"
              v={family.income.failed ? <span className="text-alert">Failed — {formatDate(family.income.syncedOn)}</span> : formatDate(family.income.syncedOn)}
            />
          </dl>
          <p className="mt-3 text-[13px] text-on-surface-variant">
            Bands are retrieved read-only from the {INCOME_API_SOURCE}; an exact income is never shown or stored.
          </p>
        </Card>
      </div>

      <Card
        title="Assessment per child"
        action={<span className="text-[13px] text-on-surface-variant">One family submission · separate child outcomes</span>}
      >
        <div role="group" aria-label="Children in this application" className="flex flex-wrap gap-2">
          {family.children.map((c, i) => (
            <Button key={c.name} size="sm" variant={i === childIdx ? "primary" : "secondary"} aria-pressed={i === childIdx} onClick={() => setChildIdx(i)}>
              {c.name}
            </Button>
          ))}
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <dl>
            <KV k="Student / level" v={`${child.name} · ${child.level}`} />
            <KV k="School" v={schoolNameOf(child.level)} />
            <KV
              k="MOEFAS result"
              v={<ResultBadge outcome={outcome} />}
            />
            <KV
              k="Tier / effective period"
              v={tierPeriod}
            />
          </dl>
          <div className="rounded-card border border-line bg-surface-container-low p-4">
            <p className="text-sm font-semibold text-on-surface">Assessment explanation</p>
            <p className="mt-2 text-sm text-on-surface">{explanation}</p>
            <p className="mt-3 text-[13px] text-on-surface-variant">
              Policy snapshot: {rule ? `${rule.name} · ${rule.id}` : "no active rule"}<br />
              {awaiting ? "No decision recorded" : `Assessed automatically · ${formatDate(family.submittedOn)}`}
            </p>
            {outcome.kind === "awaiting" && outcome.reason === "income" && (
              <Button size="sm" onClick={() => dispatch({ type: "refresh-income", familyId: family.id })}>Refresh income information</Button>
            )}
            {refreshed && (
              <p role="status" className="mt-3 text-[13px] font-medium text-success">
                Income information refreshed from the {INCOME_API_SOURCE} — reassessed automatically (simulated retry).
              </p>
            )}
          </div>
        </div>

        {rule && tier && (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line">
                  <th scope="col" className="px-3 py-2.5 font-medium text-on-surface-variant">Criterion</th>
                  <th scope="col" className="px-3 py-2.5 font-medium text-on-surface-variant">Retrieved value</th>
                  <th scope="col" className="px-3 py-2.5 font-medium text-on-surface-variant">Policy rule · Tier {tierIdx + 1}</th>
                  <th scope="col" className="px-3 py-2.5 font-medium text-on-surface-variant">Check</th>
                </tr>
              </thead>
              <tbody>
                {(
                  [
                    ["Household income band", HOUSEHOLD_BANDS, family.income.household, tier.household],
                    ["Per-capita income band", PER_CAPITA_BANDS, family.income.perCapita, tier.perCapita],
                  ] as const
                ).map(([label, bands, value, cutoff]) => (
                  <tr key={label} className="border-b border-line last:border-0">
                    <td className="px-3 py-3">{label}</td>
                    <td className="px-3 py-3">{bandLabel(bands, value)}</td>
                    <td className="px-3 py-3">{bands[cutoff]} or below</td>
                    <td className="px-3 py-3">
                      {value == null
                        ? <Badge tone="warning">Awaiting data</Badge>
                        : value <= cutoff
                          ? <Badge tone="success">Matched</Badge>
                          : <Badge tone="neutral">Not matched</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {impact && (
          <div className="mt-5 rounded-card border border-line border-l-4 border-l-success p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-on-surface">Fee impact · new charge preview</h3>
              <Badge tone="primary">MOEFAS · Tier {outcome.kind === "granted" ? outcome.tier + 1 : ""}</Badge>
            </div>
            <p className="mt-1 text-[13px] text-on-surface-variant">Fees for {child.name} · preview only, not an issued charge.</p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-line">
                    <th scope="col" className="px-3 py-2.5 font-medium text-on-surface-variant">Fee component</th>
                    <th scope="col" className="px-3 py-2.5 font-medium text-on-surface-variant">Source</th>
                    <th scope="col" className="px-3 py-2.5 text-right font-medium text-on-surface-variant">Fee</th>
                    <th scope="col" className="px-3 py-2.5 text-right font-medium text-on-surface-variant">Subsidy</th>
                    <th scope="col" className="px-3 py-2.5 text-right font-medium text-on-surface-variant">Payable</th>
                  </tr>
                </thead>
                <tbody>
                  {impact.rows.map((r) => (
                    <tr key={`${r.label}-${r.detail}`} className="border-b border-line last:border-0">
                      <td className="px-3 py-3">
                        {r.label}
                        <span className="block text-[13px] text-on-surface-variant">{r.detail}</span>
                      </td>
                      <td className="px-3 py-3">{r.source}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{formatSGD(r.fee)}</td>
                      <td className={`px-3 py-3 text-right tabular-nums ${r.subsidy > 0 ? "text-success" : "text-on-surface-variant"}`}>
                        {r.subsidy > 0 ? `− ${formatSGD(r.subsidy)}` : formatSGD(0)}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">{formatSGD(r.fee - r.subsidy)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="font-semibold">
                    <td className="px-3 py-3" colSpan={2}>Total</td>
                    <td className="px-3 py-3 text-right tabular-nums">{formatSGD(impact.fee)}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-success">− {formatSGD(impact.subsidy)}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-primary">{formatSGD(impact.payable)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <p className="mt-3 text-[13px] text-on-surface-variant">
              Granting MOEFAS does not create a top-up transaction — the Education Account balance stays unchanged.
            </p>
          </div>
        )}

        {outcome.kind === "sbfas" && (
          <div className="mt-5 rounded-card border border-line p-4">
            <h3 className="text-sm font-semibold text-on-surface">SBFAS handover</h3>
            <dl className="mt-2">
              <KV k="School / case" v={`${schoolNameOf(child.level)} · SBFAS case at the school`} />
              <KV k="Status" v={<Badge tone="warning">Pending school review</Badge>} />
            </dl>
            <p className="mt-3 text-[13px] text-on-surface-variant">
              School users decide Approve / Override / Reject from the SBFAS review tab. No SBFAS subsidy is applied while the case is pending.
            </p>
          </div>
        )}
      </Card>

      <Card title="Parent-facing progress preview">
        <Step state="done" index={1} title="Application submitted" note={`One application for ${family.children.length} ${family.children.length === 1 ? "child" : "children"}.`} />
        <Step
          state={awaiting ? "wait" : "done"}
          index={2}
          title={granted ? "MOEFAS granted automatically" : awaiting ? "Assessment awaiting data" : "Referred for school-based assistance"}
          note={`Result shown here is for ${child.name}.`}
        />
        <Step
          state="wait"
          index={3}
          title={granted ? "Subsidy ready for eligible fees" : "Subsidy not applied"}
          note={granted ? "See the fee breakdown when a charge is issued." : "No subsidy is applied before a grant decision."}
        />
      </Card>
    </div>
  );
}

/** HQ list of family applications (Req 4): every child of a submission is assessed against the Active rule. */
export default function MoefasApplications() {
  const { state } = useMoefas();
  const rule = activeRuleOf(state.rules);
  const [openId, setOpenId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<"all" | FamilyOutcome>("all");

  const rows: Row[] = useMemo(
    () =>
      state.families.map((f) => {
        const outcomes = f.children.map((c) => assessChild(rule, f.income, c));
        return { ...f, outcome: familyOutcome(outcomes), childNames: f.children.map((c) => c.name).join(", ") };
      }),
    [state.families, rule],
  );
  const filtered = rows.filter(
    (f) => (kind === "all" || f.outcome === kind) && `${f.id} ${f.parent} ${f.childNames}`.toLowerCase().includes(q.trim().toLowerCase()),
  );
  const family = rows.find((f) => f.id === openId) ?? null;

  if (family) return <FamilyDetail key={family.id} family={family} rule={rule} onBack={() => setOpenId(null)} />;

  const columns: Column<Row>[] = [
    {
      key: "id", header: "Application", sortable: true, render: (f) => (
        <>
          <span className="font-semibold">{f.id}</span>
          <span className="block text-[13px] text-on-surface-variant">Submitted {formatDate(f.submittedOn)}</span>
        </>
      ),
    },
    {
      key: "parent", header: "Applicant", sortable: true, render: (f) => (
        <>
          {f.parent}
          <span className="block text-[13px] text-on-surface-variant">Parent / guardian</span>
        </>
      ),
    },
    {
      key: "children", header: "Children", render: (f) => (
        <>
          {f.children.length} {f.children.length === 1 ? "child" : "children"}
          <span className="block text-[13px] text-on-surface-variant">{f.childNames}</span>
        </>
      ),
    },
    { key: "outcome", header: "Assessment outcome", sortable: true, render: (f) => <Badge tone={OUTCOME_TONE[f.outcome]}>{f.outcome}</Badge> },
  ];

  return (
    <Card
      title="MOEFAS applications"
      action={
        <input
          className={`${inputClass} sm:w-72`}
          type="search"
          placeholder="Search application, parent or child"
          aria-label="Search applications"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Chips
            label="Filter outcome"
            value={kind}
            onChange={setKind}
            options={[
              { value: "all", label: "All", count: rows.length },
              ...(["MOEFAS granted", "SBFAS review", "Awaiting income data", "Mixed outcomes"] as const).map((k) => ({
                value: k,
                label: k,
                count: rows.filter((f) => f.outcome === k).length,
              })),
            ]}
          />
        </div>
        <p className="text-sm text-on-surface-variant">
          Assessed automatically against {rule ? `${rule.name} (${rule.id})` : "no active rule — every case routes to schools"} · Academic year 2026.
        </p>
        <DataTable
          columns={columns}
          rows={filtered}
          rowKey={(f) => f.id}
          rowActions={(f) => <RowAction onClick={() => setOpenId(f.id)}>View details</RowAction>}
          empty={
            <EmptyState
              title="No matching applications"
              hint="Try another search or reset the outcome filter."
              action={<Button variant="secondary" onClick={() => { setQ(""); setKind("all"); }}>Reset filters</Button>}
            />
          }
        />
        <p className="text-[13px] text-on-surface-variant">Showing {filtered.length} of {rows.length} family applications.</p>
      </div>
    </Card>
  );
}

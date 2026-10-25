import { Badge } from "../../../components/ui/Badge";
import { Card } from "../../../components/ui/Card";
import { TIER_LIMIT, useRules, useTiers, type Range } from "../../../data/moefas";

const money = (n: number) => `S$${n.toLocaleString("en-SG", { maximumFractionDigits: 2 })}`;
/** HQ income tier range as a label: "Up to S$2,000", "S$2,000.01 – S$3,000", "Above S$10,000". */
const rangeLabel = ([lo, hi]: Range) =>
  lo <= 0 ? `Up to ${money(hi)}` : hi >= TIER_LIMIT ? `Above ${money(Math.round((lo - 0.01) * 100) / 100)}` : `${money(lo)} – ${money(hi)}`;

function TierTable({ title, short, ranges }: { title: string; short: string; ranges: Range[] }) {
  return (
    <div>
      <p className="text-[13px] font-semibold text-on-surface">
        {title} <span className="font-normal text-on-surface-variant">({short})</span>
      </p>
      <table className="mt-2 w-full text-left text-sm">
        <thead>
          <tr className="border-b border-line">
            <th scope="col" className="px-3 py-2.5 font-medium text-on-surface-variant">Tier</th>
            <th scope="col" className="px-3 py-2.5 font-medium text-on-surface-variant">Monthly income (S$)</th>
          </tr>
        </thead>
        <tbody>
          {ranges.map((r, i) => (
            <tr key={i} className="border-b border-line last:border-0">
              <td className="px-3 py-2 font-semibold">Tier {i + 1}</td>
              <td className="px-3 py-2 tabular-nums">{rangeLabel(r)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Read-only national reference for school users: the central income tiers and the Active MOE rule. */
export function MoefasHandbook() {
  const [tiers] = useTiers();
  const [rules] = useRules();
  const active = rules.find((r) => r.status === "Active") ?? null;
  return (
    <div className="space-y-4">
      <p className="text-sm text-on-surface-variant">
        The national side of FAS, read-only: official income tiers, the Active MOE rule, the two schemes and the
        end-to-end process. Configuration lives in the other tabs — HQ configures FAS rules, each school its own
        SBFAS package.
      </p>
      <p className="text-sm text-on-surface-variant">
        An application reaches MOE by two channels — the parent e-Service portal, or a paper form the school scans in
        for families who cannot go online (Hardcopy applications tab). Both are assessed the same way. After a school
        rejects SBFAS, the family may bring one new request at a time; from the third request on the reviewer sees a
        note to look closely, but nothing is blocked.
      </p>
      <Card title="Income tiers — the official MOE framework" action={<Badge tone="neutral">Reference</Badge>}>
        <div className="space-y-3">
          <p className="text-sm text-on-surface-variant">
            Every income figure in this system is one of these tiers — {tiers.ghi.ranges.length} gross household
            (GHI) and {tiers.pci.ranges.length} per-capita (PCI) tiers. Only the tier a family sits in is ever
            stored, never the exact income. MOE HQ maintains the bounds in the Income tiers tab; the table below
            always shows the live framework.
          </p>
          <div className="grid gap-6 lg:grid-cols-2">
            <TierTable title="Gross household income" short="GHI" ranges={tiers.ghi.ranges} />
            <TierTable title="Per-capita income" short="PCI" ranges={tiers.pci.ranges} />
          </div>
        </div>
      </Card>
      <Card title="The Active MOE rule" action={<Badge tone="neutral">Set by MOE HQ</Badge>}>
        {active ? (
          <div className="space-y-3">
            <p className="text-sm text-on-surface-variant">
              <span className="font-semibold text-on-surface">{active.name}</span> · a tier matches when both
              income conditions hold.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-line">
                    <th scope="col" className="px-3 py-2.5 font-medium text-on-surface-variant">MOEFAS tier</th>
                    <th scope="col" className="px-3 py-2.5 font-medium text-on-surface-variant">Gross household income (monthly)</th>
                    <th scope="col" className="px-3 py-2.5 font-medium text-on-surface-variant">Per-capita income (monthly)</th>
                  </tr>
                </thead>
                <tbody>
                  {active.conditions.map((c, i) => (
                    <tr key={i} className="border-b border-line last:border-0">
                      <td className="px-3 py-3 font-semibold">MOEFAS Tier {i + 1}{i === 0 ? " (strongest)" : ""}</td>
                      <td className="px-3 py-3">{rangeLabel(tiers.ghi.ranges[c.ghi])} or below</td>
                      <td className="px-3 py-3">{rangeLabel(tiers.pci.ranges[c.pci])} or below</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[13px] text-on-surface-variant">
              Families inside these cut-offs are assessed and granted at HQ as MOEFAS; the rest reach the
              school&apos;s SBFAS queue.
            </p>
          </div>
        ) : (
          <p className="text-sm text-on-surface-variant">
            No Active MOE rule right now — every family is decided on SBFAS by the school.
          </p>
        )}
      </Card>
    </div>
  );
}

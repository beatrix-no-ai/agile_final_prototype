import { Card } from "../../../components/ui/Card";
import { BANDS, householdOf } from "../../../data/familyFas";
import { useParent } from "../../../data/parentStore";
import { fmtDate } from "../overview/shared";

type Props = { bandId: string; syncedOn: string };

export function Household({ bandId, syncedOn }: Props) {
  const { state } = useParent();
  const household = householdOf(state.children);
  const band = BANDS.find((b) => b.id === bandId);

  return (
    <Card title="Household">
      <ul className="divide-y divide-line">
        {household.map((m) => (
          <li key={m.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3 first:pt-0">
            <div>
              <p className="text-sm font-semibold">{m.name}</p>
              <p className="text-[13px] text-on-surface-variant">{m.detail}</p>
            </div>
            <span className="text-[13px] font-medium text-on-surface-variant">{m.role}</span>
          </li>
        ))}
        <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3 last:pb-0">
          <div>
            <p className="text-sm font-semibold">Household income band</p>
            <p className="text-[13px] text-on-surface-variant">Via HOMES. Only a band is shared with MOE, never exact income. Last synced {fmtDate(syncedOn)}.</p>
          </div>
          <span className="text-[13px] font-medium text-on-surface-variant">{band?.label ?? "Not synced"}</span>
        </li>
      </ul>
    </Card>
  );
}

import { useState } from "react";
import { Coins, Receipt, UsersThree, Wallet } from "@phosphor-icons/react";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { ProgressBar } from "../../../components/ui/ProgressBar";
import { StatCard } from "../../../components/ui/StatCard";
import { ACADEMIC_YEAR } from "../../../data/budgets";
import { selectMoefas, useFas } from "../../../data/fasStore";
import { formatSGD } from "../../../lib/format";
import { useSession } from "../../../session";
import { BudgetAlert } from "./BudgetAlert";
import { BudgetHistory } from "./BudgetHistory";
import { SetBudgetModal } from "./SetBudgetModal";

const compact = { compact: true };
const today = () => new Date().toISOString().slice(0, 10);

export function HqBudget() {
  const { state, dispatch } = useFas();
  const { user } = useSession();
  const [modal, setModal] = useState(false);
  const m = selectMoefas(state);
  const over = m.remaining < 0;
  const history = state.history.filter((h) => h.scope === "MOEFAS");

  return (
    <div className="space-y-4">
      <BudgetAlert name="MOEFAS" used={m.used} budget={m.budget} />
      <Card title={`MOEFAS budget - ${ACADEMIC_YEAR}`} action={<Button size="sm" variant="secondary" onClick={() => setModal(true)}>Set budget</Button>}>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total budget" value={formatSGD(m.budget, compact)} icon={<Coins size={26} />} />
          <StatCard label="Granted" value={formatSGD(m.used, compact)} icon={<Receipt size={26} />} />
          <StatCard label={over ? "Over budget by" : "Remaining"} value={formatSGD(Math.abs(m.remaining), compact)} icon={<Wallet size={26} />} />
          <StatCard label="Students helped" value={m.helped.toLocaleString("en-US")} icon={<UsersThree size={26} />} />
        </div>
        <div className="mt-5">
          <ProgressBar pct={m.budget > 0 ? (m.used / m.budget) * 100 : 0} label="Overall usage" />
        </div>
      </Card>
      <Card title="Breakdown by level">
        <ul className="divide-y divide-line">
          {m.levels.map((l) => {
            const lvlOver = l.used > l.budget;
            return (
              <li key={l.id} className="py-4 first:pt-0 last:pb-0">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">
                    {l.id} <span className="font-normal text-on-surface-variant">- {l.beneficiaries.toLocaleString("en-US")} students helped</span>
                  </span>
                  {lvlOver && <Badge tone="alert">Over budget</Badge>}
                </div>
                <ProgressBar
                  pct={l.budget > 0 ? (l.used / l.budget) * 100 : 0}
                  label={`${formatSGD(l.used, compact)} of ${formatSGD(l.budget, compact)}`}
                />
                {lvlOver && <p className="mt-1 text-[13px] font-medium text-alert">Exceeds budget by {formatSGD(l.used - l.budget, compact)}.</p>}
              </li>
            );
          })}
        </ul>
      </Card>
      <BudgetHistory changes={history} />
      <SetBudgetModal
        open={modal}
        onClose={() => setModal(false)}
        label="Level"
        targets={m.levels.map((l) => ({ id: l.id, label: l.id, budget: l.budget }))}
        onSave={(target, amount) => dispatch({ type: "setBudget", scope: "MOEFAS", target, amount, by: user.name, at: today() })}
      />
    </div>
  );
}

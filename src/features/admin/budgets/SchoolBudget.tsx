import { useState } from "react";
import { Coins, Receipt, UsersThree, Wallet, Gavel } from "@phosphor-icons/react";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { BarChart } from "../../../components/ui/BarChart";
import { ProgressBar } from "../../../components/ui/ProgressBar";
import { StatCard } from "../../../components/ui/StatCard";
import { ACADEMIC_YEAR, SBFAS_GOVERNANCE } from "../../../data/budgets";
import { selectSbfas, useFas } from "../../../data/fasStore";
import { formatSGD } from "../../../lib/format";
import { useSession } from "../../../session";
import { BudgetAlert } from "./BudgetAlert";
import { BudgetHistory } from "./BudgetHistory";
import { SetBudgetModal } from "./SetBudgetModal";

const today = () => new Date().toISOString().slice(0, 10);

export function SchoolBudget() {
  const { state, dispatch } = useFas();
  const { user } = useSession();
  const [modal, setModal] = useState(false);
  const s = selectSbfas(state);
  const over = s.remaining < 0;
  const history = state.history.filter((h) => h.scope === "SBFAS");

  return (
    <div className="space-y-4">
      <BudgetAlert name="SBFAS" used={s.used} budget={s.budget} />
      <Card title={`SBFAS budget - ${ACADEMIC_YEAR}`} action={<Button size="sm" variant="secondary" onClick={() => setModal(true)}>Set budget</Button>}>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="SBFAS budget" value={formatSGD(s.budget)} icon={<Coins size={26} />} />
          <StatCard label="Granted" value={formatSGD(s.used)} icon={<Receipt size={26} />} />
          <StatCard label={over ? "Over budget by" : "Remaining"} value={formatSGD(Math.abs(s.remaining))} icon={<Wallet size={26} />} />
          <StatCard label="Students helped" value={s.helped} icon={<UsersThree size={26} />} />
        </div>
        <div className="mt-5">
          <ProgressBar pct={s.budget > 0 ? (s.used / s.budget) * 100 : 0} label="Budget granted" />
        </div>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Students helped by tier">
          <BarChart data={s.byTier} />
          <p className="mt-2 text-sm text-on-surface-variant">{s.helped} students receiving SBFAS this year. Updates when you approve an application.</p>
        </Card>
        <Card title="Governance notes">
          <ul className="space-y-3 text-sm text-on-surface-variant">
            {SBFAS_GOVERNANCE.map((n) => (
              <li key={n} className="flex gap-2">
                <Gavel size={18} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
                {n}
              </li>
            ))}
          </ul>
        </Card>
      </div>
      <BudgetHistory changes={history} />
      <SetBudgetModal
        open={modal}
        onClose={() => setModal(false)}
        targets={[{ id: "SBFAS", label: "SBFAS", budget: s.budget }]}
        onSave={(target, amount) => dispatch({ type: "setBudget", scope: "SBFAS", target, amount, by: user.name, at: today() })}
      />
    </div>
  );
}

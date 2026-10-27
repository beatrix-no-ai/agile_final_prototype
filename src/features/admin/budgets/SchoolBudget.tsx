import { useState } from "react";
import { Coins, Receipt, UsersThree, Wallet, Gavel } from "@phosphor-icons/react";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { ProgressBar } from "../../../components/ui/ProgressBar";
import { StatCard } from "../../../components/ui/StatCard";
import { ACADEMIC_YEAR, SBFAS_GOVERNANCE } from "../../../data/budgets";
import { selectRecentGrants, selectSbfas, useFas } from "../../../data/fasStore";
import { formatSGD } from "../../../lib/format";
import { useSession } from "../../../session";
import { BudgetAlert } from "./BudgetAlert";
import { BudgetHistory } from "./BudgetHistory";
import { RecentGrants } from "./RecentGrants";
import { SetBudgetModal } from "./SetBudgetModal";
import { schoolOfLevel } from "../../../data/schoolMgmt";
import { LEVELS } from "../../../data/students";
import { schoolCodeFor } from "../../../data/users";
import { TierChartCard } from "./TierChartCard";

const today = () => new Date().toISOString().slice(0, 10);

export function SchoolBudget() {
  const { state, dispatch } = useFas();
  const { user, role, staff } = useSession();
  const mySchool = staff?.schoolCode ?? schoolCodeFor(role);
  const myClasses = LEVELS.filter((l) => schoolOfLevel(l) === mySchool);
  const [modal, setModal] = useState(false);
  const s = selectSbfas(state);
  const helped = s.byTier.reduce((n, t) => n + myClasses.reduce((m, c) => m + (t.by[c] ?? 0), 0), 0);
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
          <StatCard label="Students helped" value={helped} icon={<UsersThree size={26} />} />
        </div>
        <div className="mt-5">
          <ProgressBar pct={s.budget > 0 ? (s.used / s.budget) * 100 : 0} label="Budget granted" />
        </div>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <TierChartCard byTier={s.byTier} filters={myClasses} filterLabel="Class" note={(n, lvl) => `${n} ${lvl}students receiving SBFAS this year. Updates when you approve an application.`} />
        <RecentGrants grants={selectRecentGrants(state)} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <BudgetHistory changes={history} />
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
      <SetBudgetModal
        open={modal}
        onClose={() => setModal(false)}
        targets={[{ id: "SBFAS", label: "SBFAS", budget: s.budget }]}
        onSave={(target, amount) => dispatch({ type: "setBudget", scope: "SBFAS", target, amount, by: user.name, at: today() })}
      />
    </div>
  );
}

import { CurrencyCircleDollar } from "@phosphor-icons/react";
import { AssumptionTag } from "../../../components/ui/AssumptionTag";
import { Badge } from "../../../components/ui/Badge";
import { BUDGET_ALERT_PCT, budgets, budgetsUpdated } from "../../../data/dashboard";
import { selectBudgets, useFas } from "../../../data/fasStore";
import { budgetStatus, budgetUsage } from "../../../lib/budget";
import { formatSGD } from "../../../lib/format";
import { CardFoot, DashCard, Loadable, Skeleton, useDashQuery } from "./DashCard";

type Budget = (typeof budgets)[number];
const money = (n: number) => formatSGD(n, { compact: true });

function BudgetRow({ b, primary }: { b: Budget; primary: boolean }) {
  const { pct, over, barPct } = budgetUsage(b.used, b.budget);
  const status = budgetStatus(b.used, b.budget);
  const label = `${b.name} - ${b.owner}`;
  const left = Math.max(0, b.budget - b.used);
  return (
    <li>
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <span className="flex items-center gap-2 text-[13px] font-semibold">
          {label}
          {status === "over" ? (
            <Badge tone="alert">Over budget</Badge>
          ) : status === "reached" ? (
            <Badge tone="alert">Fully used</Badge>
          ) : (
            status === "near" && <Badge tone="alert">{BUDGET_ALERT_PCT}% alert</Badge>
          )}
        </span>
        <span className="text-[13px] font-medium text-on-surface-variant">
          {money(b.used)} / {money(b.budget)}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={`${label} budget used`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={barPct}
        aria-valuetext={`${pct}% used${over ? " - over budget" : ""}`}
        className="h-3.5 overflow-hidden rounded-full bg-track"
      >
        <div
          className={`h-full rounded-full ${over ? "bg-alert" : primary ? "bg-primary" : "bg-primary-container/60"}`}
          style={{ width: `${barPct}%` }}
        />
      </div>
      <div className="mt-2 flex justify-between text-xs font-medium text-on-surface-variant">
        <span>{pct}% used</span>
        <span>{over ? `${money(b.used - b.budget)} over` : `${money(left)} left`}</span>
      </div>
    </li>
  );
}

export function BudgetUsageCard() {
  const { state } = useFas();
  const q = useDashQuery(selectBudgets(state)); // same live figures as the Budgets pages
  return (
    <DashCard title="Budget Usage" icon={CurrencyCircleDollar} to="/admin/budgets">
      <Loadable
        query={q}
        what="budget usage"
        skeleton={
          <div className="flex flex-1 flex-col justify-center gap-9">
            {budgets.map((b) => (
              <div key={b.name} className="space-y-2.5">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3.5 w-full" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            ))}
          </div>
        }
      >
        {(list) => (
          <>
            <ul className="mt-4 flex flex-1 flex-col justify-center gap-9 pb-2">
              {list.map((b, i) => (
                <BudgetRow key={b.name} b={b} primary={i === 0} />
              ))}
            </ul>
            <CardFoot>
              <span className="flex flex-wrap items-center justify-between gap-2">
                Updated {budgetsUpdated}
                {/* ASSUMPTION: alert threshold is invented; see BUDGET_ALERT_PCT. */}
                <AssumptionTag>alert at {BUDGET_ALERT_PCT}% used</AssumptionTag>
              </span>
            </CardFoot>
          </>
        )}
      </Loadable>
    </DashCard>
  );
}

import { flushSync } from "react-dom";
import { Eye, SignOut } from "@phosphor-icons/react";
import { useNavigate } from "react-router";
import { AssumptionTag } from "../../../components/ui/AssumptionTag";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { PARENT } from "../../../data/users";
import { useSession } from "../../../session";

export const READ_ONLY_HINT = "Read-only in simulation: this action is disabled and nothing is saved.";

/** Persistent strip shown while an HQ user simulates a School or Parent. Renders nothing otherwise. */
export default function SimulationBanner() {
  const { simulating, stopSimulation, staff } = useSession();
  const navigate = useNavigate();
  if (!simulating) return null;

  const who = simulating.as === "school" ? `${staff?.name ?? "School user"} (${staff?.title ?? "School user"})${simulating.schoolName ? ` - ${simulating.schoolName}` : ""}` : `${PARENT.name} (Parent)`;
  const exit = () => {
    // Commit the role change first, so the route guard has already sent the HQ user to /admin; only then
    // navigate. Batched, the guard's redirect to /admin won this race and the user lost the Schools page.
    flushSync(stopSimulation);
    // focusMain: the Exit button unmounts, so AppShell moves focus to the main content after navigating.
    navigate("/admin/schools", { state: { focusMain: true } });
  };

  return (
    <section
      aria-label="Simulation mode"
      className="sticky top-3 z-30 mb-6 rounded-card border border-primary bg-primary-fixed px-5 py-3 text-on-primary-fixed"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
          <Eye size={22} weight="bold" aria-hidden="true" className="shrink-0 text-primary" />
          <p className="text-sm font-semibold">
            Simulation: viewing as <span className="font-bold">{who}</span>
          </p>
          <span className="rounded-full border border-primary px-2 py-0.5 text-xs font-semibold tabular-nums">
            Session {simulating.sessionId}
          </span>
          <Badge tone="neutral">Read-only</Badge>
          <AssumptionTag>open question</AssumptionTag>
        </div>
        <Button variant="secondary" size="sm" icon={<SignOut size={16} aria-hidden />} onClick={exit}>
          Exit simulation
        </Button>
      </div>
      <p className="mt-2 text-[13px]">
        Every button and field on this screen is disabled and nothing is saved. Links and the side navigation still work.
        Exit simulation to return to the HQ view.
      </p>
    </section>
  );
}

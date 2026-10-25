import { useEffect, useRef, useState, type ReactNode } from "react";
import { Navigate, Outlet, useLocation } from "react-router";
import { HQ_TABS, homeFor, navFor } from "../../data/nav";
import { useSession, type Role } from "../../session";
import type { Module } from "../../data/users";
import Header from "./Header";
import Sidebar from "./Sidebar";
import { guardRedirect } from "../../features/admin/simulation/logic";
import SimulationBanner from "../../features/admin/simulation/SimulationBanner";
import { Assistant } from "../../features/eservice/assistant/AssistantPanel";
import { AssistantProvider } from "../../features/eservice/assistant/AssistantProvider";

const SUBTITLE: Record<Role, string> = {
  hq: "MOE HQ - Education Account & FAS",
  school: "School Admin - Education Account & FAS",
  parent: "e-Service Portal - Education Account & FAS",
};

/** Route wrapper: renders children only for the listed roles, else sends the user home. */
export function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { role } = useSession();
  if (role && !roles.includes(role)) return <Navigate to={homeFor(role)} replace />;
  return children;
}

/** Route wrapper for School users: needs the module (or user management); HQ always passes. */
export function RequireAccess({ module, manage, children }: { module?: Module; manage?: boolean; children: ReactNode }) {
  const { role, can, canManageUsers } = useSession();
  if (role === "school" && (module ? !can(module) : manage && !canManageUsers)) return <Navigate to={homeFor(role)} replace />;
  return children;
}

export default function AppShell() {
  const { role, simulating, can, canManageUsers, isHqAdmin, hqTabs } = useSession();
  const { pathname } = useLocation();
  const [pinned, setPinned] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const { key, state } = useLocation() as { key: string; state: { focusMain?: boolean } | null };
  // A navigation can ask for focus on the content (e.g. after the Exit simulation button unmounts).
  useEffect(() => {
    if (state?.focusMain) mainRef.current?.focus();
  }, [key, state]);

  // Child routes (e.g. /admin/fas/hardcopy/FAS20260005) inherit the title of the nav item they sit under.
  const current = role
    ? navFor(role, { can, canManageUsers, isHqAdmin, hqTabs })
        .filter((n) => pathname === n.to || pathname.startsWith(`${n.to}/`))
        .sort((a, b) => b.to.length - a.to.length)[0]
    : undefined;
  const pageTitle = pathname.endsWith("/account") ? "Education Account" : pathname.endsWith("/fees") ? "Student fees" : current?.title ?? current?.label ?? "MOE";
  useEffect(() => {
    if (!role) return;
    const prev = document.title;
    document.title = `${pageTitle} - MOE Education Account`;
    return () => { document.title = prev; };
  }, [role, pageTitle]);

  const redirect = guardRedirect(role, pathname);
  if (redirect) return <Navigate to={redirect} replace />;
  if (!role) return null;
  // MOE HQ users only open the tabs the HQ admin gave them.
  if (role === "hq" && hqTabs && HQ_TABS.some((t) => (pathname === t.to || pathname.startsWith(`${t.to}/`)) && !hqTabs.includes(t.to))) {
    return hqTabs[0] ? <Navigate to={hqTabs[0]} replace /> : <p className="p-6 text-sm">No tabs have been assigned to your account. Ask an MOE HQ admin.</p>;
  }

  // icebearhoho header layout: no top bar — the page header (title, actions, bell, avatar) heads the content column.
  return (
    <AssistantProvider>
    <div className="flex min-h-screen">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-control focus:bg-primary focus:px-4 focus:py-2 focus:text-on-primary"
      >
        Skip to content
      </a>
      <Sidebar pinned={pinned} onTogglePin={() => setPinned((p) => !p)} />
      <div className="min-w-0 flex-1 p-6">
        <SimulationBanner />
        <Header
          title={pageTitle}
          subtitle={simulating?.schoolName ?? (role === "parent" ? SUBTITLE[role] : undefined)}
          showFilter={role !== "parent"}
        />
        <main ref={mainRef} id="main" tabIndex={-1} className="outline-none">
          {simulating ? (
            // Read-only simulation: a disabled fieldset natively disables every button, input and select inside it
            // (dialogs included), so simulated screens need no per-screen gating. Links stay clickable.
            // ponytail: sort headers, pagination and filters are disabled too; no way to whitelist inside a disabled fieldset.
            <fieldset disabled className="m-0 min-w-0 border-0 p-0">
              <legend className="sr-only">Simulated screen, read-only</legend>
              <Outlet />
            </fieldset>
          ) : (
            <Outlet />
          )}
        </main>
      </div>
      {role === "parent" && !simulating && <Assistant />}
    </div>
    </AssistantProvider>
  );
}

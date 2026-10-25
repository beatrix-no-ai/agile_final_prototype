import type { ComponentType, ReactNode } from "react";
import { createBrowserRouter, Navigate, type RouteObject } from "react-router";
import AppShell, { RequireAccess, RequireRole } from "./components/layout/AppShell";
import type { Module } from "./data/users";
import { ComingSoon } from "./components/layout/PagePlaceholder";
import { homeFor } from "./data/nav";
import { useSession } from "./session";

type Loader = () => Promise<{ default: ComponentType }>;

function RedirectIfSignedIn({ children }: { children: ReactNode }) {
  const { role } = useSession();
  return role ? <Navigate to={homeFor(role)} replace /> : children;
}

/** Lazy route from a default-export module. `hqOnly` sends School users back to /admin; `guestOnly` sends a signed-in visitor home. */
const page = (load: Loader, hqOnly = false, guestOnly = false, need?: Module | "users"): Pick<RouteObject, "lazy"> => ({
  lazy: async () => {
    const C = (await load()).default;
    if (guestOnly) return { Component: () => <RedirectIfSignedIn><C /></RedirectIfSignedIn> };
    return {
      Component: hqOnly
        ? () => (
            <RequireRole roles={["hq"]}>
              <C />
            </RequireRole>
          )
        : need
          ? () => (
              <RequireAccess {...(need === "users" ? { manage: true } : { module: need })}>
                <C />
              </RequireAccess>
            )
          : C,
    };
  },
});

function Landing() {
  const { role } = useSession();
  return <Navigate to={role ? homeFor(role) : "/signin"} replace />;
}

/** Dashboard is Sprint 2: /admin lands on the first Sprint 1 screen for the role. */
function AdminHome() {
  const { role } = useSession();
  return <Navigate to={role === "hq" ? "/admin/school-maintenance" : "/admin/classes"} replace />;
}

// Dev galleries: only the files that exist in this branch get a route.
const devRoutes: RouteObject[] = [];
if (import.meta.env.DEV) {
  const found = import.meta.glob("/src/dev/*.tsx") as Record<string, Loader>;
  for (const [path, file] of [["ui", "UiGallery"], ["data", "DataGallery"]]) {
    const load = found[`/src/dev/${file}.tsx`];
    if (load) devRoutes.push({ path: `dev/${path}`, ...page(load) });
  }
}

export const router = createBrowserRouter([
  { path: "/", Component: Landing },
  { path: "signin", HydrateFallback: () => null, ...page(() => import("./features/auth/SignIn"), false, true) },
  {
    Component: AppShell,
    HydrateFallback: () => null,
    children: [
      {
        path: "admin",
        children: [
          { index: true, Component: AdminHome },
          { path: "classes", ...page(() => import("./features/admin/classes/Classes")) },
          { path: "school-maintenance", ...page(() => import("./features/admin/school-maintenance/SchoolMaintenance"), true) },
          { path: "students", ...page(() => import("./features/admin/students/Students")) },
          { path: "students/:id/account", ...page(() => import("./features/admin/students/EducationAccountPage")) },
          { path: "students/:id/fees", ...page(() => import("./features/admin/students/StudentFees")) },
          { path: "fee-types", ...page(() => import("./features/admin/fee-types/FeeTypes")) },
          { path: "fas", ...page(() => import("./features/admin/fas/FasSection"), false, false, "FAS") },
          { path: "fas/hardcopy/:faId", ...page(() => import("./features/admin/fas/HardcopyDetailPage"), false, false, "FAS") },
          { path: "moefas", ...page(() => import("./features/admin/moefas/Moefas"), true) },
          { path: "users", ...page(() => import("./features/admin/users/Users"), false, false, "users") },
          { path: "budgets", ...page(() => import("./features/admin/budgets/Budgets"), false, false, "FAS") },
          { path: "top-up", ...page(() => import("./features/admin/top-up/TopUp"), true) },
          { path: "schools", ...page(() => import("./features/admin/simulation/SchoolRegistry"), true) },
          { path: "*", Component: ComingSoon },
        ],
      },
      {
        path: "parent",
        children: [
          { index: true, ...page(() => import("./features/eservice/overview/Overview")) },
          { path: "payments", ...page(() => import("./features/eservice/payments/Payments")) },
          { path: "transactions", ...page(() => import("./features/eservice/transactions/Transactions")) },
          { path: "fas", ...page(() => import("./features/eservice/fas/FamilyApplication")) },
          { path: "settings", ...page(() => import("./features/eservice/settings/Settings")) },
          { path: "*", Component: ComingSoon },
        ],
      },
    ],
  },
  ...devRoutes,
  { path: "*", Component: Landing },
]);

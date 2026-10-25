import type { Role } from "../../../session";
import type { School } from "../../../data/schools";

/** `staffEmail`: the School user being simulated (their modules decide the screens). */
export type Simulating = { as: "school" | "parent"; sessionId: string; schoolName?: string; staffEmail?: string };

/** The role whose nav, routes and guards apply: the simulated one while simulating, else the real one. */
export const effectiveRole = (real: Role | null, sim: Simulating | null): Role | null => (real === "hq" && sim ? sim.as : real);

/** Only an HQ user may simulate. Anyone else gets no simulation, whatever was stored. */
export const simulationFor = (real: Role | null, sim: Simulating | null): Simulating | null => (real === "hq" ? sim : null);

/** Where AppShell must send the visitor, or null to render. Signed out goes to sign-in; a role cannot open another role's prefix. */
export function guardRedirect(role: Role | null, pathname: string): string | null {
  if (!role) return "/signin";
  const prefix = role === "parent" ? "/parent" : "/admin";
  return pathname === prefix || pathname.startsWith(prefix + "/") ? null : prefix;
}

/** Validates a value read back from storage. */
export function parseSimulating(raw: unknown): Simulating | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if ((r.as !== "school" && r.as !== "parent") || typeof r.sessionId !== "string" || !r.sessionId) return null;
  return {
    as: r.as,
    sessionId: r.sessionId,
    ...(typeof r.schoolName === "string" && r.schoolName ? { schoolName: r.schoolName } : {}),
    ...(typeof r.staffEmail === "string" && r.staffEmail ? { staffEmail: r.staffEmail } : {}),
  };
}

// ASSUMPTION: mock session id, not an audit-grade identifier.
export const newSessionId = (now = Date.now()) => `SIM-${now.toString(36).toUpperCase().slice(-6)}`;

export const filterSchools = (schools: School[], q: string) => {
  const s = q.trim().toLowerCase();
  return s ? schools.filter((x) => x.name.toLowerCase().includes(s) || x.code.toLowerCase().includes(s)) : schools;
};

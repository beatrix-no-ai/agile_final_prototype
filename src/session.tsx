import { createContext, useContext, useState, type ReactNode } from "react";
import { STAFF, staffByEmail, userFor, type Module, type StaffAccount, type User } from "./data/users";
import { effectiveRole, newSessionId, parseSimulating, simulationFor, type Simulating } from "./features/admin/simulation/logic";

export type Role = "hq" | "school" | "parent";
type Session = {
  /** Effective role: the simulated role while an HQ user is simulating, else the signed-in role. */
  role: Role | null;
  /** The role actually signed in (HQ while simulating). */
  realRole: Role | null;
  /** The person actually signed in (the HQ user while simulating, never the simulated one). */
  user: User;
  /** The staff account acting right now (the simulated School user while an HQ user simulates one); null for parents and guests. */
  staff: StaffAccount | null;
  /** Whether the acting user may use a module. HQ always can; parents never. */
  can(m: Module): boolean;
  /** True for the school Principal (and HQ). */
  canManageUsers: boolean;
  simulating: Simulating | null;
  startSimulation(as: "school" | "parent", schoolName?: string, staffEmail?: string): void;
  stopSimulation(): void;
  signIn(role: Role, email?: string): void;
  signOut(): void;
};

const GUEST: User = { name: "Guest", initials: "G" };
const KEY = "moe-ui-role";
const EMAIL_KEY = "moe-ui-email";
const isRole = (v: unknown): v is Role => v === "hq" || v === "school" || v === "parent";

function initialRole(): Role | null {
  try {
    // DEV only: ?as=hq|school|parent signs in without the sign-in screen.
    if (import.meta.env.DEV) {
      const as = new URLSearchParams(location.search).get("as");
      if (isRole(as)) return as;
    }
    const saved = sessionStorage.getItem(KEY);
    return isRole(saved) ? saved : null;
  } catch {
    return null;
  }
}

function initialEmail(): string | null {
  try {
    return sessionStorage.getItem(EMAIL_KEY);
  } catch {
    return null;
  }
}

const SIM_KEY = "moe-ui-sim";

function initialSim(): Simulating | null {
  try {
    return parseSimulating(JSON.parse(sessionStorage.getItem(SIM_KEY) ?? "null"));
  } catch {
    return null;
  }
}

const Ctx = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [realRole, setRole] = useState<Role | null>(initialRole);
  const [sim, setSim] = useState<Simulating | null>(initialSim);
  const [email, setEmail] = useState<string | null>(initialEmail);
  const [note, setNote] = useState("");
  const simulating = simulationFor(realRole, sim);
  const role = effectiveRole(realRole, simulating);
  const setSimulating = (v: Simulating | null) => {
    setSim(v);
    try {
      if (v) sessionStorage.setItem(SIM_KEY, JSON.stringify(v));
      else sessionStorage.removeItem(SIM_KEY);
    } catch {
      /* storage unavailable: simulation lives in memory only */
    }
  };
  const set = (r: Role | null, who?: string) => {
    setSimulating(null);
    setRole(r);
    setEmail(r && who ? who : null);
    try {
      if (r) sessionStorage.setItem(KEY, r);
      else sessionStorage.removeItem(KEY);
      if (r && who) sessionStorage.setItem(EMAIL_KEY, who);
      else sessionStorage.removeItem(EMAIL_KEY);
    } catch {
      /* storage unavailable: session lives in memory only */
    }
  };
  const signed = realRole === "hq" || realRole === "school" ? (staffByEmail(email)?.role === realRole ? staffByEmail(email) : undefined) ?? STAFF.find((s) => s.role === realRole) ?? null : null;
  const staff = role === "school" && realRole === "hq" ? (staffByEmail(simulating?.staffEmail) ?? STAFF.find((s) => s.role === "school")) ?? null : role === "hq" || role === "school" ? signed : null;
  const value: Session = {
    role,
    staff,
    can: (m) => role === "hq" || (role === "school" && !!staff?.modules.includes(m)),
    canManageUsers: role === "hq" || (role === "school" && staff?.title === "Principal"),
    realRole,
    simulating,
    startSimulation: (as, schoolName, staffEmail) => {
      if (realRole === "hq") {
        setSimulating({ as, sessionId: newSessionId(), ...(schoolName ? { schoolName } : {}), ...(staffEmail ? { staffEmail } : {}) });
        setNote("Simulation started");
      }
    },
    stopSimulation: () => {
      setSimulating(null);
      setNote("Simulation ended");
    },
    user: realRole ? (signed ?? userFor(realRole)) : GUEST,
    signIn: (r, who) => set(r, who),
    signOut: () => set(null),
  };
  return (
    <Ctx.Provider value={value}>
      {children}
      {/* Lives here, not in a screen: the shell and banner unmount while the role changes. */}
      <div role="status" className="sr-only">{note}</div>
    </Ctx.Provider>
  );
}

export function useSession(): Session {
  const s = useContext(Ctx);
  if (!s) throw new Error("useSession must be used inside SessionProvider");
  return s;
}

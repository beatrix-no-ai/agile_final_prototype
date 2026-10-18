import { STUDENTS } from "./students";

export type SbfasTier = "Tier 1" | "Tier 2" | "Tier 3" | "Tier 4";
export type SbfasStatus = "Pending" | "Approved" | "Rejected";

export type SbfasApplication = {
  id: string;
  /** Display name; `studentId` links the application to the student's Education Account, fees and FAS subsidy. */
  student: string;
  studentId: string;
  level: string;
  /** Per-capita household income BAND only; the third-party income API never returns exact income. */
  incomeBand: string;
  /** Gross household income band; a big household can sit in a higher band than its per-capita band. Absent on family-submitted applications. */
  householdBand?: string;
  /** ISO date the third-party income API last synced this application's bands. */
  incomeSyncedOn?: string;
  /** Working days left to decide. 0 or below = overdue. */
  slaDays: number;
  status: SbfasStatus;
  sbfasTier?: SbfasTier;
  /** Reason for a rejection (or an optional note on an approval). */
  justification?: string;
  /** ISO timestamp of the decision; set when the application is decided. */
  decidedAt?: string;
};

/** Income bands are read-only and come from the third-party MyInfo (SingPass) API — never typed in by the school. */
export const INCOME_API_SOURCE = "MyInfo (SingPass) API";

// ASSUMPTION: tier names (Tier 1 = highest subsidy), band edges and SLA length are invented; confirm with MOE.
export const SBFAS_TIERS: SbfasTier[] = ["Tier 1", "Tier 2", "Tier 3", "Tier 4"];

/**
 * Next application reference in the SBFASXXXX format: 4-digit zero-padded sequence continuing from the
 * highest existing one (seeds start at 0001, so an empty queue starts at SBFAS0001). Past 9999 the digits simply grow (SBFAS10000) — never
 * validate or parse the reference with a fixed-length pattern, and sort by the numeric sequence, not the string.
 */
export const nextSbfasId = (apps: Pick<SbfasApplication, "id">[]) =>
  `SBFAS${String(apps.reduce((m, a) => Math.max(m, Number(a.id.replace(/\D/g, "")) || 0), 0) + 1).padStart(4, "0")}`;

// ASSUMPTION: per-capita monthly income bands (S$) are mock values.
const B1 = "Up to S$450";
const B2 = "S$451 - S$700";
const B3 = "S$701 - S$1,000";
const B4 = "S$1,001 - S$1,500";

// ASSUMPTION: gross monthly household income bands (S$). Shown beside the per-capita band on the review screen.
const H1 = "Up to S$1,500";
const H2 = "S$1,501 - S$2,500";
const H3 = "S$2,501 - S$4,000";
const H4 = "Above S$4,000";

// Applications are seeded against real student records so the queue can show each family's fee payable.
const of = (name: string) => STUDENTS.find((s) => s.name === name)!;

const p = (id: string, student: string, incomeBand: string, householdBand: string, incomeSyncedOn: string, slaDays: number): SbfasApplication => {
  const s = of(student);
  return { id, student, studentId: s.id, level: s.level, incomeBand, householdBand, incomeSyncedOn, slaDays, status: "Pending" };
};

// Foreign nationals cannot apply for either scheme, so none is seeded. Daniel Koh is the dual-citizen (Singapore + British) case.
export const SBFAS_APPLICATIONS: SbfasApplication[] = [
  p("SBFAS0001", "Kavitha d/o Raman", B1, H2, "2026-10-05", 1),
  p("SBFAS0002", "Foo Mei Ling", B1, H1, "2026-10-05", 2),
  p("SBFAS0003", "Ethan Teo Kai Ming", B2, H2, "2026-10-08", 0),
  p("SBFAS0004", "Ang Li Ying", B2, H3, "2026-10-08", 3),
  p("SBFAS0005", "Yeo Rui En", B3, H3, "2026-10-10", 4),
  p("SBFAS0006", "Tay Jing Wen", B3, H3, "2026-10-10", 5),
  p("SBFAS0007", "Marcus Heng Zhe Yu", B4, H4, "2026-10-12", 7),
  p("SBFAS0008", "Goh Yu Xuan", B4, H4, "2026-10-12", 5),
  p("SBFAS0009", "Lim Xin Yi", B4, H4, "2026-10-12", 8),
  p("SBFAS0010", "Adrian Pereira", B4, H4, "2026-10-11", 9),
  p("SBFAS0011", "Sim Hui Min", B2, H3, "2026-10-11", 2),
  p("SBFAS0012", "Arjun s/o Krishnan", B2, H2, "2026-10-06", 4),
  p("SBFAS0013", "Meera d/o Ramasamy", B1, H1, "2026-10-06", 3),
  p("SBFAS0014", "Siti Nurhaliza binte Osman", B3, H3, "2026-10-09", 6),
  p("SBFAS0015", "Aqil Zafran bin Salleh", B2, H2, "2026-10-07", 1),
  p("SBFAS0016", "Mohamed Danish bin Yusof", B3, H3, "2026-10-09", 7),
  p("SBFAS0017", "Deepa d/o Govindasamy", B2, H2, "2026-10-07", 5),
  p("SBFAS0018", "Daniel Koh Jun Wei", B3, H3, "2026-10-12", 3),
];

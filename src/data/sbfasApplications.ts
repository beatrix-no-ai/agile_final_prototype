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
  /** Working days left to decide. 0 or below = overdue. */
  slaDays: number;
  status: SbfasStatus;
  sbfasTier?: SbfasTier;
  /** Reason for a rejection (or an optional note on an approval). */
  justification?: string;
  /** ISO timestamp of the decision; set when the application is decided. */
  decidedAt?: string;
};

// ASSUMPTION: tier names (Tier 1 = highest subsidy), band edges and SLA length are invented; confirm with MOE.
export const SBFAS_TIERS: SbfasTier[] = ["Tier 1", "Tier 2", "Tier 3", "Tier 4"];

/**
 * Next application reference in the SBFAS-XXXX format: 4-digit zero-padded sequence continuing from the
 * highest existing one (seeds start at 2000). Past 9999 the digits simply grow (SBFAS-10000) — never
 * validate or parse the reference with a fixed-length pattern, and sort by the numeric sequence, not the string.
 */
export const nextSbfasId = (apps: Pick<SbfasApplication, "id">[]) =>
  `SBFAS-${String(apps.reduce((m, a) => Math.max(m, Number(a.id.replace(/\D/g, "")) || 0), 2000) + 1).padStart(4, "0")}`;

// ASSUMPTION: per-capita monthly income bands (S$) are mock values.
const B1 = "Up to S$450";
const B2 = "S$451 - S$700";
const B3 = "S$701 - S$1,000";
const B4 = "S$1,001 - S$1,500";

// Applications are seeded against real student records so the queue can show each family's fee payable.
const of = (name: string) => STUDENTS.find((s) => s.name === name)!;

const p = (id: string, student: string, incomeBand: string, slaDays: number): SbfasApplication => {
  const s = of(student);
  return { id, student, studentId: s.id, level: s.level, incomeBand, slaDays, status: "Pending" };
};

export const SBFAS_APPLICATIONS: SbfasApplication[] = [
  p("SBFAS-2041", "Kavitha d/o Raman", B1, 1),
  p("SBFAS-2042", "Foo Mei Ling", B1, 2),
  p("SBFAS-2043", "Ethan Teo Kai Ming", B2, 0),
  p("SBFAS-2044", "Ang Li Ying", B2, 3),
  p("SBFAS-2045", "Yeo Rui En", B3, 4),
  p("SBFAS-2046", "Tay Jing Wen", B3, 5),
  p("SBFAS-2047", "Chua Jia Hui", B3, 6),
  p("SBFAS-2048", "Marcus Heng Zhe Yu", B4, 7),
  p("SBFAS-2049", "Goh Yu Xuan", B4, 5),
  p("SBFAS-2050", "Lim Xin Yi", B4, 8),
  p("SBFAS-2051", "Adrian Pereira", B4, 9),
  p("SBFAS-2052", "Sim Hui Min", B2, 2),
  p("SBFAS-2053", "Arjun s/o Krishnan", B2, 4),
  p("SBFAS-2054", "Meera d/o Ramasamy", B1, 3),
  p("SBFAS-2055", "Siti Nurhaliza binte Osman", B3, 6),
  p("SBFAS-2056", "Aqil Zafran bin Salleh", B2, 1),
  p("SBFAS-2057", "Mohamed Danish bin Yusof", B3, 7),
  p("SBFAS-2058", "Deepa d/o Govindasamy", B2, 5),
];

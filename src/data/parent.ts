// ASSUMPTION: mock data that only the parent portal owns (profile, FAS reference). Children, invoices, balances and FAS outcomes come from the school side (see lib/family.ts).
// Dates are ISO yyyy-mm-dd; the mock "today" is MOCK_TODAY.
export const MOCK_TODAY = "2026-10-12";

export type Invoice = { id: string; childId: string; title: string; amount: number; dueDate: string; status: "unpaid" | "overdue" | "paid" };
export type Child = { id: string; name: string; level: string; school: string; educationBalance: number };
export type Transaction = {
  id: string;
  date: string;
  childId: string;
  description: string;
  /** Signed: positive = credit to the education account or refund, negative = payment. */
  amount: number;
  method: "Education account" | "Card" | "MOE top-up";
  invoiceId?: string;
};

/** The parent's children are real students (Education Account, fees and FAS all come from the school side); matched by name. */
export const FAMILY_STUDENT_NAMES = ["Ethan Lim Jun Hao", "Chloe Lim Wen Xin"] as const;

/** Reference number of the family application, and the date the income band on file was last synced. */
export const fasStatus = { applicationId: "FAS-2026-0418", submittedOn: "2026-09-18" };

export type Profile = { name: string; nric: string; address: string; mailingAddress: string; contact: string };

export const profile: Profile = {
  name: "Rachel Lim",
  nric: "S****567A",
  address: "Blk 214 Bishan Street 23, #08-112, Singapore 570214",
  mailingAddress: "Blk 214 Bishan Street 23, #08-112, Singapore 570214",
  contact: "+65 9123 4567",
};


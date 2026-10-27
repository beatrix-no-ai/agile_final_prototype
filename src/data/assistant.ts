// ASSUMPTION: mock knowledge for the e-Service assistant (US-056 to US-059). There is no AI model: every answer below is canned and only covers how to use the portal.
// Account-specific data (balances, charges, eligibility) is never answered in chat; the assistant points to the page instead (AI-12, AC-056-03).

export type Answer = { text: string; steps?: string[]; source: string; link?: { to: string; label: string } };

export const STARTERS = ["How do I pay a fee?", "Check my child's balance", "Apply for FAS", "Update my address"];

export const ANSWERS = {
  // Source: FS_Payment_Parent_View_v2. There is one way to pay: the Education Account first, the rest by card or bank. No choice screen.
  pay: {
    text: "You pay in one way. The system uses each child's Education Account first, and anything left is paid by card or bank. Part payment is possible: you can pay only some invoices, and if the account covers part of an invoice, the rest goes by card or bank.",
    steps: [
      "Open Payments.",
      "Tick the invoice(s) you want to pay, or Select all unpaid and overdue.",
      "Check the Payment summary. It shows how much comes from the Education Account and how much by card or bank.",
      "Press Pay and confirm in the window. If a card or bank amount is due, it goes through the payment gateway.",
      "A message at the top confirms the payment, and it shows in Transactions.",
    ],
    source: "Help: Paying fees",
    link: { to: "/parent/payments", label: "Open Payments" },
  },
  payShort: {
    text: "You don't need to choose anything. The system takes the Education Account balance first and the rest is paid by card or bank. The Payment summary shows the split before you confirm. A child's account only pays that child's own invoices.",
    source: "Help: Paying fees",
    link: { to: "/parent/payments", label: "Open Payments" },
  },
  payFailed: {
    text: "If a payment doesn't go through you will see \"Payment not completed\". Nothing is charged and your invoices stay as they were, so you can try again or close the window.",
    source: "Help: Paying fees",
    link: { to: "/parent/payments", label: "Open Payments" },
  },
  outstanding: {
    text: "Your unpaid invoices are on the Payments page, overdue ones first, then by due date. Each shows the amount you still owe (after any FAS subsidy) and its due date.",
    source: "Help: Outstanding charges",
    link: { to: "/parent/payments", label: "Open Payments" },
  },
  balance: {
    text: "I can't read account figures in chat. Each child's Education Account balance is on the Overview page under Your children, and at the top of Payments.",
    source: "Help: Education Account",
    link: { to: "/parent", label: "Open Overview" },
  },
  transactions: {
    text: "Transactions lists top-ups, payments and refunds for your children, newest first. You can filter by child, type and date range. Card payments are listed but don't change the Education Account balance. The Invoices tab lists paid invoices; press View details to see the charges, subsidy and payments of each one.",
    source: "Help: Transactions",
    link: { to: "/parent/transactions", label: "Open Transactions" },
  },
  details: {
    text: "Open Settings and press Edit on Your details. You can change your residential address, mailing address and contact number. Your name and NRIC come from SingPass and can't be changed here.",
    source: "Help: Your details",
    link: { to: "/parent/settings", label: "Open Settings" },
  },
  fasStatus: {
    text: "Your application status is on the Financial Assistance Scheme page: a three-step tracker (Prepare info, Submission, Disbursement) and a result for each child (Pending, Granted or Declined).",
    source: "Help: Financial assistance",
    link: { to: "/parent/fas", label: "Open FAS" },
  },
  fasEligibility: {
    text: "I can't tell you whether you qualify or how much you would get. MOEFAS is granted automatically when the criteria are met. If not, your child's school decides on SBFAS. One application covers all your children.",
    source: "Help: Financial assistance",
    link: { to: "/parent/fas", label: "Open FAS" },
  },
  fasSubmitted: {
    text: "Your family application is already submitted, so there is nothing left to fill in. You can follow it here:",
    source: "Help: Financial assistance",
    link: { to: "/parent/fas", label: "View my application" },
  },
} satisfies Record<string, Answer>;

/** ASSUMPTION (AI-07): the human escalation path is not defined yet; this contact is invented. */
export const HUMAN = {
  text: "I'm an AI and can't do everything. A person at MOE can help you:",
  contact: "MOE Customer Service: 1800 000 0000 (mock), Mon to Fri, 8.30am to 5.30pm",
};

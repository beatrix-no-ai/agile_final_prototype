import { ANSWERS, HUMAN, STARTERS, type Answer } from "../../../data/assistant";
import type { FormValues } from "../fas/logic";

// ASSUMPTION: mock assistant. Keyword matching picks a canned answer; it asks at most one follow-up, then stops (AC-057-01, AC-057-03).

export type DraftField = { key: keyof FormValues; label: string; value: string; source: "profile" | "answer" | "missing" };
export type Draft = { fields: DraftField[] };
/** What the assistant says; the provider adds an id and the sender. */
export type Reply = { text: string; steps?: string[]; source?: string; link?: { to: string; label: string }; chips?: string[]; draft?: Draft; human?: string };
export type Flow = { pending?: "topic"; fas?: { step: "residents" | "extra"; residents?: string } };
export type Ctx = { contact: string; mailingAddress: string; children: number; fasStage: "not-started" | "preparing" | "submitted" };
export type Turn = { replies: Reply[]; flow: Flow };

const has = (t: string, ...w: string[]) => w.some((x) => t.includes(x));
const fromAnswer = (a: Answer): Reply => ({ ...a });

export const welcome = (name: string): Reply => ({
  text: `Hi ${name}, I can help you find your way around this portal and fill in the FAS application. Ask in your own words.`,
  chips: STARTERS,
});

export const humanReply = (): Reply => ({ text: HUMAN.text, human: HUMAN.contact });

/** Shown after the parent clicks "Fill the form". The assistant never submits and never ticks the consent box. */
export const filledReply = (missing: number): Reply => ({
  text: `I've filled in the form. ${missing ? `${missing} field${missing > 1 ? "s are" : " is"} blank and highlighted for you. ` : ""}Please check every field, tick the consent box yourself and press Submit. Supporting documents are optional and can be added on the form. I can't submit for you.`,
});

const residentsQ = (ctx: Ctx): Reply => {
  const d = ctx.children + 2; // same default as the form: parents + children
  return { text: "How many people live in your home now, including you?", chips: [d - 1, d, d + 1].filter((n) => n >= 1).map((n) => `${n} people`) };
};
const extraQ: Reply = {
  text: "Is there other monthly money that MOE would not already have, such as rental, allowance or family support? Type an amount in dollars, or choose an option.",
  chips: ["None", "Skip for now"],
};

function startFas(ctx: Ctx): Turn {
  if (ctx.fasStage === "submitted") return { replies: [fromAnswer(ANSWERS.fasSubmitted)], flow: {} };
  return {
    replies: [{ text: "Happy to help. I'll use the details already on your profile and only ask for what is missing, so there are two quick questions." }, residentsQ(ctx)],
    flow: { fas: { step: "residents" } },
  };
}

const field = (key: DraftField["key"], label: string, value: string, source: DraftField["source"]): DraftField => ({ key, label, value, source: value ? source : "missing" });

function fasStep(flow: NonNullable<Flow["fas"]>, t: string, ctx: Ctx): Turn {
  if (flow.step === "residents") {
    const n = Number(t.match(/\b\d{1,2}\b/)?.[0]);
    if (!Number.isInteger(n) || n < 1 || n > 20) return { replies: [{ text: "Please give a whole number from 1 to 20.", chips: residentsQ(ctx).chips }], flow: { fas: flow } };
    return { replies: [extraQ], flow: { fas: { step: "extra", residents: String(n) } } };
  }
  let extra: string | null = null;
  if (/^(none|no|nil|0)\b/.test(t)) extra = "0";
  else if (has(t, "skip")) extra = "";
  else {
    const m = t.match(/^\$?\s*(\d+(?:\.\d{1,2})?)\s*$/);
    if (m) extra = m[1];
  }
  if (extra === null) return { replies: [{ text: "Please type an amount in dollars (for example 300), or choose an option.", chips: extraQ.chips }], flow: { fas: flow } };
  const fields = [
    field("extraIncome", "Extra monthly money (S$)", extra, "answer"),
    field("residents", "People currently living in your home", flow.residents ?? "", "answer"),
    field("contact", "Contact number", ctx.contact, "profile"),
    field("mailingAddress", "Mailing address", ctx.mailingAddress, "profile"),
  ];
  const blank = fields.filter((f) => f.source === "missing").length;
  return {
    replies: [{ text: `That's all I need. Here is your draft. Nothing is submitted yet, you review it first.${blank ? " One field is blank because I did not have it." : ""}`, draft: { fields } }],
    flow: {},
  };
}

function route(t: string, ctx: Ctx): Turn | null {
  const done = (r: Reply): Turn => ({ replies: [r], flow: {} });
  if (has(t, "talk to", "speak to", "human", "complain", "real person", "contact moe")) return done(humanReply());
  if (has(t, "eligible", "qualify", "how much") && has(t, "fas", "assistance", "subsid", "qualify", "eligible")) return done(fromAnswer(ANSWERS.fasEligibility));
  if (has(t, "fas", "financial assistance", "assistance scheme", "subsid")) {
    if (has(t, "status", "track", "outcome", "result", "where")) return done(fromAnswer(ANSWERS.fasStatus));
    return startFas(ctx);
  }
  if (has(t, "outstanding", "owe", "what do i have to pay", "unpaid")) return done(fromAnswer(ANSWERS.outstanding));
  if (has(t, "pay", "fee", "charge", "bill")) {
    if (has(t, "fail", "declin", "not go through", "didn't go through", "not completed", "error")) return done(fromAnswer(ANSWERS.payFailed));
    if (has(t, "not enough", "too low", "shortfall", "insufficient", "run out", "card", "online", "paynow", "bank")) return done(fromAnswer(ANSWERS.payShort));
    return done(fromAnswer(ANSWERS.pay));
  }
  if (has(t, "balance", "education account", "how much money")) return done(fromAnswer(ANSWERS.balance));
  if (has(t, "transaction", "history", "receipt", "statement")) return done(fromAnswer(ANSWERS.transactions));
  if (has(t, "address", "contact number", "phone", "profile", "personal detail", "update my", "mailing")) return done(fromAnswer(ANSWERS.details));
  if (/^(hi|hello|hey)\b/.test(t)) return done(welcome("there"));
  if (t.split(/\s+/).length <= 5 && has(t, "help", "question", "how do i", "how to")) {
    return { replies: [{ text: "Sure. What would you like to do?", chips: STARTERS }], flow: { pending: "topic" } };
  }
  return null;
}

const outOfScope = (): Reply => ({
  text: "I can only help with using this portal: paying fees, your account and transactions, your details, and the FAS application. For anything else, please talk to a person.",
  chips: ["Talk to a person"],
});

/** One conversation turn. Pure: the same flow and text always give the same replies. */
export function respond(flow: Flow, input: string, ctx: Ctx): Turn {
  const t = input.trim().toLowerCase();
  // Never repeat personal identifiers back (AI-09).
  if (/\b[stfgm]\d{7}[a-z]\b/i.test(input) || /\d{12,}/.test(input.replace(/[\s-]/g, ""))) {
    return { replies: [{ text: "Please don't type ID numbers or bank details in chat. I don't need them, and I can't keep them safe. Your profile already holds what the form needs." }], flow };
  }
  if (flow.fas) {
    if (has(t, "start over", "cancel", "stop")) return startFas(ctx);
    if (!has(t, "talk to", "speak to", "human", "complain")) return fasStep(flow.fas, t, ctx);
  }
  return route(t, ctx) ?? { replies: [outOfScope()], flow: {} };
}

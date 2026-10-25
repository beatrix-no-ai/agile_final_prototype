import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { useParent } from "../../../data/parentStore";
import type { FormValues } from "../fas/logic";
import { filledReply, humanReply, respond, welcome, type Draft, type Flow, type Reply } from "./engine";

export type Msg = Reply & { id: number; from: "user" | "bot" };
export type Marks = Partial<Record<keyof FormValues, "ai" | "missing">>;
/** A request from the chat for the FAS form to take these values. The form clears it once applied. */
export type Fill = { id: number; values: Partial<FormValues>; marks: Marks };

type Assistant = {
  open: boolean;
  setOpen: (v: boolean) => void;
  msgs: Msg[];
  busy: boolean;
  /** Simulated outage: open the app with ?ai=down. */
  down: boolean;
  send: (text: string) => void;
  /** Open the panel and ask something on the parent's behalf (e.g. from the FAS form). */
  ask: (text: string) => void;
  showHuman: () => void;
  reset: () => void;
  retry: () => void;
  applyDraft: (d: Draft) => void;
  fill: Fill | null;
  clearFill: () => void;
};

const noop = () => {};
// Outside the provider (e.g. HQ simulating a parent, read-only) the assistant simply does not exist.
const Ctx = createContext<Assistant>({ open: false, setOpen: noop, msgs: [], busy: false, down: false, send: noop, ask: noop, showHuman: noop, reset: noop, retry: noop, applyDraft: noop, fill: null, clearFill: noop });
export const useAssistant = () => useContext(Ctx);

const DELAY = 600; // mock "thinking" time

export function AssistantProvider({ children }: { children: ReactNode }) {
  const { state, dispatch } = useParent();
  const navigate = useNavigate();
  const seq = useRef(0);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fill, setFill] = useState<Fill | null>(null);
  const [down] = useState(() => new URLSearchParams(window.location.search).get("ai") === "down");
  const first = state.profile.name.split(" ")[0];
  const bot = (r: Reply): Msg => ({ ...r, id: ++seq.current, from: "bot" });
  const [msgs, setMsgs] = useState<Msg[]>(() => [bot(welcome(first))]);
  const flow = useRef<Flow>({});
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // The latest profile and FAS stage, read when a reply is due rather than when the question was sent.
  const ctx = { contact: state.profile.contact, mailingAddress: state.profile.mailingAddress, children: state.children.length, fasStage: state.fas.stage };
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;
  useEffect(() => () => clearTimeout(timer.current), []);

  const later = (fn: () => void) => {
    setBusy(true);
    timer.current = setTimeout(() => { fn(); setBusy(false); }, DELAY);
  };

  const api = useMemo<Assistant>(() => {
    const send = (text: string) => {
      const t = text.trim();
      if (!t || busy || down) return;
      setMsgs((m) => [...m, { id: ++seq.current, from: "user", text: t }]);
      later(() => {
        const turn = respond(flow.current, t, ctxRef.current);
        flow.current = turn.flow;
        setMsgs((m) => [...m, ...turn.replies.map(bot)]);
      });
    };
    return {
      open, setOpen, msgs, busy, down, send, fill,
      ask: (text) => { setOpen(true); send(text); },
      showHuman: () => setMsgs((m) => [...m, bot(humanReply())]),
      reset: () => { clearTimeout(timer.current); setBusy(false); flow.current = {}; setMsgs([bot(welcome(first))]); },
      retry: () => later(() => {}),
      clearFill: () => setFill(null),
      applyDraft: (d) => {
        const missing = d.fields.filter((f) => f.source === "missing").length;
        if (ctxRef.current.fasStage === "not-started") dispatch({ type: "startFas" });
        setFill({
          id: ++seq.current,
          values: Object.fromEntries(d.fields.map((f) => [f.key, f.value])),
          marks: Object.fromEntries(d.fields.map((f) => [f.key, f.source === "missing" ? "missing" : "ai"])),
        });
        navigate("/parent/fas");
        setMsgs((m) => [...m, bot(filledReply(missing))]);
        if (window.matchMedia("(max-width: 1279px)").matches) setOpen(false); // the panel would cover the form
      },
    };
  }, [open, msgs, busy, down, fill, dispatch, navigate, first]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

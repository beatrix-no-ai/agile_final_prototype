import { ArrowCounterClockwise, BookOpen, ChatCircleDots, Headset, PaperPlaneTilt, ThumbsDown, ThumbsUp, WarningCircle, X } from "@phosphor-icons/react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router";
import { Badge } from "../../../components/ui/Badge";
import { AssumptionTag } from "../../../components/ui/AssumptionTag";
import { Button } from "../../../components/ui/Button";
import { inputClass } from "../../../components/ui/Field";
import { useAssistant, type Msg } from "./AssistantProvider";
import type { Draft } from "./engine";

const sourceLabel = { profile: "From your profile", answer: "From your answer" } as const;

function DraftCard({ draft, onFill }: { draft: Draft; onFill: () => void }) {
  return (
    <div className="mt-3 rounded-control border border-line bg-surface-container-lowest">
      <dl className="divide-y divide-line">
        {draft.fields.map((f) => (
          <div key={f.key} className="px-3 py-2">
            <dt className="text-xs text-on-surface-variant">{f.label}</dt>
            <dd className="mt-0.5 flex flex-wrap items-center justify-between gap-2 text-[13px]">
              {f.source === "missing" ? <span className="italic text-on-surface-variant">Blank</span> : <span className="font-semibold">{f.value}</span>}
              {f.source === "missing" ? <Badge tone="warning">Missing, please fill</Badge> : <span className="rounded-full bg-track px-2 py-0.5 text-xs font-medium text-on-surface-variant">{sourceLabel[f.source]}</span>}
            </dd>
          </div>
        ))}
      </dl>
      <div className="border-t border-line p-3">
        <Button className="w-full" onClick={onFill}>Fill the form</Button>
        <p className="mt-2 text-xs text-on-surface-variant">You can change every value on the form. You submit it yourself.</p>
      </div>
    </div>
  );
}

function Bubble({ m, rating, onRate, onFill, onNavigate }: { m: Msg; rating?: "up" | "down"; onRate: (r: "up" | "down") => void; onFill: (d: Draft) => void; onNavigate: () => void }) {
  if (m.from === "user") {
    return <div className="ml-auto max-w-[85%] rounded-card rounded-br-sm bg-primary-fixed px-3.5 py-2.5 text-sm text-on-primary-fixed">{m.text}</div>;
  }
  return (
    <div className="max-w-[92%]">
      <div className="rounded-card rounded-tl-sm border border-line bg-surface-container-low px-3.5 py-2.5 text-sm">
        <p>{m.text}</p>
        {m.steps && (
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            {m.steps.map((s) => <li key={s}>{s}</li>)}
          </ol>
        )}
        {m.human && (
          <p className="mt-2 flex items-start gap-2 rounded-control bg-surface-container-lowest p-2.5 font-semibold">
            <Headset size={18} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
            <span>{m.human} <AssumptionTag note="The contact and the hand-over to a person are not defined yet (AI-07)." /></span>
          </p>
        )}
        {m.draft && <DraftCard draft={m.draft} onFill={() => onFill(m.draft!)} />}
        {m.link && (
          <Link to={m.link.to} onClick={onNavigate} className="mt-3 inline-flex min-h-9 items-center rounded-control border border-line bg-surface-container-lowest px-3 text-[13px] font-semibold text-primary hover:bg-primary-fixed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
            {m.link.label}
          </Link>
        )}
      </div>
      {m.source && (
        <div className="mt-1 flex items-center justify-between gap-2 px-1 text-xs text-on-surface-variant">
          <span className="inline-flex items-center gap-1"><BookOpen size={14} aria-hidden="true" />Source: {m.source}</span>
          <span className="inline-flex gap-1">
            {(["up", "down"] as const).map((r) => (
              <button key={r} type="button" aria-pressed={rating === r} aria-label={r === "up" ? "Good answer" : "Wrong answer"} onClick={() => onRate(r)} className={`grid size-8 place-items-center rounded-full hover:bg-primary-fixed focus-visible:outline-2 focus-visible:outline-primary ${rating === r ? "bg-primary-fixed text-primary" : ""}`}>
                {r === "up" ? <ThumbsUp size={16} weight={rating === r ? "fill" : "regular"} /> : <ThumbsDown size={16} weight={rating === r ? "fill" : "regular"} />}
              </button>
            ))}
          </span>
        </div>
      )}
    </div>
  );
}

/** Floating launcher when closed; docked panel (drawer on narrow screens) when open. */
export function Assistant() {
  const a = useAssistant();
  const [text, setText] = useState("");
  const [rated, setRated] = useState<Partial<Record<number, "up" | "down">>>({});
  const input = useRef<HTMLInputElement>(null);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => { if (a.open) input.current?.focus(); }, [a.open]);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [a.msgs.length, a.busy, a.open]);

  if (!a.open) {
    return (
      <Button className="fixed bottom-6 right-6 z-30 min-h-12 rounded-full px-5 shadow-lg" onClick={() => a.setOpen(true)} icon={<ChatCircleDots size={22} weight="bold" aria-hidden="true" />}>
        Ask MOE Assistant
      </Button>
    );
  }

  const closeIfNarrow = () => { if (window.matchMedia("(max-width: 1279px)").matches) a.setOpen(false); };
  const submit = (e: FormEvent) => { e.preventDefault(); a.send(text); setText(""); };
  const last = a.msgs[a.msgs.length - 1];

  return (
    <aside
      aria-label="MOE Assistant"
      onKeyDown={(e) => { if (e.key === "Escape") a.setOpen(false); }}
      className="fixed inset-y-0 right-0 z-40 flex w-full flex-col bg-surface-container-lowest shadow-2xl sm:w-96 xl:sticky xl:top-0 xl:z-auto xl:h-screen xl:shrink-0 xl:border-l xl:border-line xl:shadow-none"
    >
      <header className="flex items-center gap-3 border-b border-line px-4 py-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-on-primary" aria-hidden="true"><ChatCircleDots size={20} weight="bold" /></span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-bold leading-tight">MOE Assistant</h2>
          <Badge tone="primary">AI · English</Badge>
        </div>
        <button type="button" aria-label="New chat" title="New chat" onClick={a.reset} className="grid size-10 place-items-center rounded-full text-on-surface-variant hover:bg-primary-fixed focus-visible:outline-2 focus-visible:outline-primary"><ArrowCounterClockwise size={20} /></button>
        <button type="button" aria-label="Close assistant" title="Close" onClick={() => a.setOpen(false)} className="grid size-10 place-items-center rounded-full text-on-surface-variant hover:bg-primary-fixed focus-visible:outline-2 focus-visible:outline-primary"><X size={20} /></button>
      </header>

      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 bg-track px-4 py-2 text-xs text-on-surface-variant">
        AI can make mistakes. Check answers on the page. Don't type ID numbers or bank details.
        <AssumptionTag note="Mock AI: answers are canned and nothing is sent anywhere." />
      </p>

      <div role="log" aria-live="polite" aria-label="Conversation" className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {a.msgs.map((m) => (
          <Bubble key={m.id} m={m} rating={rated[m.id]} onRate={(r) => setRated((p) => ({ ...p, [m.id]: p[m.id] === r ? undefined : r }))} onFill={a.applyDraft} onNavigate={closeIfNarrow} />
        ))}
        {a.busy && (
          <div className="inline-flex items-center gap-1 rounded-card border border-line bg-surface-container-low px-3.5 py-3" role="status">
            <span className="sr-only">The assistant is typing</span>
            {[0, 1, 2].map((i) => <span key={i} aria-hidden="true" style={{ animationDelay: `${i * 150}ms` }} className="size-2 rounded-full bg-on-surface-variant motion-safe:animate-pulse" />)}
          </div>
        )}
        {!a.busy && !a.down && last?.from === "bot" && last.chips && (
          <div className="flex flex-wrap gap-2">
            {last.chips.map((c) => (
              <button key={c} type="button" onClick={() => a.send(c)} className="min-h-9 rounded-full border border-line bg-surface-container-lowest px-3 text-[13px] font-medium text-primary hover:bg-primary-fixed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">{c}</button>
            ))}
          </div>
        )}
        <div ref={end} />
      </div>

      {a.down && (
        <div role="alert" className="mx-4 mb-3 rounded-control border border-warning/30 bg-warning-container p-3 text-[13px] text-warning">
          <p className="flex items-center gap-2 font-semibold"><WarningCircle size={18} weight="bold" aria-hidden="true" />The assistant is unavailable right now</p>
          <p className="mt-1">You can still do everything yourself. Nothing is lost.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={a.retry} disabled={a.busy}>Try again</Button>
            <Link to="/parent/fas" onClick={closeIfNarrow} className="inline-flex min-h-9 items-center rounded-control border border-line bg-surface-container-lowest px-3 text-[13px] font-semibold text-primary hover:bg-primary-fixed">Fill in the form myself</Link>
          </div>
        </div>
      )}

      <footer className="border-t border-line p-3">
        <form onSubmit={submit} className="flex gap-2">
          <input ref={input} value={text} onChange={(e) => setText(e.target.value)} maxLength={300} disabled={a.down || a.busy} aria-label="Message the assistant" placeholder={a.down ? "Assistant unavailable" : "Ask about the portal"} className={`${inputClass} flex-1 disabled:opacity-60`} />
          <Button type="submit" aria-label="Send" disabled={a.down || a.busy || !text.trim()} icon={<PaperPlaneTilt size={18} weight="bold" aria-hidden="true" />} className="px-3" />
        </form>
        <button type="button" onClick={a.showHuman} className="mt-2 inline-flex min-h-9 items-center gap-1.5 px-1 text-[13px] font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary">
          <Headset size={16} aria-hidden="true" />Talk to a person
        </button>
      </footer>
    </aside>
  );
}

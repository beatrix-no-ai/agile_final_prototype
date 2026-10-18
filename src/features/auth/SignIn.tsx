import { useRef, useState, type KeyboardEvent } from "react";
import { Check, HandHeart, ShieldCheck, Wallet, type Icon } from "@phosphor-icons/react";
import skyline from "../../assets/skyline.webp";
import ParentPanel from "./ParentPanel";
import StaffPanel from "./StaffPanel";

const FEATURES: { icon: Icon; title: string }[] = [
  { icon: Wallet, title: "Education Accounts" },
  { icon: HandHeart, title: "Family FAS applications" },
  { icon: ShieldCheck, title: "Transparent fee records" },
];

const TABS = [
  { id: "parent", label: "Parent or guardian" },
  { id: "staff", label: "School or MOE staff" },
] as const;
type TabId = (typeof TABS)[number]["id"];

const VISIBLE = TABS;

const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

export default function SignIn() {
  const [tab, setTab] = useState<TabId>("staff");
  const refs = useRef<Record<TabId, HTMLButtonElement | null>>({ parent: null, staff: null });

  // Automatic activation: arrow keys move focus and select, Home/End jump to the ends.
  const onKeyDown = (e: KeyboardEvent) => {
    const i = VISIBLE.findIndex((t) => t.id === tab);
    const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: VISIBLE.length - 1 }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    const id = VISIBLE[(next + VISIBLE.length) % VISIBLE.length].id;
    setTab(id);
    refs.current[id]?.focus();
  };

  return (
    <main className="grid min-h-screen bg-surface-container-lowest lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <div className="flex flex-col px-6 py-8 sm:px-12 lg:px-16">
        <p className="flex items-center gap-2 text-sm font-bold text-primary">
          <span className="grid size-8 place-items-center rounded-control bg-primary text-[13px] text-on-primary">M</span>
          MOE Education Account &amp; FAS
        </p>

        <div className="my-auto w-full max-w-sm py-10">
          <h1 className="text-3xl font-bold tracking-tight text-on-surface">Welcome back</h1>
          <p className="mt-2 text-sm text-on-surface-variant">Sign in to manage education accounts, fees and financial assistance.</p>
          <div role="tablist" aria-label="Account type" onKeyDown={onKeyDown} className={`mt-6 grid rounded-control border border-line p-1 ${VISIBLE.length > 1 ? "grid-cols-2" : "hidden"}`}>
            {VISIBLE.map((t) => (
              <button
                key={t.id}
                ref={(el) => {
                  refs.current[t.id] = el;
                }}
                role="tab"
                type="button"
                id={`tab-${t.id}`}
                aria-selected={tab === t.id}
                aria-controls={tab === t.id ? `panel-${t.id}` : undefined}
                tabIndex={tab === t.id ? 0 : -1}
                onClick={() => setTab(t.id)}
                className={`min-h-11 rounded-control px-2 text-sm font-semibold motion-safe:transition-colors ${focus} ${
                  tab === t.id ? "bg-primary text-on-primary" : "text-on-surface-variant hover:bg-primary-fixed hover:text-primary"
                }`}
              >
                {tab === t.id && <Check size={16} weight="bold" aria-hidden="true" className="mr-1.5 inline align-[-2px]" />}
                {t.label}
              </button>
            ))}
          </div>
          <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="mt-6">
            {tab === "parent" ? <ParentPanel /> : <StaffPanel />}
          </div>
        </div>
      </div>

      <section
        style={{ backgroundImage: `url(${skyline})` }}
        className="hidden flex-col items-center border-l border-line bg-surface-container-lowest bg-[length:100%_auto] bg-bottom bg-no-repeat px-12 pt-24 text-center lg:flex"
      >
        <h2 className="max-w-md text-4xl font-bold tracking-tight text-on-surface">Smarter student finances, made simple.</h2>
        <p className="mt-3 max-w-md text-base text-on-surface-variant">
          Transparent grants, easy fee payments and connected accounts for families, schools and the Ministry of Education.
        </p>
        <ul className="mt-5 flex flex-wrap justify-center gap-2">
          {FEATURES.map(({ icon: Icon, title }) => (
            <li key={title} className="flex items-center gap-2 rounded-full border border-line bg-surface-container-lowest px-3 py-1.5 text-[13px] font-medium text-on-surface">
              <Icon size={16} className="text-primary" aria-hidden="true" />
              {title}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

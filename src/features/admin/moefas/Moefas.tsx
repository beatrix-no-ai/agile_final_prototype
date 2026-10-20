import { useEffect, useRef, useState } from "react";
import { CheckCircle, WarningOctagon } from "@phosphor-icons/react";
import { Segmented } from "../../../components/ui/Segmented";
import { useRules, useTiers } from "../../../data/moefas";
import Applications from "./Applications";
import IncomeTiers from "./IncomeTiers";
import Rules from "./Rules";

type Tab = "applications" | "rules" | "tiers";

/** HQ-only MOEFAS: family applications with per-child assessment, and the FAS rules they are assessed against. */
export default function Moefas() {
  const [tab, setTab] = useState<Tab>("applications");
  const [rules, setRules] = useRules();
  const [tiers, setTiers] = useTiers();
  const [msg, setMsg] = useState({ text: "", bad: false });
  const message = msg.text;
  const notify = (text: string, bad = false) => setMsg({ text, bad });
  const msgRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (message) msgRef.current?.focus(); }, [message]);
  const go = (t: Tab) => { setTab(t); notify(""); };

  return (
    <div className="space-y-4">
      <Segmented<Tab> label="MOEFAS sections" value={tab} onChange={go} options={[{ value: "applications", label: "Applications" }, { value: "rules", label: "FAS Rules" }, { value: "tiers", label: "Income tiers" }]} />
      <div ref={msgRef} tabIndex={-1} aria-live="polite" className="outline-none empty:hidden">
        {message && (
          <p className={`flex items-center gap-2 rounded-control border border-line px-3 py-2 text-sm font-medium ${msg.bad ? "bg-error-container text-alert" : "bg-success-container text-success"}`}>
            {msg.bad ? <WarningOctagon size={18} weight="bold" aria-hidden="true" /> : <CheckCircle size={18} weight="bold" aria-hidden="true" />} {message}
          </p>
        )}
      </div>
      {tab === "applications" && <Applications rules={rules} />}
      {tab === "rules" && <Rules rules={rules} setRules={setRules} tiers={tiers} notify={notify} />}
      {/* Stays mounted so unsaved tier edits survive switching tabs. */}
      <div hidden={tab !== "tiers"}><IncomeTiers tiers={tiers} setTiers={setTiers} rules={rules} notify={notify} /></div>
    </div>
  );
}

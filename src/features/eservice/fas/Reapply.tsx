import { useState } from "react";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { Field, inputClass } from "../../../components/ui/Field";
import { useParent } from "../../../data/parentStore";

/**
 * ASSUMPTION (client pending): after the school rejects an SBFAS application the family may ask again —
 * the same right a paper family has walking a new form back to the school. The new request goes to the
 * school's review queue; MOEFAS is not re-assessed.
 */
export function Reapply() {
  const { state, dispatch } = useParent();
  const rejected = state.children.filter((c) => state.outcomes[c.id]?.status === "Not granted");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  if (!rejected.length) return null;

  const submit = () => {
    if (!reason.trim()) { setError("Tell the school what has changed since the rejected application."); return; }
    setError("");
    dispatch({ type: "reapplyFas", reason: reason.trim() });
    setReason("");
  };

  return (
    <Card title="Ask the school again">
      <p className="mb-4 text-sm text-on-surface-variant">
        SBFAS was declined for {rejected.map((c) => c.name).join(", ")}. If your situation has changed, you can submit a
        new request — it goes straight to the school&apos;s review queue with your reason attached.
      </p>
      <Field label="What has changed?" required error={error}>
        <textarea
          rows={3}
          className={`${inputClass} py-2`}
          value={reason}
          onChange={(e) => { setReason(e.target.value); if (error) setError(""); }}
          placeholder="e.g. a parent stopped working in August; rent went up"
        />
      </Field>
      <div className="mt-4 flex justify-end">
        <Button onClick={submit}>Submit a new request</Button>
      </div>
    </Card>
  );
}

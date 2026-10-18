import { useState } from "react";
import { Card } from "../../../components/ui/Card";
import { ProfileCard } from "../overview/ProfileCard";
import { useParent } from "../../../data/parentStore";

export default function Settings() {
  const { state, dispatch } = useParent();
  const [saved, setSaved] = useState(false);
  return (
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <ProfileCard
        profile={state.profile}
        onSave={(form) => { dispatch({ type: "saveProfile", form }); setSaved(true); }}
      />
      <Card title="SingPass identity">
        <p className="text-sm text-on-surface-variant">These details are verified by SingPass and cannot be edited in this portal.</p>
        <dl className="mt-4 space-y-3">
          <div><dt className="text-[13px] text-on-surface-variant">Name</dt><dd className="text-sm font-semibold">{state.profile.name}</dd></div>
          <div><dt className="text-[13px] text-on-surface-variant">NRIC / FIN</dt><dd className="text-sm font-semibold">{state.profile.nric}</dd></div>
        </dl>
        {saved && <p role="status" className="mt-4 text-sm font-medium text-success">Your contact details are up to date.</p>}
      </Card>
    </div>
  );
}

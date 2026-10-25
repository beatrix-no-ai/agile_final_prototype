import { useEffect, useRef, useState, type FormEvent } from "react";
import { CheckCircle, EnvelopeSimple, WarningCircle } from "@phosphor-icons/react";
import { AssumptionTag } from "../../components/ui/AssumptionTag";
import { Button } from "../../components/ui/Button";
import { Field, inputClass } from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import { findStaff, STAFF } from "../../data/users";
import { useSession } from "../../session";

const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

export default function StaffPanel() {
  const { signIn } = useSession();
  const [error, setError] = useState("");
  const [forgot, setForgot] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const fill = (email: string, password: string) => {
    const f = form.current!;
    (f.elements.namedItem("email") as HTMLInputElement).value = email;
    (f.elements.namedItem("password") as HTMLInputElement).value = password;
    setError("");
  };

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const account = findStaff(String(f.get("email")), String(f.get("password")));
    if (account) signIn(account.role, account.email); // /signin redirects a signed-in visitor to their home
    else setError("Email or password is incorrect. Check the details and try again.");
  };

  return (
    <>
      <form ref={form} onSubmit={submit} className="space-y-4">
        {error && (
          <p role="alert" className="flex items-start gap-2 rounded-control border border-alert bg-error-container p-3 text-sm font-medium text-on-error-container">
            <WarningCircle size={18} weight="fill" className="mt-0.5 shrink-0" aria-hidden="true" />
            {error}
          </p>
        )}
        <Field required label="Email address">
          <input name="email" type="email" required autoComplete="username" onChange={() => setError("")} className={inputClass} />
        </Field>
        <Field required label="Password">
          <input name="password" type="password" required autoComplete="current-password" onChange={() => setError("")} className={inputClass} />
        </Field>
        <button type="button" onClick={() => setForgot(true)} className={`-my-2 min-h-11 text-sm font-semibold text-primary underline ${focus}`}>
          Forgot password?
        </button>
        <Button type="submit" className="w-full">Sign in</Button>
      </form>
      <div className="mt-8 border-t border-line pt-5">
        <p className="text-[13px] font-semibold text-on-surface">Demo accounts <span className="font-normal text-on-surface-variant">(click to fill)</span></p>
        <div className="mt-2 grid gap-2">
          {STAFF.filter((s) => s.active).map((s) => (
            <button
              key={s.email}
              type="button"
              onClick={() => fill(s.email, s.password)}
              className={`flex min-h-11 items-center gap-3 rounded-control border border-line px-3 text-left text-sm hover:bg-primary-fixed ${focus}`}
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary-fixed text-xs font-bold text-primary">{s.initials}</span>
              <span>
                <span className="block font-semibold text-on-surface">{s.name}</span>
                <span className="block text-[13px] text-on-surface-variant">{s.title}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
      <ForgotModal open={forgot} onClose={() => setForgot(false)} />
    </>
  );
}

function ForgotModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [sent, setSent] = useState(false);
  // The focused field is replaced by the success message on send; move focus to the way out.
  useEffect(() => {
    if (sent) document.getElementById("forgot-back")?.focus();
  }, [sent]);
  const close = () => {
    onClose();
    setSent(false);
  };
  return (
    <Modal
      open={open}
      onClose={close}
      title="Reset staff password"
      footer={
        sent ? (
          <Button id="forgot-back" onClick={close}>Back to sign in</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={close}>Cancel</Button>
            <Button type="submit" form="forgot-form" icon={<EnvelopeSimple size={18} aria-hidden="true" />}>Send reset link</Button>
          </>
        )
      }
    >
      {sent ? (
        // ASSUMPTION: mock flow; wording avoids confirming whether the address belongs to an account.
        <div role="status" className="space-y-2 text-on-surface">
          <p className="flex items-start gap-2">
            <CheckCircle size={20} weight="fill" className="shrink-0 text-success" aria-hidden="true" />
            If this email exists, a reset link is sent.
          </p>
          <AssumptionTag>mock, no email is sent</AssumptionTag>
        </div>
      ) : (
        <form id="forgot-form" onSubmit={(e) => { e.preventDefault(); setSent(true); }}>
          <Field required label="Institutional email" hint="We will email you a link to set a new password.">
            <input type="email" required autoComplete="email" className={inputClass} />
          </Field>
        </form>
      )}
    </Modal>
  );
}

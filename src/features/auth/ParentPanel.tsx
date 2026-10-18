import { useEffect, useState } from "react";
import { CheckCircle, CircleNotch } from "@phosphor-icons/react";
import { AssumptionTag } from "../../components/ui/AssumptionTag";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { useSession } from "../../session";
import { PARENT } from "../../data/users";

type Step = "qr" | "verifying" | "done";
// ASSUMPTION: step timings are only there to show the three states of the SingPass hand-off.
const DELAY: Record<Step, number> = { qr: 2000, verifying: 1500, done: 1000 };

export default function ParentPanel() {
  const { signIn } = useSession();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("qr");

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      if (step === "qr") setStep("verifying");
      else if (step === "verifying") setStep("done");
      else signIn("parent"); // /signin redirects a signed-in visitor to /parent
    }, DELAY[step]);
    return () => clearTimeout(t);
  }, [open, step, signIn]);

  const close = () => {
    setOpen(false);
    setStep("qr");
  };

  return (
    <>
      <h3 className="text-[15px] font-semibold text-on-surface">Parent or guardian</h3>
      <p className="mt-1 text-sm text-on-surface-variant">Sign in securely with your SingPass to view accounts, pay fees and apply for FAS.</p>
      <div className="mt-4 rounded-control border border-line bg-surface-container-low p-3 text-sm">
        <p className="font-semibold text-on-surface">Demo SingPass account</p>
        <p className="mt-1 text-on-surface-variant">{PARENT.name} · {PARENT.singpassId}</p>
        <p className="text-[13px] text-on-surface-variant">{PARENT.email}</p>
      </div>
      <Button className="mt-5 w-full" onClick={() => setOpen(true)}>
        Log in with SingPass
      </Button>
      <Modal
        open={open}
        onClose={close}
        title="Continue with SingPass"
        footer={step !== "done" && <Button variant="secondary" onClick={close}>Cancel</Button>}
      >
        <div role="status" className="flex flex-col items-center text-center">
          {step === "qr" && (
            <>
              <MockQr />
              <p className="mt-3 text-on-surface">Scan with the SingPass app to continue.</p>
              <span className="mt-2"><AssumptionTag>mock QR</AssumptionTag></span>
            </>
          )}
          {step === "verifying" && (
            <>
              <CircleNotch size={40} className="text-primary motion-safe:animate-spin" aria-hidden="true" />
              <p className="mt-3 font-semibold text-on-surface">Verifying</p>
              <p>Checking your identity with SingPass.</p>
            </>
          )}
          {step === "done" && (
            <>
              <CheckCircle size={40} weight="fill" className="text-success" aria-hidden="true" />
              <p className="mt-3 font-semibold text-on-surface">Authenticated</p>
              <p>Taking you to your overview.</p>
            </>
          )}
        </div>
      </Modal>
    </>
  );
}

/** Decorative stand-in for a QR code: three finder squares plus fixed pseudo-random cells. */
function MockQr() {
  const N = 21;
  const cells: [number, number][] = [];
  let seed = 7;
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const finder = (x < 8 && y < 8) || (x >= N - 8 && y < 8) || (x < 8 && y >= N - 8);
      seed = (seed * 1103515245 + 12345) % 2147483648;
      if (!finder && seed % 100 < 48) cells.push([x, y]);
    }
  const finderAt = (x: number, y: number) => (
    <g key={`${x}${y}`}>
      <rect x={x} y={y} width="7" height="7" />
      <rect x={x + 1} y={y + 1} width="5" height="5" className="fill-surface-container-lowest" />
      <rect x={x + 2} y={y + 2} width="3" height="3" />
    </g>
  );
  return (
    <svg viewBox={`-1 -1 ${N + 2} ${N + 2}`} role="img" aria-label="Mock QR code" className="size-44 rounded-control border border-line bg-surface-container-lowest fill-on-surface">
      {cells.map(([x, y]) => <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" />)}
      {finderAt(0, 0)}
      {finderAt(N - 7, 0)}
      {finderAt(0, N - 7)}
    </svg>
  );
}

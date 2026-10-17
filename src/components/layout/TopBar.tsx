import { useSession, type Role } from "../../session";

const focus =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-on-primary";

/** Reference-portal top bar: burgundy strip with the MOE crest, the portal brand and the signed-in user chip. */
const BRAND: Record<Role, { title: string; sub: string }> = {
  hq: { title: "MOE Admin Portal", sub: "Education Account · fee, top-up & financial assistance administration" },
  school: { title: "MOE Admin Portal", sub: "Education Account · fee, top-up & financial assistance administration" },
  parent: { title: "MOE e-Service Portal", sub: "Education Account · fees, payments & financial assistance" },
};

const ROLE_LABEL: Record<Role, string> = { hq: "MOE HQ User", school: "School User", parent: "Parent" };

export default function TopBar() {
  const { role, user, signOut } = useSession();
  if (!role) return null;
  const brand = BRAND[role];

  return (
    <header className="sticky top-0 z-40 bg-primary text-on-primary">
      <div className="mx-auto flex w-full max-w-[1280px] flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
        <span
          aria-hidden="true"
          className="grid size-9 shrink-0 select-none place-items-center rounded-full bg-surface text-[11px] font-extrabold tracking-wide text-primary"
        >
          MOE
        </span>
        <div className="min-w-[200px] flex-1">
          <p className="text-[15px] font-bold leading-tight">{brand.title}</p>
          <p className="text-xs leading-tight opacity-75">{brand.sub}</p>
        </div>
        <div className="flex items-center gap-2.5 text-[13px]">
          <span
            role="img"
            aria-label={`Signed in as ${user.name}`}
            className="grid size-8 shrink-0 select-none place-items-center rounded-full bg-success text-xs font-bold text-on-primary"
          >
            {user.initials}
          </span>
          <span className="hidden leading-tight sm:block">
            <b className="block">{user.name}</b>
            <span className="opacity-75">{ROLE_LABEL[role]}</span>
          </span>
          <button
            type="button"
            onClick={signOut}
            className={`rounded-md border border-white/40 px-2.5 py-1 text-xs font-semibold hover:bg-white/15 ${focus}`}
          >
            Log out
          </button>
        </div>
      </div>
    </header>
  );
}

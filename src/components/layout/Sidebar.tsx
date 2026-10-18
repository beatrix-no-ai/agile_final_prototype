import { Fragment, useState, type FocusEvent, type MouseEvent } from "react";
import { NavLink } from "react-router";
import { GraduationCap, SidebarSimple, SignOut } from "@phosphor-icons/react";
import { navGroupsFor } from "../../data/nav";
import { useSession } from "../../session";

const focus =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
const row = "relative flex min-h-11 shrink-0 items-center rounded-full motion-safe:transition-colors duration-150";

type Tip = { label: string; top: number };

export default function Sidebar({ pinned, onTogglePin }: { pinned: boolean; onTogglePin(): void }) {
  const { role, signOut, can, canManageUsers } = useSession();
  const [tip, setTip] = useState<Tip | null>(null);
  const groups = role ? navGroupsFor(role, { can, canManageUsers }) : [];

  // Tooltip is position:fixed so the scrolling nav list cannot clip it. Rail only.
  const show = (label: string) => (e: MouseEvent | FocusEvent) => {
    if (pinned) return;
    const r = e.currentTarget.getBoundingClientRect();
    setTip({ label, top: r.top + r.height / 2 });
  };
  const hide = () => setTip(null);
  const tipProps = (label: string) => ({
    onMouseEnter: show(label), onFocus: show(label), onMouseLeave: hide, onBlur: hide,
  });
  const width = pinned ? "w-full" : "w-11";

  return (
    <aside
      className={`sticky top-0 h-screen shrink-0 p-6 pr-0 motion-safe:transition-[width] duration-200 ${pinned ? "w-[256px]" : "w-[108px]"}`}
    >
      <nav
        aria-label="Primary"
        className="flex h-full flex-col overflow-hidden rounded-3xl border border-line bg-surface-container-lowest px-5 py-5"
      >
        <div className={`${row} ${width} mb-4 gap-0`} aria-hidden="true">
          <span className="grid size-11 shrink-0 place-items-center rounded-full border border-line text-primary">
            <GraduationCap size={22} />
          </span>
          {pinned && <span className="truncate pl-0 text-sm font-semibold text-on-surface">MOE Education</span>}
        </div>

        <ul className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overflow-x-hidden">
          {groups.map((g, gi) => (
            <Fragment key={g.group ?? gi}>
              {g.group && (
                pinned
                  ? <li role="presentation" className={`shrink-0 px-2 pb-0.5 text-[11px] font-extrabold uppercase tracking-[0.08em] text-on-surface-variant ${gi ? "pt-3" : ""}`}>{g.group}</li>
                  : gi > 0 && <li role="presentation" aria-hidden="true" className="mx-2 my-1 shrink-0 border-t border-line" />
              )}
              {g.items.map(({ to, label, icon: Icon, badge }) => (
            <li key={label} className="shrink-0">
              <NavLink
                to={to}
                end={to === "/admin" || to === "/parent"}
                title={pinned ? label : undefined}
                aria-label={pinned ? undefined : badge ? `${label}, ${badge}` : label}
                {...tipProps(label)}
                className={({ isActive }) =>
                  `${row} ${width} ${focus} ${
                    isActive
                      ? "bg-primary text-on-primary"
                      : "text-on-surface-variant hover:bg-primary-fixed hover:text-on-primary-fixed"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span className="grid size-11 shrink-0 place-items-center">
                      <Icon size={22} />
                    </span>
                    {pinned && <span className="min-w-0 flex-1 py-1 pr-2 text-sm font-medium leading-tight line-clamp-2 break-words">{label}</span>}
                    {badge !== undefined && (
                      <span
                        className={`grid h-5 min-w-5 place-items-center rounded-full px-1 text-[11px] font-semibold ${
                          pinned ? "mr-3" : "absolute -right-1 -top-1 border border-surface-container-lowest"
                        } ${isActive && pinned ? "bg-on-primary text-primary" : "bg-primary text-on-primary"}`}
                      >
                        {badge}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            </li>
              ))}
            </Fragment>
          ))}
        </ul>

        <div className="mt-4 flex shrink-0 flex-col gap-2">
          <button
            type="button"
            onClick={() => { hide(); onTogglePin(); }}
            aria-pressed={pinned}
            aria-label="Pin sidebar"
            title={pinned ? "Pin sidebar" : undefined}
            {...tipProps("Pin sidebar")}
            className={`${row} ${width} ${focus} text-on-surface-variant hover:bg-primary-fixed hover:text-on-primary-fixed`}
          >
            <span className="grid size-11 shrink-0 place-items-center"><SidebarSimple size={22} /></span>
            {pinned && <span className="truncate pr-2 text-sm font-medium">Pin sidebar</span>}
          </button>
          <button
            type="button"
            onClick={signOut}
            aria-label="Sign out"
            title={pinned ? "Sign out" : undefined}
            {...tipProps("Sign out")}
            className={`${row} ${width} ${focus} border border-line text-primary hover:bg-primary-fixed`}
          >
            <span className="grid size-[42px] shrink-0 place-items-center"><SignOut size={22} /></span>
            {pinned && <span className="truncate pr-2 text-sm font-medium">Sign out</span>}
          </button>
        </div>
      </nav>

      {tip && (
        <span
          role="tooltip"
          style={{ top: tip.top, left: 108 + 8 }}
          className="pointer-events-none fixed z-50 -translate-y-1/2 whitespace-nowrap rounded-control bg-inverse-surface px-3 py-1.5 text-xs font-medium text-inverse-on-surface"
        >
          {tip.label}
        </span>
      )}
    </aside>
  );
}
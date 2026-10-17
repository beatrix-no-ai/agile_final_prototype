type Props = { title: string; subtitle?: string; showFilter?: boolean };

/** Reference-portal page title: the screen name and its subtitle sit at the top of the content column. */
export default function Header({ title, subtitle }: Props) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 pb-5 pt-1">
      <div className="min-w-0">
        <h1 className="text-[22px] font-bold leading-tight tracking-tight text-on-surface">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-on-surface-variant">{subtitle}</p>}
      </div>
      {/* Screens portal their primary action here (HeaderActions), next to the page title. */}
      <div id="header-actions" className="flex items-center gap-3" />
    </header>
  );
}

type Option<T extends string> = { value: T; label: string };
type Props<T extends string> = { label: string; value: T; options: Option<T>[]; onChange: (v: T) => void; size?: "sm" };

/** Two-to-four way switch (aria-pressed buttons). The selected option is a white chip on a grey track. */
export function Segmented<T extends string>({ label, value, options, onChange, size }: Props<T>) {
  return (
    <div role="group" aria-label={label} className="inline-flex flex-wrap gap-1 rounded-control bg-surface-container p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={`${size === "sm" ? "min-h-8 px-3 text-[13px]" : "min-h-9 px-4 text-sm"} rounded-control border font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-safe:transition-colors ${
            value === o.value ? "border-line bg-surface-container-lowest text-primary" : "border-transparent text-on-surface-variant hover:text-primary"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

import { ReactNode } from "react";

type Tone = "neutral" | "positive" | "negative" | "brand" | "info";

interface StatTileProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  delta?: { value: string; positive?: boolean };
  icon?: ReactNode;
  tone?: Tone;
  className?: string;
}

const ICON_TONE: Record<Tone, string> = {
  neutral: "bg-ink-100 text-ink-600",
  positive: "bg-positive-50 text-positive-600",
  negative: "bg-negative-50 text-negative-600",
  brand: "bg-brand-50 text-brand-600",
  info: "bg-info-50 text-info-600",
};

export default function StatTile({
  label,
  value,
  hint,
  delta,
  icon,
  tone = "neutral",
  className = "",
}: StatTileProps) {
  return (
    <div
      className={[
        "bg-white rounded-xl border border-ink-200/70 shadow-xs min-w-0",
        "p-2.5 sm:p-4",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* Mobile: vertical stack */}
      <div className="flex flex-col gap-1.5 sm:hidden">
        {icon && (
          <div
            className={[
              "self-start w-7 h-7 rounded-md flex items-center justify-center [&>svg]:w-3.5 [&>svg]:h-3.5",
              ICON_TONE[tone],
            ].join(" ")}
          >
            {icon}
          </div>
        )}
        <p className="text-[9px] uppercase tracking-wide text-ink-500 font-medium leading-tight truncate">
          {label}
        </p>
        <p className="text-sm font-semibold text-ink-900 tabular-nums truncate leading-none">
          {value}
        </p>
        {hint && (
          <p className="text-[9px] text-ink-400 truncate leading-none">{hint}</p>
        )}
      </div>

      {/* sm+: side-by-side */}
      <div className="hidden sm:flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] uppercase tracking-wide text-ink-500 font-medium">
            {label}
          </p>
          <p className="mt-1 text-xl font-semibold text-ink-900 tabular-nums truncate">
            {value}
          </p>
          {(hint || delta) && (
            <div className="mt-1 flex items-center gap-2 text-xs">
              {delta && (
                <span
                  className={[
                    "font-medium",
                    delta.positive ? "text-positive-600" : "text-negative-600",
                  ].join(" ")}
                >
                  {delta.positive ? "▲" : "▼"} {delta.value}
                </span>
              )}
              {hint && <span className="text-ink-500">{hint}</span>}
            </div>
          )}
        </div>
        {icon && (
          <div
            className={[
              "shrink-0 w-9 h-9 rounded-lg flex items-center justify-center",
              ICON_TONE[tone],
            ].join(" ")}
          >
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}

import { HTMLAttributes, ReactNode } from "react";

type Tone =
  | "neutral"
  | "brand"
  | "positive"
  | "negative"
  | "warning"
  | "info"
  | "muted";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  size?: "sm" | "md";
  dot?: boolean;
  leadingIcon?: ReactNode;
}

const TONE: Record<Tone, string> = {
  neutral: "bg-ink-100 text-ink-700 ring-ink-200",
  brand: "bg-brand-50 text-brand-700 ring-brand-200",
  positive: "bg-positive-50 text-positive-700 ring-positive-100",
  negative: "bg-negative-50 text-negative-700 ring-negative-100",
  warning: "bg-warning-50 text-warning-600 ring-warning-100",
  info: "bg-info-50 text-info-600 ring-info-100",
  muted: "bg-transparent text-ink-500 ring-ink-200",
};

const DOT: Record<Tone, string> = {
  neutral: "bg-ink-400",
  brand: "bg-brand-500",
  positive: "bg-positive-500",
  negative: "bg-negative-500",
  warning: "bg-warning-500",
  info: "bg-info-500",
  muted: "bg-ink-300",
};

export default function Badge({
  tone = "neutral",
  size = "sm",
  dot = false,
  leadingIcon,
  className = "",
  children,
  ...rest
}: BadgeProps) {
  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 font-medium ring-1 ring-inset rounded-full",
        size === "sm" ? "text-[11px] px-2 py-0.5" : "text-xs px-2.5 py-1",
        TONE[tone],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {dot && (
        <span className={`w-1.5 h-1.5 rounded-full ${DOT[tone]}`} aria-hidden />
      )}
      {leadingIcon && <span className="shrink-0">{leadingIcon}</span>}
      {children}
    </span>
  );
}

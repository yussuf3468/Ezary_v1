import { ButtonHTMLAttributes, forwardRef, ReactNode } from "react";
import { Loader2 } from "lucide-react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type Size = "xs" | "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  block?: boolean;
}

const VARIANT: Record<Variant, string> = {
  primary:
    "bg-brand-600 text-white border border-brand-600 hover:bg-brand-700 hover:border-brand-700 shadow-sm",
  secondary:
    "bg-ink-100 text-ink-800 border border-ink-200 hover:bg-ink-200/70 hover:border-ink-300",
  ghost:
    "bg-transparent text-ink-700 border border-transparent hover:bg-ink-100",
  danger:
    "bg-negative-600 text-white border border-negative-600 hover:bg-negative-700 hover:border-negative-700 shadow-sm",
  outline:
    "bg-white text-ink-700 border border-ink-200 hover:border-ink-300 hover:bg-ink-50 shadow-xs",
};

const SIZE: Record<Size, string> = {
  xs: "h-7 px-2.5 text-xs gap-1.5 rounded-md",
  sm: "h-8 px-3 text-xs gap-1.5 rounded-md",
  md: "h-9 px-3.5 text-sm gap-2 rounded-lg",
  lg: "h-11 px-5 text-sm gap-2 rounded-lg",
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "secondary",
    size = "md",
    loading = false,
    leadingIcon,
    trailingIcon,
    block = false,
    className = "",
    children,
    disabled,
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={[
        "inline-flex items-center justify-center font-medium",
        "transition-colors duration-150 press",
        "focus-ring",
        "disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none",
        VARIANT[variant],
        SIZE[size],
        block ? "w-full" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        leadingIcon && <span className="shrink-0">{leadingIcon}</span>
      )}
      {children && <span className="truncate">{children}</span>}
      {!loading && trailingIcon && (
        <span className="shrink-0">{trailingIcon}</span>
      )}
    </button>
  );
});

export default Button;

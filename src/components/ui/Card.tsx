import { HTMLAttributes, ReactNode, forwardRef } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "raised" | "subtle";
  padded?: boolean;
  interactive?: boolean;
}

const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  {
    variant = "default",
    padded = false,
    interactive = false,
    className = "",
    children,
    ...rest
  },
  ref,
) {
  const base = "bg-white rounded-xl border border-ink-200/70";
  const elevation =
    variant === "raised"
      ? "shadow-sm"
      : variant === "subtle"
        ? "shadow-xs"
        : "shadow-xs";
  const inter = interactive
    ? "transition-all duration-150 hover:border-ink-300 hover:shadow-sm cursor-pointer"
    : "";
  return (
    <div
      ref={ref}
      className={[
        base,
        elevation,
        inter,
        padded ? "p-4 sm:p-5" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {children}
    </div>
  );
});

export function CardHeader({
  title,
  description,
  action,
  className = "",
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={[
        "flex items-start justify-between gap-3 px-4 sm:px-5 py-3.5 border-b border-ink-100",
        className,
      ].join(" ")}
    >
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-ink-900 tracking-tight">
          {title}
        </h3>
        {description && (
          <p className="text-xs text-ink-500 mt-0.5">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function CardBody({
  className = "",
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={["p-4 sm:p-5", className].join(" ")}>{children}</div>;
}

export default Card;

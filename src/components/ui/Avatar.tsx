interface AvatarProps {
  name: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  status?: "active" | "inactive" | null;
  className?: string;
}

const SIZE = {
  xs: "w-6 h-6 text-[10px]",
  sm: "w-8 h-8 text-xs",
  md: "w-10 h-10 text-sm",
  lg: "w-12 h-12 text-base",
  xl: "w-16 h-16 text-xl",
};

// Deterministic palette so a client always has the same color across screens
const PALETTE = [
  "bg-brand-100 text-brand-700",
  "bg-info-50 text-info-600",
  "bg-warning-50 text-warning-600",
  "bg-positive-50 text-positive-700",
  "bg-rose-50 text-rose-700",
  "bg-violet-50 text-violet-700",
  "bg-amber-50 text-amber-700",
  "bg-cyan-50 text-cyan-700",
];

function hashName(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) >>> 0;
  }
  return h % PALETTE.length;
}

export default function Avatar({
  name,
  size = "md",
  status,
  className = "",
}: AvatarProps) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s.charAt(0).toUpperCase())
    .join("");
  const palette = status === "inactive" ? "bg-ink-100 text-ink-500" : PALETTE[hashName(name)];

  return (
    <div className={["relative shrink-0", className].join(" ")}>
      <div
        className={[
          "rounded-full flex items-center justify-center font-semibold tracking-tight",
          SIZE[size],
          palette,
        ].join(" ")}
        aria-hidden
      >
        {initials || "?"}
      </div>
      {status && (
        <span
          className={[
            "absolute -bottom-0.5 -right-0.5 rounded-full ring-2 ring-white",
            size === "xs" || size === "sm" ? "w-2 h-2" : "w-2.5 h-2.5",
            status === "active" ? "bg-positive-500" : "bg-ink-300",
          ].join(" ")}
          aria-label={status}
        />
      )}
    </div>
  );
}

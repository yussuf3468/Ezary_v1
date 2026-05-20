import { SelectHTMLAttributes, forwardRef, ReactNode } from "react";
import { ChevronDown } from "lucide-react";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
  error?: string;
  leadingIcon?: ReactNode;
  inputSize?: "sm" | "md" | "lg";
}

const SIZE = {
  sm: "h-8 text-xs",
  md: "h-9 text-sm",
  lg: "h-11 text-sm",
};

const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  {
    label,
    hint,
    error,
    leadingIcon,
    inputSize = "md",
    className = "",
    id,
    required,
    children,
    ...rest
  },
  ref,
) {
  const reactId = id || rest.name;
  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={reactId}
          className="block text-xs font-medium text-ink-700 mb-1.5"
        >
          {label}
          {required && <span className="text-negative-600 ml-0.5">*</span>}
        </label>
      )}
      <div className="relative">
        {leadingIcon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none">
            {leadingIcon}
          </div>
        )}
        <select
          ref={ref}
          id={reactId}
          required={required}
          className={[
            "w-full bg-white text-ink-900 appearance-none",
            "border border-ink-200 rounded-lg",
            "transition-shadow duration-150",
            "focus:outline-none focus:border-brand-500 focus:shadow-focus",
            "disabled:bg-ink-50 disabled:text-ink-400",
            error
              ? "border-negative-500 focus:border-negative-500 focus:shadow-focus-danger"
              : "",
            leadingIcon ? "pl-9" : "pl-3",
            "pr-9",
            SIZE[inputSize],
            className,
          ]
            .filter(Boolean)
            .join(" ")}
          {...rest}
        >
          {children}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400 pointer-events-none" />
      </div>
      {(hint || error) && (
        <p
          className={[
            "mt-1.5 text-xs",
            error ? "text-negative-600" : "text-ink-500",
          ].join(" ")}
        >
          {error || hint}
        </p>
      )}
    </div>
  );
});

export default Select;

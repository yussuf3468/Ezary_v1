import { InputHTMLAttributes, forwardRef, ReactNode } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  inputSize?: "sm" | "md" | "lg";
}

const SIZE = {
  sm: "h-8 text-xs",
  md: "h-9 text-sm",
  lg: "h-11 text-sm",
};

const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    label,
    hint,
    error,
    leadingIcon,
    trailingIcon,
    inputSize = "md",
    className = "",
    id,
    required,
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
        <input
          ref={ref}
          id={reactId}
          required={required}
          className={[
            "w-full bg-white text-ink-900 placeholder:text-ink-400",
            "border border-ink-200 rounded-lg",
            "transition-shadow duration-150",
            "focus:outline-none focus:border-brand-500 focus:shadow-focus",
            "disabled:bg-ink-50 disabled:text-ink-400 disabled:cursor-not-allowed",
            error
              ? "border-negative-500 focus:border-negative-500 focus:shadow-focus-danger"
              : "",
            leadingIcon ? "pl-9" : "pl-3",
            trailingIcon ? "pr-9" : "pr-3",
            SIZE[inputSize],
            className,
          ]
            .filter(Boolean)
            .join(" ")}
          {...rest}
        />
        {trailingIcon && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400">
            {trailingIcon}
          </div>
        )}
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

export default Input;

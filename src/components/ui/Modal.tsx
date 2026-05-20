import { ReactNode, useEffect, memo } from "react";
import { X } from "lucide-react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  tone?: "default" | "danger" | "warning";
  footer?: ReactNode;
  closeOnBackdrop?: boolean;
}

const SIZE = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

const Modal = memo(function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  size = "md",
  tone = "default",
  footer,
  closeOnBackdrop = true,
}: ModalProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const headerAccent =
    tone === "danger"
      ? "border-l-4 border-l-negative-500"
      : tone === "warning"
        ? "border-l-4 border-l-warning-500"
        : "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div
        className="absolute inset-0 bg-ink-900/40 backdrop-blur-[2px]"
        onClick={closeOnBackdrop ? onClose : undefined}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={[
          "relative w-full bg-white rounded-2xl shadow-xl border border-ink-200/60",
          "max-h-[90vh] flex flex-col overflow-hidden",
          "animate-scale-in",
          SIZE[size],
        ].join(" ")}
      >
        <div
          className={[
            "flex items-start justify-between gap-4 px-5 sm:px-6 py-4 border-b border-ink-100",
            headerAccent,
          ].join(" ")}
        >
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-ink-900 tracking-tight">
              {title}
            </h2>
            {description && (
              <p className="mt-0.5 text-xs text-ink-500">{description}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="shrink-0 -mr-1.5 -mt-0.5 p-1.5 rounded-md text-ink-400 hover:bg-ink-100 hover:text-ink-700 transition-colors press focus-ring"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 sm:px-6 py-5 overflow-y-auto flex-1">{children}</div>
        {footer && (
          <div className="px-5 sm:px-6 py-3.5 border-t border-ink-100 bg-ink-50/50 flex items-center justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
});

export default Modal;

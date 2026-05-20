import { useEffect, useState } from "react";
import { WifiOff, RefreshCw, CheckCircle, AlertCircle } from "lucide-react";
import { syncManager, SyncStatus } from "../lib/syncManager";

type ToneClasses = {
  bg: string;
  border: string;
  iconText: string;
  title: string;
  subtitle: string;
};

const TONES: Record<"negative" | "warning" | "info" | "positive", ToneClasses> =
  {
    negative: {
      bg: "bg-white",
      border: "border-negative-100",
      iconText: "text-negative-600",
      title: "text-ink-900",
      subtitle: "text-ink-600",
    },
    warning: {
      bg: "bg-white",
      border: "border-warning-100",
      iconText: "text-warning-600",
      title: "text-ink-900",
      subtitle: "text-ink-600",
    },
    info: {
      bg: "bg-white",
      border: "border-info-100",
      iconText: "text-info-600",
      title: "text-ink-900",
      subtitle: "text-ink-600",
    },
    positive: {
      bg: "bg-white",
      border: "border-positive-100",
      iconText: "text-positive-600",
      title: "text-ink-900",
      subtitle: "text-ink-600",
    },
  };

function Pill({
  tone,
  icon,
  title,
  subtitle,
  action,
  onClick,
  disabled,
  ariaLabel,
}: {
  tone: keyof typeof TONES;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  action?: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  const t = TONES[tone];
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={[
        "w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl border shadow-sm",
        t.bg,
        t.border,
        onClick
          ? "transition-colors hover:bg-ink-50 disabled:opacity-50 disabled:cursor-not-allowed"
          : "",
      ].join(" ")}
    >
      <span className={`shrink-0 ${t.iconText}`}>{icon}</span>
      <div className="min-w-0 text-left">
        <p className={`text-xs font-medium ${t.title}`}>{title}</p>
        <p className={`text-[11px] ${t.subtitle}`}>{subtitle}</p>
      </div>
      {action && <div className="ml-auto shrink-0">{action}</div>}
    </Tag>
  );
}

export default function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    type: "idle",
    pending: 0,
  });
  const [showSyncSuccess, setShowSyncSuccess] = useState(false);

  useEffect(() => {
    syncManager.getPendingCount().then((count) => {
      setSyncStatus({ type: "idle", pending: count });
    });

    const handleOnline = () => {
      setIsOnline(true);
      syncManager.syncPendingTransactions().then((result) => {
        if (result.success && result.synced && result.synced > 0) {
          setShowSyncSuccess(true);
          setTimeout(() => setShowSyncSuccess(false), 3000);
        }
      });
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    const unsubscribe = syncManager.onSyncStatusChange((status) => {
      setSyncStatus(status);
    });

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      unsubscribe();
    };
  }, []);

  const handleManualSync = async () => {
    const result = await syncManager.syncPendingTransactions();
    if (result.success && result.synced && result.synced > 0) {
      setShowSyncSuccess(true);
      setTimeout(() => setShowSyncSuccess(false), 3000);
    }
  };

  if (isOnline && syncStatus.pending === 0 && syncStatus.type === "idle") {
    return null;
  }

  return (
    <div className="fixed bottom-20 md:bottom-4 left-3 z-[9999] flex flex-col gap-2 max-w-[280px]">
      {!isOnline && (
        <Pill
          tone="negative"
          icon={<WifiOff className="w-4 h-4" />}
          title="Offline mode"
          subtitle="Changes will sync when you reconnect"
        />
      )}

      {syncStatus.pending > 0 && syncStatus.type !== "syncing" && (
        <Pill
          tone="warning"
          icon={<AlertCircle className="w-4 h-4" />}
          title={`${syncStatus.pending} pending change${syncStatus.pending !== 1 ? "s" : ""}`}
          subtitle={isOnline ? "Click to sync now" : "Waiting for connection"}
          action={isOnline ? <RefreshCw className="w-3.5 h-3.5 text-ink-400" /> : undefined}
          onClick={handleManualSync}
          disabled={!isOnline}
          ariaLabel="Sync pending changes"
        />
      )}

      {syncStatus.type === "syncing" && (
        <Pill
          tone="info"
          icon={<RefreshCw className="w-4 h-4 animate-spin" />}
          title="Syncing…"
          subtitle={
            syncStatus.pending > 0
              ? `${syncStatus.pending} remaining`
              : "Almost done"
          }
        />
      )}

      {showSyncSuccess && (
        <Pill
          tone="positive"
          icon={<CheckCircle className="w-4 h-4" />}
          title="Synced successfully"
          subtitle="All changes saved"
        />
      )}

      {syncStatus.type === "error" && (
        <Pill
          tone="negative"
          icon={<AlertCircle className="w-4 h-4" />}
          title="Sync failed"
          subtitle="Will retry automatically"
        />
      )}
    </div>
  );
}

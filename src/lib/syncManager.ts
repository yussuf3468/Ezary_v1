import { supabase } from "./supabase";
import { offlineDB, PendingTransaction } from "./offlineDB";
import { toast } from "react-toastify";

class SyncManager {
  private isSyncing = false;
  private syncCallbacks: Array<(status: SyncStatus) => void> = [];
  private hasShownOfflineNotice = false;

  constructor() {
    // Listen for online/offline events
    window.addEventListener("online", () => {
      toast.success("🌐 Back online! Syncing your changes...");
      this.syncPendingTransactions();
    });

    window.addEventListener("offline", () => {
      toast.warning(
        "📴 You're offline. Changes will be saved locally and synced when you reconnect.",
        { autoClose: 5000 }
      );
    });
  }

  async syncPendingTransactions(): Promise<SyncResult> {
    if (this.isSyncing) {
      return { success: false, message: "Sync already in progress" };
    }

    this.isSyncing = true;
    this.notifyCallbacks({ type: "syncing", pending: 0 });

    try {
      const pending = await offlineDB.getPendingTransactions();

      if (pending.length === 0) {
        this.isSyncing = false;
        this.notifyCallbacks({ type: "idle", pending: 0 });
        return { success: true, synced: 0, failed: 0 };
      }

      toast.info(`🔄 Syncing ${pending.length} pending change${pending.length > 1 ? 's' : ''}...`);

      let synced = 0;
      let failed = 0;

      for (const transaction of pending) {
        try {
          await this.syncTransaction(transaction);
          await offlineDB.deletePendingTransaction(transaction.id);
          synced++;
        } catch (error) {
          console.error("Sync failed:", error);
          await offlineDB.updateTransactionStatus(
            transaction.id,
            "failed",
            error instanceof Error ? error.message : "Unknown error"
          );
          failed++;
        }

        this.notifyCallbacks({
          type: "syncing",
          pending: pending.length - synced - failed,
        });
      }

      this.isSyncing = false;
      this.notifyCallbacks({ type: "idle", pending: 0 });

      if (synced > 0) {
        toast.success(
          `✅ Synced ${synced} change${synced > 1 ? "s" : ""} successfully!`
        );
      }
      
      if (failed > 0) {
        toast.error(
          `❌ Failed to sync ${failed} change${failed > 1 ? "s" : ""}. Will retry later.`
        );
      }

      return {
        success: true,
        synced,
        failed,
        message: `Synced ${synced} transactions${
          failed > 0 ? `, ${failed} failed` : ""
        }`,
      };
    } catch (error) {
      this.isSyncing = false;
      this.notifyCallbacks({ type: "error", pending: 0 });
      toast.error("Failed to sync changes. Will retry when possible.");
      return {
        success: false,
        message: error instanceof Error ? error.message : "Sync failed",
      };
    }
  }

  showOfflineNotice() {
    if (!navigator.onLine && !this.hasShownOfflineNotice) {
      toast.info(
        "💾 Changes saved locally. Will sync when you're back online.",
        { autoClose: 3000 }
      );
      this.hasShownOfflineNotice = true;
      setTimeout(() => {
        this.hasShownOfflineNotice = false;
      }, 10000);
    }
  }

  private async syncTransaction(
    transaction: PendingTransaction
  ): Promise<void> {
    switch (transaction.type) {
      case "insert":
        const { error: insertError } = await supabase
          .from(transaction.table)
          .insert(transaction.data);
        if (insertError) throw insertError;
        break;

      case "update":
        const { error: updateError } = await supabase
          .from(transaction.table)
          .update(transaction.data)
          .eq("id", transaction.data.id);
        if (updateError) throw updateError;
        break;

      case "delete":
        const { error: deleteError } = await supabase
          .from(transaction.table)
          .delete()
          .eq("id", transaction.data.id);
        if (deleteError) throw deleteError;
        break;
    }
  }

  onSyncStatusChange(callback: (status: SyncStatus) => void): () => void {
    this.syncCallbacks.push(callback);
    return () => {
      this.syncCallbacks = this.syncCallbacks.filter((cb) => cb !== callback);
    };
  }

  private notifyCallbacks(status: SyncStatus): void {
    this.syncCallbacks.forEach((callback) => callback(status));
  }

  async getPendingCount(): Promise<number> {
    return offlineDB.getPendingCount();
  }
}

export interface SyncStatus {
  type: "idle" | "syncing" | "error";
  pending: number;
}

export interface SyncResult {
  success: boolean;
  synced?: number;
  failed?: number;
  message?: string;
}

export const syncManager = new SyncManager();

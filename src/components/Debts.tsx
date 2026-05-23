import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { toast } from "react-toastify";
import {
  Plus,
  Search,
  Trash2,
  AlertCircle,
  Calendar,
  DollarSign,
  TrendingUp,
  CheckCircle2,
  Wallet,
  Phone,
  Clock,
} from "lucide-react";
import { formatCurrency } from "../lib/currency";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Modal,
  Select,
  StatTile,
} from "./ui";

interface DebtWithClient {
  id: string;
  client_id: string;
  client_name: string;
  client_code: string;
  phone: string;
  amount: number;
  amount_paid?: number;
  currency: "KES" | "USD";
  balance: number;
  description: string;
  reference_number: string;
  debt_date: string;
  due_date: string;
  paid_date?: string | null;
  status: "pending" | "overdue" | "paid" | "cancelled";
  priority: "low" | "normal" | "high" | "urgent";
  notes: string;
  created_at: string;
}

interface Stats {
  overdue: number;
  pending: number;
  paid: number;
  totalBalance: number;
}

// Deterministic avatar palette per debtor name (matches ClientList card)
const AVATAR_BGS = [
  "bg-rose-500",
  "bg-amber-500",
  "bg-emerald-500",
  "bg-sky-500",
  "bg-violet-500",
  "bg-fuchsia-500",
  "bg-cyan-500",
  "bg-orange-500",
  "bg-teal-500",
  "bg-indigo-500",
];

function hashName(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function Debts() {
  const [debts, setDebts] = useState<DebtWithClient[]>([]);
  const [filteredDebts, setFilteredDebts] = useState<DebtWithClient[]>([]);
  const [stats, setStats] = useState<Stats>({
    overdue: 0,
    pending: 0,
    paid: 0,
    totalBalance: 0,
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"active" | "history">("active");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedDebt, setSelectedDebt] = useState<DebtWithClient | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [showAddMoreDebt, setShowAddMoreDebt] = useState(false);
  const [addMoreAmount, setAddMoreAmount] = useState("");
  const [addMoreReason, setAddMoreReason] = useState("");
  const [loading, setLoading] = useState(true);

  const [newDebt, setNewDebt] = useState({
    amount: "",
    currency: "KES" as "KES" | "USD",
    description: "",
    debt_date: "",
    due_date: "",
    clientName: "",
    clientPhone: "",
    reference_number: "",
    priority: "normal" as "low" | "normal" | "high" | "urgent",
  });

  useEffect(() => {
    window.scrollTo(0, 0);
    loadDebts();
  }, []);

  useEffect(() => {
    filterDebts();
  }, [debts, searchTerm, statusFilter, viewMode]);

  async function loadDebts() {
    try {
      const { data, error } = await supabase
        .from("client_debts")
        .select(
          "id, debtor_name, debtor_phone, amount, amount_paid, currency, balance, description, reference_number, notes, debt_date, due_date, paid_date, status, priority, created_at",
        )
        .order("due_date", { ascending: true });

      if (error) throw error;

      const debtsWithClients = (data || []).map((debt: any) => {
        const dueDate = new Date(debt.due_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        dueDate.setHours(0, 0, 0, 0);

        const calculatedBalance = debt.amount - (debt.amount_paid || 0);
        const status =
          debt.status !== "paid" && dueDate < today ? "overdue" : debt.status;

        return {
          ...debt,
          balance: calculatedBalance,
          status,
          client_name: debt.debtor_name || "Unknown",
          client_code: "",
          phone: debt.debtor_phone || "",
        };
      });

      setDebts(debtsWithClients);
      calculateStats(debtsWithClients);
    } catch (error: any) {
      console.error("Error loading debts:", error.message);
    } finally {
      setLoading(false);
    }
  }

  function calculateStats(debtsData: DebtWithClient[]) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const overdue = debtsData.filter((d) => {
      if (d.status === "paid" || d.status === "cancelled") return false;
      const dueDate = new Date(d.due_date);
      dueDate.setHours(0, 0, 0, 0);
      return d.status === "overdue" || dueDate < today;
    }).length;

    const pending = debtsData.filter((d) => {
      if (d.status === "paid" || d.status === "cancelled") return false;
      const dueDate = new Date(d.due_date);
      dueDate.setHours(0, 0, 0, 0);
      return d.status === "pending" && dueDate >= today;
    }).length;

    const paid = debtsData.filter((d) => d.status === "paid").length;
    const totalBalance = debtsData
      .filter((d) => d.status !== "paid" && d.status !== "cancelled")
      .reduce((sum, d) => sum + d.balance, 0);

    setStats({ overdue, pending, paid, totalBalance });
  }

  const filterDebts = useCallback(() => {
    let filtered = debts;

    if (viewMode === "active") {
      filtered = filtered.filter(
        (d) => d.status !== "paid" && d.status !== "cancelled",
      );
    } else {
      filtered = filtered.filter((d) => d.status === "paid");
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter((d) => d.status === statusFilter);
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (d) =>
          (d.client_name || "").toLowerCase().includes(term) ||
          (d.client_code || "").toLowerCase().includes(term) ||
          (d.description || "").toLowerCase().includes(term),
      );
    }

    setFilteredDebts(filtered);
  }, [debts, searchTerm, statusFilter, viewMode]);

  function getDaysUntilDue(dueDate: string): number {
    const today = new Date();
    const due = new Date(dueDate);
    const diffTime = due.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  function getStatusTone(
    status: string,
  ): "positive" | "negative" | "warning" | "muted" | "info" {
    switch (status) {
      case "overdue":
        return "negative";
      case "pending":
        return "warning";
      case "paid":
        return "positive";
      case "cancelled":
        return "muted";
      default:
        return "muted";
    }
  }

  function parseDebtHistory(description: string | null | undefined) {
    if (!description) return [];
    const lines = description
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    const entries = lines
      .filter((l) => l.startsWith("["))
      .map((line) => {
        const m = line.match(/^\[([^\]]+)\]\s*Added\s+(.+?)(?:\s*:\s*(.*))?$/i);
        if (m) {
          return {
            date: m[1],
            amount: m[2],
            note: m[3] || "",
            raw: line,
          };
        } else {
          return { date: "", amount: "", note: line, raw: line };
        }
      });

    return entries;
  }

  function getInitialDescription(description: string | null | undefined) {
    if (!description) return "";
    const lines = description
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    const initialLines = lines.filter((l) => !l.startsWith("["));
    return initialLines.join("\n");
  }

  async function handleAddDebt(e: React.FormEvent) {
    e.preventDefault();
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { error: debtError } = await supabase.from("client_debts").insert([
        {
          user_id: user.id,
          debtor_name: newDebt.clientName,
          debtor_phone: newDebt.clientPhone,
          amount: parseFloat(newDebt.amount),
          currency: newDebt.currency,
          description: newDebt.description,
          reference_number: newDebt.reference_number || null,
          debt_date: newDebt.debt_date || new Date().toLocaleDateString("en-CA"),
          due_date: newDebt.due_date,
          priority: newDebt.priority,
          status: "pending",
        },
      ]);

      if (debtError) {
        toast.error("Failed to create debt: " + debtError.message);
        return;
      }

      setShowAddModal(false);
      setNewDebt({
        amount: "",
        currency: "KES",
        description: "",
        debt_date: "",
        due_date: "",
        clientName: "",
        clientPhone: "",
        reference_number: "",
        priority: "normal",
      });
      await loadDebts();
      toast.success("Debt created successfully!");
    } catch (error: any) {
      console.error("Unexpected error:", error);
      toast.error("An unexpected error occurred: " + error.message);
    }
  }

  function handleViewDebt(debt: DebtWithClient) {
    setSelectedDebt(debt);
    setPaymentAmount("");
    setShowViewModal(true);
  }

  async function handleRecordPayment() {
    if (!selectedDebt || !paymentAmount) return;

    const amount = parseFloat(paymentAmount);
    if (amount <= 0 || amount > selectedDebt.balance) {
      toast.error("Invalid payment amount");
      return;
    }

    try {
      const newBalance = selectedDebt.balance - amount;
      const newStatus = newBalance === 0 ? "paid" : selectedDebt.status;

      const { error } = await supabase
        .from("client_debts")
        .update({
          amount_paid: (selectedDebt.amount_paid || 0) + amount,
          status: newStatus,
          paid_date:
            newBalance === 0
              ? new Date().toLocaleDateString("en-CA")
              : null,
        })
        .eq("id", selectedDebt.id);

      if (error) throw error;

      toast.success("Payment recorded successfully!");
      setShowViewModal(false);
      setPaymentAmount("");
      await loadDebts();

      if (newStatus === "paid") {
        setViewMode("history");
      }
    } catch (error: any) {
      toast.error("Failed to record payment: " + error.message);
    }
  }

  async function handleDeleteDebt(id: string) {
    if (!confirm("Are you sure you want to delete this debt?")) return;

    try {
      const { error } = await supabase
        .from("client_debts")
        .delete()
        .eq("id", id);

      if (error) throw error;
      loadDebts();
      toast.success("Debt deleted successfully!");
    } catch (error: any) {
      toast.error("Error deleting debt: " + error.message);
    }
  }

  async function handleAddMoreDebt() {
    if (!selectedDebt || !addMoreAmount) return;

    const additionalAmount = parseFloat(addMoreAmount);
    if (isNaN(additionalAmount) || additionalAmount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    try {
      const newAmount = selectedDebt.amount + additionalAmount;
      const today = new Date().toLocaleDateString();
      const additionNote = `\n[${today}] Added ${formatCurrency(
        additionalAmount,
        selectedDebt.currency,
      )}${addMoreReason ? `: ${addMoreReason}` : ""}`;
      const updatedDescription = selectedDebt.description
        ? selectedDebt.description + additionNote
        : additionNote;

      const { error } = await supabase
        .from("client_debts")
        .update({
          amount: newAmount,
          description: updatedDescription,
        })
        .eq("id", selectedDebt.id);

      if (error) throw error;

      toast.success(
        `Added ${formatCurrency(
          additionalAmount,
          selectedDebt.currency,
        )} to debt!`,
      );
      setShowAddMoreDebt(false);
      setAddMoreAmount("");
      setAddMoreReason("");
      setSelectedDebt(null);
      await loadDebts();
    } catch (error: any) {
      toast.error("Failed to add to debt: " + error.message);
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 skeleton rounded-xl" />
          ))}
        </div>
        <div className="h-12 skeleton rounded-xl" />
        <div className="h-96 skeleton rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
        <StatTile
          label="Overdue"
          value={stats.overdue}
          icon={<AlertCircle className="w-4 h-4" />}
          tone="negative"
        />
        <StatTile
          label="Pending"
          value={stats.pending}
          icon={<Calendar className="w-4 h-4" />}
          tone="info"
        />
        <StatTile
          label="Paid"
          value={stats.paid}
          icon={<CheckCircle2 className="w-4 h-4" />}
          tone="positive"
        />
        <StatTile
          label="Outstanding"
          value={formatCurrency(stats.totalBalance, "KES")}
          icon={<Wallet className="w-4 h-4" />}
          tone="brand"
        />
      </div>

      {/* Toolbar */}
      <Card className="p-3 sm:p-4">
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {/* Active / History segmented toggle */}
          <div className="inline-flex items-center bg-ink-100 rounded-lg p-0.5 shrink-0">
            {(["active", "history"] as const).map((v) => {
              const active = viewMode === v;
              return (
                <button
                  key={v}
                  onClick={() => setViewMode(v)}
                  className={[
                    "h-8 px-3 inline-flex items-center rounded-md text-xs font-medium capitalize transition-colors focus-ring",
                    active
                      ? "bg-white text-brand-700 shadow-xs font-semibold"
                      : "text-ink-500 hover:text-ink-700",
                  ].join(" ")}
                  aria-pressed={active}
                >
                  {v}
                </button>
              );
            })}
          </div>

          {/* Search — stretches to fill available space */}
          <div className="flex-1 min-w-[160px]">
            <Input
              leadingIcon={<Search className="w-4 h-4" />}
              placeholder={
                viewMode === "active"
                  ? "Search active debts…"
                  : "Search paid debts…"
              }
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              inputSize="md"
            />
          </div>

          {/* Status filter */}
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            inputSize="md"
            className="shrink-0 min-w-[110px]"
          >
            <option value="all">All status</option>
            <option value="overdue">Overdue</option>
            <option value="pending">Pending</option>
            <option value="paid">Paid</option>
          </Select>

          {/* Add Debt */}
          <Button
            variant="primary"
            size="md"
            leadingIcon={<Plus className="w-4 h-4" />}
            onClick={() => setShowAddModal(true)}
            className="shrink-0"
          >
            <span className="hidden sm:inline">Add debt</span>
            <span className="sm:hidden">Add</span>
          </Button>
        </div>
      </Card>

      {/* Debt cards grid */}
      {filteredDebts.length === 0 ? (
        <Card>
          <EmptyState
            title={
              viewMode === "active"
                ? "No active debts"
                : "No debt history yet"
            }
            description={
              viewMode === "active"
                ? "When you record a debt it will appear here. Tap “Add debt” to create one."
                : "Settled debts will appear here once a payment clears the balance."
            }
            action={
              viewMode === "active" ? (
                <Button
                  variant="primary"
                  leadingIcon={<Plus className="w-4 h-4" />}
                  onClick={() => setShowAddModal(true)}
                >
                  Add debt
                </Button>
              ) : null
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
          {filteredDebts.map((debt) => {
            const days = getDaysUntilDue(debt.due_date);
            const tone = getStatusTone(debt.status);
            const isOverdue = debt.status === "overdue" || days < 0;
            const avatarBg = AVATAR_BGS[hashName(debt.client_name) % AVATAR_BGS.length];
            const progress =
              debt.amount > 0
                ? Math.min(
                    100,
                    Math.max(
                      0,
                      ((debt.amount - debt.balance) / debt.amount) * 100,
                    ),
                  )
                : 0;

            return (
              <div
                key={debt.id}
                role="button"
                tabIndex={0}
                onClick={() => handleViewDebt(debt)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleViewDebt(debt);
                  }
                }}
                className={[
                  "group relative cursor-pointer bg-white rounded-2xl border-2 shadow-xs transition-all duration-200 ease-out",
                  "hover:shadow-lg hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-1",
                  isOverdue
                    ? "border-negative-200 hover:border-negative-400"
                    : debt.status === "paid"
                      ? "border-positive-200 hover:border-positive-400"
                      : "border-brand-100 hover:border-brand-300",
                ].join(" ")}
              >
                {/* Top: avatar + name + status */}
                <div className="p-3 sm:p-4 flex items-start gap-3">
                  <div
                    className={[
                      "shrink-0 w-11 h-11 rounded-xl text-white font-bold text-sm flex items-center justify-center shadow-sm",
                      avatarBg,
                    ].join(" ")}
                  >
                    {getInitials(debt.client_name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-semibold text-ink-900 truncate">
                        {debt.client_name}
                      </h3>
                      <Badge tone={tone} size="sm" dot>
                        {debt.status}
                      </Badge>
                    </div>
                    {debt.phone && (
                      <p className="mt-0.5 text-[11px] text-ink-500 inline-flex items-center gap-1 truncate">
                        <Phone className="w-3 h-3 shrink-0" />
                        {debt.phone}
                      </p>
                    )}
                  </div>
                </div>

                {/* Balance display */}
                <div className="px-3 sm:px-4 pb-2.5">
                  <div
                    className={[
                      "rounded-xl p-2.5 border",
                      isOverdue
                        ? "bg-negative-50 border-negative-100"
                        : debt.status === "paid"
                          ? "bg-positive-50 border-positive-100"
                          : "bg-brand-50 border-brand-100",
                    ].join(" ")}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] uppercase tracking-wide font-semibold text-ink-500">
                        {debt.status === "paid" ? "Cleared" : "Balance owed"}
                      </span>
                      <span className="text-[10px] text-ink-500 tabular-nums">
                        of {formatCurrency(debt.amount, debt.currency)}
                      </span>
                    </div>
                    <p
                      className={[
                        "mt-1 text-lg font-bold tabular-nums truncate",
                        isOverdue
                          ? "text-negative-700"
                          : debt.status === "paid"
                            ? "text-positive-700"
                            : "text-brand-700",
                      ].join(" ")}
                      title={formatCurrency(
                        debt.status === "paid" ? debt.amount : debt.balance,
                        debt.currency,
                      )}
                    >
                      {formatCurrency(
                        debt.status === "paid" ? debt.amount : debt.balance,
                        debt.currency,
                      )}
                    </p>

                    {/* Progress bar */}
                    <div className="mt-2 h-1.5 bg-white rounded-full overflow-hidden">
                      <div
                        className={[
                          "h-full rounded-full transition-all",
                          debt.status === "paid"
                            ? "bg-positive-500"
                            : isOverdue
                              ? "bg-negative-500"
                              : "bg-brand-500",
                        ].join(" ")}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Dates row */}
                <div className="px-3 sm:px-4 pb-2.5 space-y-1.5">
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="inline-flex items-center gap-1 text-ink-500">
                      <Calendar className="w-3 h-3" />
                      {viewMode === "history" && debt.paid_date
                        ? `Paid ${new Date(debt.paid_date).toLocaleDateString(
                            "en-GB",
                            { day: "2-digit", month: "short", year: "numeric" },
                          )}`
                        : `Due ${new Date(debt.due_date).toLocaleDateString(
                            "en-GB",
                            { day: "2-digit", month: "short", year: "numeric" },
                          )}`}
                    </span>
                    {viewMode === "active" && (
                      <span
                        className={[
                          "inline-flex items-center gap-1 font-medium tabular-nums px-1.5 py-0.5 rounded-md",
                          days < 0
                            ? "text-negative-700 bg-negative-50"
                            : days <= 7
                              ? "text-warning-600 bg-warning-50"
                              : "text-ink-500 bg-ink-50",
                        ].join(" ")}
                      >
                        <Clock className="w-3 h-3" />
                        {days < 0
                          ? `${Math.abs(days)}d overdue`
                          : days === 0
                            ? "Due today"
                            : `${days}d left`}
                      </span>
                    )}
                  </div>
                  {debt.debt_date && (
                    <p className="text-[11px] text-ink-400 inline-flex items-center gap-1">
                      <Clock className="w-3 h-3 shrink-0" />
                      Taken{" "}
                      {new Date(debt.debt_date).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  )}
                </div>

                {/* Footer: hint + actions */}
                <div className="px-3 sm:px-4 pt-2.5 pb-3 border-t border-ink-100 flex items-center justify-between gap-2">
                  <span className="text-[10px] text-ink-400 italic">
                    Tap to view & pay
                  </span>
                  <div className="flex items-center gap-1">
                    {viewMode === "active" && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedDebt(debt);
                          setAddMoreAmount("");
                          setShowAddMoreDebt(true);
                        }}
                        title="Add more to debt"
                        aria-label="Add more to debt"
                        className="h-7 w-7 inline-flex items-center justify-center rounded-md text-warning-600 bg-warning-50 hover:bg-warning-100 transition-colors focus-ring"
                      >
                        <TrendingUp className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteDebt(debt.id);
                      }}
                      title="Delete debt"
                      aria-label="Delete debt"
                      className="h-7 w-7 inline-flex items-center justify-center rounded-md text-negative-600 bg-negative-50 hover:bg-negative-100 transition-colors focus-ring"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Debt Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add new debt"
        description="Record a debt owed to you."
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowAddModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" form="add-debt-form">
              Add debt
            </Button>
          </>
        }
      >
        <form
          id="add-debt-form"
          onSubmit={handleAddDebt}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Debtor name"
              required
              placeholder="Full name"
              value={newDebt.clientName}
              onChange={(e) =>
                setNewDebt({ ...newDebt, clientName: e.target.value })
              }
            />
            <Input
              label="Phone"
              type="tel"
              required
              placeholder="Phone number"
              value={newDebt.clientPhone}
              onChange={(e) =>
                setNewDebt({ ...newDebt, clientPhone: e.target.value })
              }
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Amount"
              type="number"
              required
              step="0.01"
              placeholder="0.00"
              value={newDebt.amount}
              onChange={(e) =>
                setNewDebt({ ...newDebt, amount: e.target.value })
              }
            />
            <Select
              label="Currency"
              value={newDebt.currency}
              onChange={(e) =>
                setNewDebt({
                  ...newDebt,
                  currency: e.target.value as "KES" | "USD",
                })
              }
              required
            >
              <option value="KES">KES — Kenyan Shillings</option>
              <option value="USD">USD — US Dollars</option>
            </Select>
          </div>
          <Input
            label="Description"
            required
            placeholder="e.g. Outstanding invoice for website work"
            value={newDebt.description}
            onChange={(e) =>
              setNewDebt({ ...newDebt, description: e.target.value })
            }
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Debt date"
              type="date"
              required
              value={newDebt.debt_date}
              onChange={(e) =>
                setNewDebt({ ...newDebt, debt_date: e.target.value })
              }
            />
            <Input
              label="Due date"
              type="date"
              required
              value={newDebt.due_date}
              onChange={(e) =>
                setNewDebt({ ...newDebt, due_date: e.target.value })
              }
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Priority"
              value={newDebt.priority}
              onChange={(e) =>
                setNewDebt({
                  ...newDebt,
                  priority: e.target.value as "low" | "normal" | "high" | "urgent",
                })
              }
            >
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </Select>
            <Input
              label="Reference no. (optional)"
              placeholder="e.g. INV-2025-001"
              value={newDebt.reference_number}
              onChange={(e) =>
                setNewDebt({ ...newDebt, reference_number: e.target.value })
              }
            />
          </div>
        </form>
      </Modal>

      {/* View / Record Payment Modal */}
      {selectedDebt && (
        <Modal
          isOpen={showViewModal}
          onClose={() => setShowViewModal(false)}
          title="Debt details"
          description={selectedDebt.client_name}
          size="lg"
          footer={
            <Button variant="ghost" onClick={() => setShowViewModal(false)}>
              Close
            </Button>
          }
        >
          <div className="space-y-4">
            {/* Summary panel */}
            <div
              className={[
                "rounded-xl border p-4",
                selectedDebt.status === "paid"
                  ? "bg-positive-50 border-positive-100"
                  : selectedDebt.status === "overdue"
                    ? "bg-negative-50 border-negative-100"
                    : "bg-brand-50 border-brand-100",
              ].join(" ")}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-ink-500 uppercase tracking-wide font-semibold">
                    {selectedDebt.status === "paid"
                      ? "Cleared"
                      : "Balance owed"}
                  </p>
                  <p
                    className={[
                      "mt-1 text-2xl font-bold tabular-nums",
                      selectedDebt.status === "paid"
                        ? "text-positive-700"
                        : selectedDebt.status === "overdue"
                          ? "text-negative-700"
                          : "text-brand-700",
                    ].join(" ")}
                  >
                    {formatCurrency(
                      selectedDebt.status === "paid"
                        ? selectedDebt.amount
                        : selectedDebt.balance,
                      selectedDebt.currency,
                    )}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-500">
                    of{" "}
                    {formatCurrency(
                      selectedDebt.amount,
                      selectedDebt.currency,
                    )}{" "}
                    total
                  </p>
                </div>
                <Badge tone={getStatusTone(selectedDebt.status)} dot>
                  {selectedDebt.status}
                </Badge>
              </div>

              {/* Payment progress bar */}
              {selectedDebt.status !== "paid" && selectedDebt.amount > 0 && (
                <div className="mt-3 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-ink-500">
                      Paid:{" "}
                      <span className="font-semibold text-ink-700">
                        {formatCurrency(selectedDebt.amount_paid || 0, selectedDebt.currency)}
                      </span>
                    </span>
                    <span className="text-ink-500 tabular-nums">
                      {Math.round(((selectedDebt.amount_paid || 0) / selectedDebt.amount) * 100)}%
                    </span>
                  </div>
                  <div className="h-2 bg-white/60 rounded-full overflow-hidden">
                    <div
                      className={[
                        "h-full rounded-full transition-all",
                        selectedDebt.status === "overdue" ? "bg-negative-500" : "bg-brand-500",
                      ].join(" ")}
                      style={{
                        width: `${Math.min(100, ((selectedDebt.amount_paid || 0) / selectedDebt.amount) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <p className="text-ink-500">Phone</p>
                  <p className="text-ink-900 font-medium">
                    {selectedDebt.phone || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-ink-500">Debt taken</p>
                  <p className="text-ink-900 font-medium">
                    {selectedDebt.debt_date
                      ? new Date(selectedDebt.debt_date).toLocaleDateString(
                          "en-GB",
                          { day: "2-digit", month: "short", year: "numeric" },
                        )
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-ink-500">
                    {selectedDebt.status === "paid" ? "Paid on" : "Due date"}
                  </p>
                  <p className="text-ink-900 font-medium">
                    {selectedDebt.status === "paid" && selectedDebt.paid_date
                      ? new Date(selectedDebt.paid_date).toLocaleDateString(
                          "en-GB",
                          { day: "2-digit", month: "short", year: "numeric" },
                        )
                      : new Date(selectedDebt.due_date).toLocaleDateString(
                          "en-GB",
                          { day: "2-digit", month: "short", year: "numeric" },
                        )}
                  </p>
                </div>
                <div>
                  <p className="text-ink-500">Priority</p>
                  <p className={[
                    "font-semibold capitalize",
                    selectedDebt.priority === "urgent" ? "text-negative-700" :
                    selectedDebt.priority === "high" ? "text-warning-600" :
                    selectedDebt.priority === "normal" ? "text-ink-700" :
                    "text-ink-500",
                  ].join(" ")}>
                    {selectedDebt.priority || "—"}
                  </p>
                </div>
                {selectedDebt.amount_paid != null && selectedDebt.amount_paid > 0 && (
                  <div>
                    <p className="text-ink-500">Paid so far</p>
                    <p className="text-ink-900 font-medium tabular-nums">
                      {formatCurrency(selectedDebt.amount_paid, selectedDebt.currency)}
                    </p>
                  </div>
                )}
                {selectedDebt.reference_number && (
                  <div>
                    <p className="text-ink-500">Reference</p>
                    <p className="text-ink-900 font-medium font-mono text-[11px]">
                      {selectedDebt.reference_number}
                    </p>
                  </div>
                )}
              </div>

              {selectedDebt.status !== "paid" && (
                <div className="mt-3">
                  <span
                    className={[
                      "inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-md",
                      getDaysUntilDue(selectedDebt.due_date) < 0
                        ? "text-negative-700 bg-negative-100"
                        : getDaysUntilDue(selectedDebt.due_date) <= 7
                          ? "text-warning-600 bg-warning-100"
                          : "text-ink-600 bg-white/60",
                    ].join(" ")}
                  >
                    <Clock className="w-3 h-3" />
                    {(() => {
                      const d = getDaysUntilDue(selectedDebt.due_date);
                      if (d < 0) return `${Math.abs(d)} days overdue`;
                      if (d === 0) return "Due today";
                      return `${d} days left`;
                    })()}
                  </span>
                </div>
              )}
            </div>

            {/* Description & notes */}
            <div className="space-y-3">
              <div>
                <p className="text-xs text-ink-500 uppercase tracking-wide font-semibold mb-1.5">
                  Description
                </p>
                <p className="text-sm text-ink-700 whitespace-pre-wrap">
                  {getInitialDescription(selectedDebt.description) ||
                    "— No description —"}
                </p>
              </div>
              {selectedDebt.notes && (
                <div>
                  <p className="text-xs text-ink-500 uppercase tracking-wide font-semibold mb-1.5">
                    Notes
                  </p>
                  <p className="text-sm text-ink-700 whitespace-pre-wrap bg-ink-50 rounded-lg p-3 border border-ink-100">
                    {selectedDebt.notes}
                  </p>
                </div>
              )}
            </div>

            {/* History */}
            {(() => {
              const history = parseDebtHistory(selectedDebt.description);
              if (!history || history.length === 0) return null;
              return (
                <div>
                  <p className="text-xs text-ink-500 uppercase tracking-wide font-semibold mb-1.5">
                    Debt history
                  </p>
                  <div className="overflow-hidden rounded-lg border border-ink-200">
                    <table className="min-w-full divide-y divide-ink-100 text-xs">
                      <thead className="bg-ink-50">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-ink-600">
                            Date
                          </th>
                          <th className="px-3 py-2 text-left font-medium text-ink-600">
                            Change
                          </th>
                          <th className="px-3 py-2 text-left font-medium text-ink-600">
                            Note
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-ink-100">
                        {history.map((h, idx) => (
                          <tr key={idx} className="bg-white">
                            <td className="px-3 py-2 text-ink-700 tabular-nums">
                              {h.date || "—"}
                            </td>
                            <td className="px-3 py-2 text-ink-900 font-medium">
                              {h.amount || "—"}
                            </td>
                            <td className="px-3 py-2 text-ink-600">
                              {h.note || "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}

            {/* Record payment */}
            {selectedDebt.status !== "paid" && selectedDebt.balance > 0 && (
              <div className="rounded-xl border-2 border-brand-200 bg-gradient-to-br from-brand-50 to-white p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-brand-600 inline-flex items-center justify-center text-white shadow-sm">
                    <DollarSign className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-ink-900">Record a payment</h3>
                    <p className="text-[11px] text-ink-500">
                      Balance remaining:{" "}
                      <span className="font-semibold text-brand-700">
                        {formatCurrency(selectedDebt.balance, selectedDebt.currency)}
                      </span>
                    </p>
                  </div>
                </div>

                {/* Quick-fill chips */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {[25, 50, 75, 100].map((pct) => {
                    const amt = Math.round((selectedDebt.balance * pct) / 100 * 100) / 100;
                    return (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => setPaymentAmount(String(amt))}
                        className={[
                          "h-7 px-2.5 rounded-md text-xs font-medium transition-colors",
                          paymentAmount === String(amt)
                            ? "bg-brand-600 text-white shadow-sm"
                            : "bg-white border border-brand-200 text-brand-700 hover:bg-brand-50",
                        ].join(" ")}
                      >
                        {pct === 100 ? "Full" : `${pct}%`}
                      </button>
                    );
                  })}
                </div>

                <div className="space-y-3">
                  <Input
                    label={`Payment amount (${selectedDebt.currency})`}
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={selectedDebt.balance}
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    placeholder={`Max ${formatCurrency(selectedDebt.balance, selectedDebt.currency)}`}
                    error={
                      paymentAmount &&
                      parseFloat(paymentAmount) > selectedDebt.balance
                        ? `Cannot exceed balance of ${formatCurrency(selectedDebt.balance, selectedDebt.currency)}`
                        : undefined
                    }
                  />

                  {/* After-payment preview */}
                  {paymentAmount && parseFloat(paymentAmount) > 0 && parseFloat(paymentAmount) <= selectedDebt.balance && (
                    <div className="rounded-lg bg-white border border-brand-100 p-3 text-xs space-y-1.5">
                      <div className="flex items-center justify-between text-ink-600">
                        <span>Current balance</span>
                        <span className="tabular-nums font-medium">
                          {formatCurrency(selectedDebt.balance, selectedDebt.currency)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-brand-700">
                        <span>Payment</span>
                        <span className="tabular-nums font-medium">
                          − {formatCurrency(parseFloat(paymentAmount), selectedDebt.currency)}
                        </span>
                      </div>
                      <div className="border-t border-brand-100 pt-1.5 flex items-center justify-between font-semibold">
                        <span className={selectedDebt.balance - parseFloat(paymentAmount) === 0 ? "text-positive-700" : "text-ink-900"}>
                          Remaining
                        </span>
                        <span className={[
                          "tabular-nums",
                          selectedDebt.balance - parseFloat(paymentAmount) === 0
                            ? "text-positive-700"
                            : "text-ink-900",
                        ].join(" ")}>
                          {selectedDebt.balance - parseFloat(paymentAmount) === 0
                            ? "Fully paid!"
                            : formatCurrency(selectedDebt.balance - parseFloat(paymentAmount), selectedDebt.currency)}
                        </span>
                      </div>
                    </div>
                  )}

                  <Button
                    variant="primary"
                    onClick={handleRecordPayment}
                    disabled={
                      !paymentAmount ||
                      parseFloat(paymentAmount) <= 0 ||
                      parseFloat(paymentAmount) > selectedDebt.balance
                    }
                    block
                    leadingIcon={<CheckCircle2 className="w-4 h-4" />}
                  >
                    {paymentAmount && parseFloat(paymentAmount) === selectedDebt.balance
                      ? "Mark as fully paid"
                      : "Record payment"}
                  </Button>
                </div>
              </div>
            )}

            {selectedDebt.status === "paid" && (
              <div className="rounded-xl border-2 border-positive-100 bg-positive-50 p-4 text-center">
                <CheckCircle2 className="w-8 h-8 text-positive-600 mx-auto mb-1" />
                <p className="text-sm font-semibold text-positive-700">
                  This debt is fully paid
                </p>
                {selectedDebt.paid_date && (
                  <p className="text-xs text-positive-600 mt-1">
                    Cleared on{" "}
                    {new Date(selectedDebt.paid_date).toLocaleDateString(
                      "en-GB",
                      { day: "2-digit", month: "short", year: "numeric" },
                    )}
                  </p>
                )}
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Add More to Debt Modal */}
      {selectedDebt && (
        <Modal
          isOpen={showAddMoreDebt}
          onClose={() => {
            setShowAddMoreDebt(false);
            setAddMoreAmount("");
            setSelectedDebt(null);
          }}
          title="Add more to debt"
          description={selectedDebt.client_name}
          size="md"
          tone="warning"
          footer={
            <>
              <Button
                variant="ghost"
                onClick={() => {
                  setShowAddMoreDebt(false);
                  setAddMoreAmount("");
                  setSelectedDebt(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleAddMoreDebt}
                disabled={!addMoreAmount || parseFloat(addMoreAmount) <= 0}
                leadingIcon={<TrendingUp className="w-4 h-4" />}
              >
                Add to debt
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            {/* Current state */}
            <div className="rounded-xl bg-ink-50 border border-ink-100 p-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-wide font-semibold text-ink-500">
                    Current debt
                  </p>
                  <p className="mt-0.5 text-lg font-bold text-ink-900 tabular-nums">
                    {formatCurrency(
                      selectedDebt.amount,
                      selectedDebt.currency,
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide font-semibold text-ink-500">
                    Balance
                  </p>
                  <p className="mt-0.5 text-lg font-bold text-warning-600 tabular-nums">
                    {formatCurrency(
                      selectedDebt.balance,
                      selectedDebt.currency,
                    )}
                  </p>
                </div>
              </div>
            </div>

            <Input
              label={`Additional amount (${selectedDebt.currency})`}
              type="number"
              step="0.01"
              min="0"
              value={addMoreAmount}
              onChange={(e) => setAddMoreAmount(e.target.value)}
              placeholder="Enter amount to add"
              autoFocus
            />

            <div>
              <label className="block text-xs font-medium text-ink-700 mb-1.5">
                Reason (optional)
              </label>
              <textarea
                value={addMoreReason}
                onChange={(e) => setAddMoreReason(e.target.value)}
                placeholder="Why is this debt increasing?"
                rows={3}
                className="w-full px-3 py-2 text-sm bg-white text-ink-900 placeholder:text-ink-400 border border-ink-200 rounded-lg focus:outline-none focus:border-brand-500 focus:shadow-focus transition-shadow"
              />
            </div>

            {addMoreAmount && parseFloat(addMoreAmount) > 0 && (
              <div className="rounded-xl border-2 border-warning-100 bg-warning-50 p-3">
                <p className="text-[10px] uppercase tracking-wide font-semibold text-warning-600">
                  New total debt
                </p>
                <p className="mt-0.5 text-xl font-bold text-warning-600 tabular-nums">
                  {formatCurrency(
                    selectedDebt.amount + parseFloat(addMoreAmount),
                    selectedDebt.currency,
                  )}
                </p>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}

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
  Eye,
  TrendingUp,
} from "lucide-react";
import { formatCurrency } from "../lib/currency";
import Modal from "./Modal";

interface DebtWithClient {
  id: string;
  client_id: string;
  client_name: string;
  client_code: string;
  phone: string;
  amount: number;
  currency: "KES" | "USD";
  balance: number;
  description: string;
  reference_number: string;
  debt_date: string;
  due_date: string;
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
    due_date: "",
    clientName: "",
    clientPhone: "",
  });

  useEffect(() => {
    loadDebts();
  }, []);

  useEffect(() => {
    filterDebts();
  }, [debts, searchTerm, statusFilter]);

  async function loadDebts() {
    try {
      const { data, error } = await supabase
        .from("client_debts")
        .select(
          "id, debtor_name, debtor_phone, amount, currency, balance, description, debt_date, due_date, status, priority, created_at"
        )
        .order("due_date", { ascending: true });

      if (error) throw error;

      const debtsWithClients = (data || []).map((debt: any) => {
        const dueDate = new Date(debt.due_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        dueDate.setHours(0, 0, 0, 0);

        // Auto-update status to overdue if past due date and not paid
        const status =
          debt.status !== "paid" && dueDate < today ? "overdue" : debt.status;

        return {
          ...debt,
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
    today.setHours(0, 0, 0, 0); // Reset time to start of day

    // Count overdue: either status is overdue OR due date has passed and not paid
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

    if (statusFilter !== "all") {
      filtered = filtered.filter((d) => d.status === statusFilter);
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (d) =>
          d.client_name.toLowerCase().includes(term) ||
          d.client_code.toLowerCase().includes(term) ||
          d.description.toLowerCase().includes(term)
      );
    }

    setFilteredDebts(filtered);
  }, [debts, searchTerm, statusFilter]);

  function getDaysUntilDue(dueDate: string): number {
    const today = new Date();
    const due = new Date(dueDate);
    const diffTime = due.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  function getStatusColor(status: string): string {
    switch (status) {
      case "overdue":
        return "text-red-700 bg-red-100 border-2 border-red-500";
      case "pending":
        return "text-amber-400 bg-amber-500/20";
      case "paid":
        return "text-emerald-600 bg-emerald-500/20";
      case "cancelled":
        return "text-gray-600 bg-gray-500/20";
      default:
        return "text-gray-600 bg-gray-500/20";
    }
  }

  function getPriorityColor(priority: string): string {
    switch (priority) {
      case "urgent":
        return "text-red-600 bg-red-500/20";
      case "high":
        return "text-orange-400 bg-orange-500/20";
      case "normal":
        return "text-blue-600 bg-blue-500/20";
      case "low":
        return "text-gray-600 bg-gray-500/20";
      default:
        return "text-gray-600 bg-gray-500/20";
    }
  }

  async function handleAddDebt(e: React.FormEvent) {
    e.preventDefault();
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Create debt directly without creating a client
      const { error: debtError } = await supabase.from("client_debts").insert([
        {
          user_id: user.id,
          debtor_name: newDebt.clientName,
          debtor_phone: newDebt.clientPhone,
          amount: parseFloat(newDebt.amount),
          currency: newDebt.currency,
          description: newDebt.description,
          due_date: newDebt.due_date,
          priority: "normal",
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
        due_date: "",
        clientName: "",
        clientPhone: "",
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
          amount_paid: selectedDebt.amount - selectedDebt.balance + amount,
          status: newStatus,
          paid_date:
            newBalance === 0 ? new Date().toISOString().split("T")[0] : null,
        })
        .eq("id", selectedDebt.id);

      if (error) throw error;

      toast.success("Payment recorded successfully!");
      setShowViewModal(false);
      setPaymentAmount("");
      await loadDebts();
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
        selectedDebt.currency
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
          selectedDebt.currency
        )} to debt!`
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
      <div className="flex items-center justify-center h-64 text-gray-900">
        Loading...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 xl:gap-6">
        <div className="bg-white/90 backdrop-blur-xl rounded-2xl p-6 shadow-2xl border-2 border-gray-200 hover:shadow-3xl hover:scale-105 transition-all duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-600 mb-2">
                Overdue
              </p>
              <p className="text-2xl font-black text-red-600">
                {stats.overdue}
              </p>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center shadow-xl shadow-red-500/30">
              <AlertCircle className="w-7 h-7 text-white" />
            </div>
          </div>
        </div>

        <div className="bg-white/90 backdrop-blur-xl rounded-2xl p-6 shadow-2xl border-2 border-gray-200 hover:shadow-3xl hover:scale-105 transition-all duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-600 mb-2">
                Pending
              </p>
              <p className="text-2xl font-black text-amber-600">
                {stats.pending}
              </p>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-xl shadow-amber-500/30">
              <Calendar className="w-7 h-7 text-white" />
            </div>
          </div>
        </div>

        <div className="bg-white/90 backdrop-blur-xl rounded-2xl p-6 shadow-2xl border-2 border-gray-200 hover:shadow-3xl hover:scale-105 transition-all duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-600 mb-2">Paid</p>
              <p className="text-2xl font-black text-emerald-600">
                {stats.paid}
              </p>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-xl shadow-emerald-500/30">
              <DollarSign className="w-7 h-7 text-white" />
            </div>
          </div>
        </div>

        <div className="bg-white/90 backdrop-blur-xl rounded-2xl p-6 shadow-2xl border-2 border-gray-200 hover:shadow-3xl hover:scale-105 transition-all duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-600 mb-2">
                Total Balance
              </p>
              <p className="text-2xl font-black text-blue-600">
                {formatCurrency(stats.totalBalance, "KES")}
              </p>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-xl shadow-blue-500/30">
              <DollarSign className="w-7 h-7 text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white/90 backdrop-blur-xl rounded-2xl p-6 shadow-2xl border-2 border-gray-200">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by debtor name or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white text-gray-900 placeholder-gray-500 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-semibold shadow-lg"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-6 py-3 bg-white text-gray-900 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 font-semibold shadow-lg transition-all [&>option]:text-gray-900 [&>option]:bg-white"
          >
            <option value="all">All Status</option>
            <option value="overdue">Overdue</option>
            <option value="pending">Pending</option>
            <option value="paid">Paid</option>
          </select>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 text-white rounded-xl hover:shadow-2xl hover:shadow-blue-500/50 transition-all duration-300 font-black shadow-xl active:scale-95 border-2 border-blue-500"
          >
            <Plus className="w-5 h-5" />
            Add Debt
          </button>
        </div>
      </div>

      {/* Debts List */}
      <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-2xl border-2 border-gray-200">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gradient-to-r from-gray-50 via-white to-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">
                  Debt Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">
                  Client
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">
                  Number
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">
                  Balance
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">
                  Due Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">
                  Priority
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">
                  Description
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white/80 divide-y divide-gray-200">
              {filteredDebts.map((debt) => {
                const daysUntilDue = getDaysUntilDue(debt.due_date);
                const isOverdue = debt.status === "overdue";
                return (
                  <tr
                    key={debt.id}
                    onClick={() => handleViewDebt(debt)}
                    className="hover:bg-gray-50 transition-all cursor-pointer"
                  >
                    <td className="px-6 py-4 text-gray-700">
                      {debt.debt_date
                        ? new Date(debt.debt_date).toLocaleDateString()
                        : "N/A"}
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-gray-900">
                          {debt.client_name}
                        </p>
                        <p className="text-sm text-gray-600">
                          {debt.client_code}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-700">
                      {debt.phone || "N/A"}
                    </td>
                    <td className="px-6 py-4 text-gray-900">
                      {formatCurrency(debt.amount, debt.currency)}
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-900">
                      {formatCurrency(debt.balance, debt.currency)}
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-gray-900">
                          {new Date(debt.due_date).toLocaleDateString()}
                        </p>
                        {debt.status !== "paid" && (
                          <p
                            className={`text-sm ${
                              daysUntilDue < 0
                                ? "text-red-600"
                                : daysUntilDue <= 7
                                ? "text-amber-400"
                                : "text-gray-600"
                            }`}
                          >
                            {daysUntilDue < 0
                              ? `${Math.abs(daysUntilDue)} days overdue`
                              : daysUntilDue === 0
                              ? "Due today"
                              : `${daysUntilDue} days left`}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-1 text-xs rounded-full ${
                          debt.status === "overdue"
                            ? "font-extrabold text-sm"
                            : "font-medium"
                        } ${getStatusColor(debt.status)}`}
                      >
                        {debt.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(
                          debt.priority
                        )}`}
                      >
                        {debt.priority}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-900 max-w-xs truncate">
                      {debt.description}
                    </td>
                    <td
                      className="px-6 py-4"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex gap-3">
                        <button
                          onClick={() => {
                            setSelectedDebt(debt);
                            setAddMoreAmount("");
                            setShowAddMoreDebt(true);
                          }}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                          title="Add more to debt"
                        >
                          <TrendingUp className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleDeleteDebt(debt.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all"
                          title="Delete"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredDebts.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-600">No debts found</p>
          </div>
        )}
      </div>

      {/* Add Debt Modal */}
      {showAddModal && (
        <Modal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          title="Add New Debt"
        >
          <form onSubmit={handleAddDebt} className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Debtor Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="Full Name"
                  value={newDebt.clientName}
                  onChange={(e) =>
                    setNewDebt({ ...newDebt, clientName: e.target.value })
                  }
                  className="w-full px-4 py-3 bg-white text-gray-900 placeholder-gray-500 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-semibold shadow-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Phone Number
                </label>
                <input
                  type="tel"
                  required
                  placeholder="Phone"
                  value={newDebt.clientPhone}
                  onChange={(e) =>
                    setNewDebt({ ...newDebt, clientPhone: e.target.value })
                  }
                  className="w-full px-4 py-3 bg-white text-gray-900 placeholder-gray-500 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-semibold shadow-lg"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Amount
                </label>
                <input
                  type="number"
                  required
                  step="0.01"
                  value={newDebt.amount}
                  onChange={(e) =>
                    setNewDebt({ ...newDebt, amount: e.target.value })
                  }
                  className="w-full px-4 py-3 bg-white text-gray-900 placeholder-gray-500 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-semibold shadow-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Currency
                </label>
                <select
                  value={newDebt.currency}
                  onChange={(e) =>
                    setNewDebt({
                      ...newDebt,
                      currency: e.target.value as "KES" | "USD",
                    })
                  }
                  className="w-full px-4 py-3 bg-white text-gray-900 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-semibold shadow-lg"
                >
                  <option value="KES" className="bg-white text-gray-900">
                    KES
                  </option>
                  <option value="USD" className="bg-white text-gray-900">
                    USD
                  </option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Description
              </label>
              <input
                type="text"
                required
                value={newDebt.description}
                onChange={(e) =>
                  setNewDebt({ ...newDebt, description: e.target.value })
                }
                className="w-full px-4 py-3 bg-white text-gray-900 placeholder-gray-500 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-semibold shadow-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Due Date
              </label>
              <input
                type="date"
                required
                value={newDebt.due_date}
                onChange={(e) =>
                  setNewDebt({ ...newDebt, due_date: e.target.value })
                }
                className="w-full px-4 py-3 bg-white text-gray-900 placeholder-gray-500 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-semibold shadow-lg [color-scheme:light]"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 border-2 border-gray-200 font-bold transition-all duration-200 shadow-lg active:scale-95"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 text-white rounded-xl hover:shadow-2xl hover:shadow-blue-500/50 transition-all duration-300 font-black shadow-xl active:scale-95 border-2 border-blue-500"
              >
                Add Debt
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* View Debt & Record Payment Modal */}
      {showViewModal && selectedDebt && (
        <Modal
          isOpen={showViewModal}
          onClose={() => setShowViewModal(false)}
          title="Debt Details & Payment"
        >
          <div className="space-y-5">
            {/* Debt Information */}
            <div className="bg-gradient-to-r from-gray-50 via-white to-gray-50 rounded-2xl p-6 space-y-4 border-2 border-gray-200 shadow-lg">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm text-gray-600">Client</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {selectedDebt.client_name}
                  </p>
                  <p className="text-sm text-gray-600">
                    {selectedDebt.client_code}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    Number: {selectedDebt.phone || "N/A"}
                  </p>
                </div>
                <span
                  className={`px-3 py-1 text-xs font-medium rounded-full ${getStatusColor(
                    selectedDebt.status
                  )}`}
                >
                  {selectedDebt.status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-3 border-t border-gray-200">
                <div>
                  <p className="text-sm text-gray-600">Total Amount</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {formatCurrency(selectedDebt.amount, selectedDebt.currency)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Balance Due</p>
                  <p className="text-lg font-semibold text-emerald-600">
                    {formatCurrency(
                      selectedDebt.balance,
                      selectedDebt.currency
                    )}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Due Date</p>
                  <p className="text-gray-900">
                    {new Date(selectedDebt.due_date).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Days Until Due</p>
                  <p
                    className={`font-medium ${
                      getDaysUntilDue(selectedDebt.due_date) < 0
                        ? "text-red-600"
                        : getDaysUntilDue(selectedDebt.due_date) <= 7
                        ? "text-amber-600"
                        : "text-emerald-600"
                    }`}
                  >
                    {getDaysUntilDue(selectedDebt.due_date) < 0
                      ? `${Math.abs(
                          getDaysUntilDue(selectedDebt.due_date)
                        )} days overdue`
                      : getDaysUntilDue(selectedDebt.due_date) === 0
                      ? "Due today"
                      : `${getDaysUntilDue(selectedDebt.due_date)} days left`}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-sm text-gray-600">Description</p>
                <p className="text-gray-900">{selectedDebt.description}</p>
              </div>
            </div>

            {/* Record Payment Section */}
            {selectedDebt.status !== "paid" && selectedDebt.balance > 0 && (
              <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 rounded-2xl p-6 border-2 border-emerald-200 shadow-lg">
                <h3 className="text-lg font-black text-gray-900 mb-4 flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-emerald-600" />
                  Record Payment
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      Payment Amount ({selectedDebt.currency})
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      max={selectedDebt.balance}
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      placeholder={`Max: ${selectedDebt.balance}`}
                      className="w-full px-4 py-3 bg-white text-gray-900 placeholder-gray-500 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-semibold shadow-lg"
                    />
                  </div>
                  <button
                    onClick={handleRecordPayment}
                    disabled={!paymentAmount || parseFloat(paymentAmount) <= 0}
                    className="w-full px-6 py-3 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 text-white rounded-xl hover:shadow-2xl hover:shadow-emerald-500/50 transition-all duration-300 font-black shadow-xl disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 border-2 border-emerald-500"
                  >
                    Record Payment
                  </button>
                </div>
              </div>
            )}

            {selectedDebt.status === "paid" && (
              <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border-2 border-emerald-200 rounded-2xl p-6 shadow-lg">
                <p className="text-emerald-600 font-black text-center text-lg">
                  ✓ This debt has been fully paid
                </p>
              </div>
            )}

            <button
              onClick={() => setShowViewModal(false)}
              className="w-full px-6 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 border-2 border-gray-200 font-bold transition-all duration-200 shadow-lg active:scale-95"
            >
              Close
            </button>
          </div>
        </Modal>
      )}

      {/* Add More Debt Modal */}
      {showAddMoreDebt && selectedDebt && (
        <Modal
          isOpen={showAddMoreDebt}
          onClose={() => {
            setShowAddMoreDebt(false);
            setAddMoreAmount("");
            setSelectedDebt(null);
          }}
          title="Add More to Debt"
        >
          <div className="space-y-5">
            {/* Current Debt Info */}
            <div className="bg-gradient-to-r from-gray-50 via-white to-gray-50 rounded-2xl p-6 border-2 border-gray-200 shadow-lg">
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-600 font-semibold">Debtor</p>
                  <p className="text-lg font-black text-gray-900">
                    {selectedDebt.client_name}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600 font-semibold">
                      Current Debt
                    </p>
                    <p className="text-xl font-black text-red-600">
                      {formatCurrency(
                        selectedDebt.amount,
                        selectedDebt.currency
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 font-semibold">
                      Balance
                    </p>
                    <p className="text-xl font-black text-amber-600">
                      {formatCurrency(
                        selectedDebt.balance,
                        selectedDebt.currency
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Add Amount Section */}
            <div className="bg-gradient-to-r from-orange-50 via-red-50 to-orange-50 rounded-2xl p-6 border-2 border-orange-200 shadow-lg">
              <h3 className="text-lg font-black text-gray-900 mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-orange-600" />
                Increase Debt Amount
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    Additional Amount ({selectedDebt.currency})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={addMoreAmount}
                    onChange={(e) => setAddMoreAmount(e.target.value)}
                    placeholder="Enter amount to add"
                    className="w-full px-4 py-3 bg-white text-gray-900 placeholder-gray-500 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-orange-500/20 focus:border-orange-500 transition-all font-semibold shadow-lg"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    Reason (Optional)
                  </label>
                  <textarea
                    value={addMoreReason}
                    onChange={(e) => setAddMoreReason(e.target.value)}
                    placeholder="Why is this debt increasing?"
                    rows={3}
                    className="w-full px-4 py-3 bg-white text-gray-900 placeholder-gray-500 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-orange-500/20 focus:border-orange-500 transition-all font-semibold shadow-lg resize-none"
                  />
                </div>

                {addMoreAmount && parseFloat(addMoreAmount) > 0 && (
                  <div className="bg-white rounded-xl p-4 border-2 border-orange-200">
                    <p className="text-sm text-gray-600 font-semibold mb-1">
                      New Total Debt:
                    </p>
                    <p className="text-2xl font-black text-red-600">
                      {formatCurrency(
                        selectedDebt.amount + parseFloat(addMoreAmount),
                        selectedDebt.currency
                      )}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => {
                  setShowAddMoreDebt(false);
                  setAddMoreAmount("");
                  setSelectedDebt(null);
                }}
                className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 border-2 border-gray-200 font-bold transition-all duration-200 shadow-lg active:scale-95"
              >
                Cancel
              </button>
              <button
                onClick={handleAddMoreDebt}
                disabled={!addMoreAmount || parseFloat(addMoreAmount) <= 0}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-orange-600 via-red-600 to-orange-600 text-white rounded-xl hover:shadow-2xl hover:shadow-orange-500/50 transition-all duration-300 font-black shadow-xl disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 border-2 border-orange-500"
              >
                Add to Debt
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

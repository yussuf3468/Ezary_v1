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

      const debtsWithClients = (data || []).map((debt: any) => ({
        ...debt,
        client_name: debt.debtor_name || "Unknown",
        client_code: "",
        phone: debt.debtor_phone || "",
      }));

      setDebts(debtsWithClients);
      calculateStats(debtsWithClients);
    } catch (error: any) {
      console.error("Error loading debts:", error.message);
    } finally {
      setLoading(false);
    }
  }

  function calculateStats(debtsData: DebtWithClient[]) {
    const overdue = debtsData.filter((d) => d.status === "overdue").length;
    const pending = debtsData.filter((d) => d.status === "pending").length;
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
        return "text-red-400 bg-red-500/20";
      case "pending":
        return "text-amber-400 bg-amber-500/20";
      case "paid":
        return "text-emerald-400 bg-emerald-500/20";
      case "cancelled":
        return "text-gray-400 bg-gray-500/20";
      default:
        return "text-gray-400 bg-gray-500/20";
    }
  }

  function getPriorityColor(priority: string): string {
    switch (priority) {
      case "urgent":
        return "text-red-400 bg-red-500/20";
      case "high":
        return "text-orange-400 bg-orange-500/20";
      case "normal":
        return "text-blue-400 bg-blue-500/20";
      case "low":
        return "text-gray-400 bg-gray-500/20";
      default:
        return "text-gray-400 bg-gray-500/20";
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-white">
        Loading...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 xl:gap-6">
        <div className="bg-white/5 backdrop-blur-xl rounded-lg p-4 shadow-lg border border-white/10">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Overdue</p>
              <p className="text-xl font-bold text-red-400">{stats.overdue}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center shadow-lg">
              <AlertCircle className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>

        <div className="bg-white/5 backdrop-blur-xl rounded-lg p-4 shadow-lg border border-white/10">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Pending</p>
              <p className="text-xl font-bold text-amber-400">
                {stats.pending}
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-lg">
              <Calendar className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>

        <div className="bg-white/5 backdrop-blur-xl rounded-lg p-4 shadow-lg border border-white/10">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Paid</p>
              <p className="text-xl font-bold text-emerald-400">{stats.paid}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg">
              <DollarSign className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>

        <div className="bg-white/5 backdrop-blur-xl rounded-lg p-4 shadow-lg border border-white/10">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Total Balance</p>
              <p className="text-xl font-bold text-blue-400">
                {formatCurrency(stats.totalBalance, "KES")}
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg">
              <DollarSign className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white/5 backdrop-blur-xl rounded-lg p-4 shadow-lg border border-white/10">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by debtor name or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white/10 text-white placeholder-gray-400 border border-white/20 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 bg-white/10 text-white border border-white/20 rounded-lg focus:ring-2 focus:ring-blue-500 [&>option]:text-gray-900 [&>option]:bg-white"
          >
            <option value="all">All Status</option>
            <option value="overdue">Overdue</option>
            <option value="pending">Pending</option>
            <option value="paid">Paid</option>
          </select>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 shadow-lg"
          >
            <Plus className="w-5 h-5" />
            Add Debt
          </button>
        </div>
      </div>

      {/* Debts List */}
      <div className="bg-white/5 backdrop-blur-xl rounded-lg shadow-lg border border-white/10">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-white/10">
            <thead className="bg-white/5">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                  Debt Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                  Client
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                  Number
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                  Balance
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                  Due Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                  Priority
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                  Description
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white/5 divide-y divide-white/10">
              {filteredDebts.map((debt) => {
                const daysUntilDue = getDaysUntilDue(debt.due_date);
                return (
                  <tr
                    key={debt.id}
                    onClick={() => handleViewDebt(debt)}
                    className="hover:bg-white/10 transition-colors cursor-pointer"
                  >
                    <td className="px-6 py-4 text-gray-300">
                      {debt.debt_date
                        ? new Date(debt.debt_date).toLocaleDateString()
                        : "N/A"}
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-white">
                          {debt.client_name}
                        </p>
                        <p className="text-sm text-gray-400">
                          {debt.client_code}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-300">
                      {debt.phone || "N/A"}
                    </td>
                    <td className="px-6 py-4 text-white">
                      {formatCurrency(debt.amount, debt.currency)}
                    </td>
                    <td className="px-6 py-4 font-medium text-white">
                      {formatCurrency(debt.balance, debt.currency)}
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-white">
                          {new Date(debt.due_date).toLocaleDateString()}
                        </p>
                        {debt.status !== "paid" && (
                          <p
                            className={`text-sm ${
                              daysUntilDue < 0
                                ? "text-red-400"
                                : daysUntilDue <= 7
                                ? "text-amber-400"
                                : "text-gray-400"
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
                        className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(
                          debt.status
                        )}`}
                      >
                        {debt.status}
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
                    <td className="px-6 py-4 text-white max-w-xs truncate">
                      {debt.description}
                    </td>
                    <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-3">
                        <button
                          onClick={() => handleDeleteDebt(debt.id)}
                          className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-all"
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
            <p className="text-gray-400">No debts found</p>
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
          <form onSubmit={handleAddDebt} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
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
                  className="w-full px-3 py-2 bg-white/10 text-white placeholder-gray-400 border border-white/20 rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
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
                  className="w-full px-3 py-2 bg-white/10 text-white placeholder-gray-400 border border-white/20 rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
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
                  className="w-full px-3 py-2 bg-white/10 text-white placeholder-gray-400 border border-white/20 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
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
                  className="w-full px-3 py-2 bg-white/10 text-white border border-white/20 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="KES" className="bg-gray-900">
                    KES
                  </option>
                  <option value="USD" className="bg-gray-900">
                    USD
                  </option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">
                Description
              </label>
              <input
                type="text"
                required
                value={newDebt.description}
                onChange={(e) =>
                  setNewDebt({ ...newDebt, description: e.target.value })
                }
                className="w-full px-3 py-2 bg-white/10 text-white placeholder-gray-400 border border-white/20 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">
                Due Date
              </label>
              <input
                type="date"
                required
                value={newDebt.due_date}
                onChange={(e) =>
                  setNewDebt({ ...newDebt, due_date: e.target.value })
                }
                className="w-full px-3 py-2 bg-white/10 text-white placeholder-gray-400 border border-white/20 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="flex-1 px-4 py-2 bg-white/10 text-gray-300 rounded-lg hover:bg-white/20 border border-white/20"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 shadow-lg"
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
          <div className="space-y-4">
            {/* Debt Information */}
            <div className="bg-white/5 rounded-lg p-4 space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm text-gray-400">Client</p>
                  <p className="text-lg font-semibold text-white">
                    {selectedDebt.client_name}
                  </p>
                  <p className="text-sm text-gray-400">
                    {selectedDebt.client_code}
                  </p>
                  <p className="text-sm text-gray-400 mt-1">
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

              <div className="grid grid-cols-2 gap-4 pt-3 border-t border-white/10">
                <div>
                  <p className="text-sm text-gray-400">Total Amount</p>
                  <p className="text-lg font-semibold text-white">
                    {formatCurrency(selectedDebt.amount, selectedDebt.currency)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Balance Due</p>
                  <p className="text-lg font-semibold text-emerald-400">
                    {formatCurrency(
                      selectedDebt.balance,
                      selectedDebt.currency
                    )}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-400">Due Date</p>
                  <p className="text-white">
                    {new Date(selectedDebt.due_date).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Days Until Due</p>
                  <p
                    className={`font-medium ${
                      getDaysUntilDue(selectedDebt.due_date) < 0
                        ? "text-red-400"
                        : getDaysUntilDue(selectedDebt.due_date) <= 7
                        ? "text-amber-400"
                        : "text-green-400"
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
                <p className="text-sm text-gray-400">Description</p>
                <p className="text-white">{selectedDebt.description}</p>
              </div>
            </div>

            {/* Record Payment Section */}
            {selectedDebt.status !== "paid" && selectedDebt.balance > 0 && (
              <div className="bg-gradient-to-r from-emerald-500/10 to-teal-500/10 rounded-lg p-4 border border-emerald-500/20">
                <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-emerald-400" />
                  Record Payment
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">
                      Payment Amount ({selectedDebt.currency})
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      max={selectedDebt.balance}
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      placeholder={`Max: ${selectedDebt.balance}`}
                      className="w-full px-3 py-2 bg-white/10 text-white placeholder-gray-400 border border-white/20 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <button
                    onClick={handleRecordPayment}
                    disabled={!paymentAmount || parseFloat(paymentAmount) <= 0}
                    className="w-full px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-lg hover:from-emerald-700 hover:to-teal-700 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    Record Payment
                  </button>
                </div>
              </div>
            )}

            {selectedDebt.status === "paid" && (
              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                <p className="text-green-400 font-medium text-center">
                  ✓ This debt has been fully paid
                </p>
              </div>
            )}

            <button
              onClick={() => setShowViewModal(false)}
              className="w-full px-4 py-2 bg-white/10 text-gray-300 rounded-lg hover:bg-white/20 border border-white/20"
            >
              Close
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

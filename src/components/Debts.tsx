import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import {
  Plus,
  Search,
  Trash2,
  AlertCircle,
  Calendar,
  DollarSign,
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
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [newDebt, setNewDebt] = useState({
    client_id: "",
    amount: "",
    currency: "KES" as "KES" | "USD",
    description: "",
    reference_number: "",
    due_date: "",
    priority: "normal" as "low" | "normal" | "high" | "urgent",
    notes: "",
  });

  useEffect(() => {
    loadDebts();
    loadClients();
  }, []);

  useEffect(() => {
    filterDebts();
  }, [debts, searchTerm, statusFilter]);

  async function loadDebts() {
    try {
      const { data, error } = await supabase
        .from("client_debts")
        .select(
          `
          *,
          clients (
            client_name,
            client_code,
            phone
          )
        `
        )
        .order("due_date", { ascending: true });

      if (error) throw error;

      const debtsWithClients = (data || []).map((debt: any) => ({
        ...debt,
        client_name: debt.clients?.client_name || "Unknown",
        client_code: debt.clients?.client_code || "",
        phone: debt.clients?.phone || "",
      }));

      setDebts(debtsWithClients);
      calculateStats(debtsWithClients);
    } catch (error: any) {
      console.error("Error loading debts:", error.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadClients() {
    try {
      const { data, error } = await supabase
        .from("clients")
        .select("id, client_name, client_code")
        .eq("status", "active")
        .order("client_name");

      if (error) throw error;
      setClients(data || []);
    } catch (error: any) {
      console.error("Error loading clients:", error.message);
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

  function filterDebts() {
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
  }

  function getDaysUntilDue(dueDate: string): number {
    const today = new Date();
    const due = new Date(dueDate);
    const diffTime = due.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  function getStatusColor(status: string): string {
    switch (status) {
      case "overdue":
        return "text-red-600 bg-red-50";
      case "pending":
        return "text-amber-600 bg-amber-50";
      case "paid":
        return "text-emerald-600 bg-emerald-50";
      case "cancelled":
        return "text-gray-600 bg-gray-50";
      default:
        return "text-gray-600 bg-gray-50";
    }
  }

  function getPriorityColor(priority: string): string {
    switch (priority) {
      case "urgent":
        return "text-red-600 bg-red-50";
      case "high":
        return "text-orange-600 bg-orange-50";
      case "normal":
        return "text-blue-600 bg-blue-50";
      case "low":
        return "text-gray-600 bg-gray-50";
      default:
        return "text-gray-600 bg-gray-50";
    }
  }

  async function handleAddDebt(e: React.FormEvent) {
    e.preventDefault();
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Get staff record for current user
      const { data: staffData } = await supabase
        .from("staff")
        .select("id")
        .eq("user_id", user.id)
        .single();

      const { error } = await supabase.from("client_debts").insert([
        {
          ...newDebt,
          amount: parseFloat(newDebt.amount),
          created_by: staffData?.id,
          updated_by: staffData?.id,
        },
      ]);

      if (error) throw error;

      setShowAddModal(false);
      setNewDebt({
        client_id: "",
        amount: "",
        currency: "KES",
        description: "",
        reference_number: "",
        due_date: "",
        priority: "normal",
        notes: "",
      });
      loadDebts();
    } catch (error: any) {
      alert("Error adding debt: " + error.message);
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
    } catch (error: any) {
      alert("Error deleting debt: " + error.message);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">Loading...</div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Overdue</p>
              <p className="text-xl font-bold text-red-600">{stats.overdue}</p>
            </div>
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Pending</p>
              <p className="text-xl font-bold text-amber-600">
                {stats.pending}
              </p>
            </div>
            <Calendar className="w-8 h-8 text-amber-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Paid</p>
              <p className="text-xl font-bold text-emerald-600">{stats.paid}</p>
            </div>
            <DollarSign className="w-8 h-8 text-emerald-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Balance</p>
              <p className="text-xl font-bold text-blue-600">
                {formatCurrency(stats.totalBalance, "KES")}
              </p>
            </div>
            <DollarSign className="w-8 h-8 text-blue-600" />
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by client name, code, or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Status</option>
            <option value="overdue">Overdue</option>
            <option value="pending">Pending</option>
            <option value="paid">Paid</option>
          </select>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-5 h-5" />
            Add Debt
          </button>
        </div>
      </div>

      {/* Debts List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Client
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Balance
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Due Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Priority
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Description
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredDebts.map((debt) => {
                const daysUntilDue = getDaysUntilDue(debt.due_date);
                return (
                  <tr key={debt.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-gray-900">
                          {debt.client_name}
                        </p>
                        <p className="text-sm text-gray-500">
                          {debt.client_code}
                        </p>
                      </div>
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
                                ? "text-amber-600"
                                : "text-gray-500"
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
                    <td className="px-6 py-4 text-gray-900 max-w-xs truncate">
                      {debt.description}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleDeleteDebt(debt.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredDebts.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">No debts found</p>
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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Client
              </label>
              <select
                required
                value={newDebt.client_id}
                onChange={(e) =>
                  setNewDebt({ ...newDebt, client_id: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select client</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.client_name} ({client.client_code})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="KES">KES</option>
                  <option value="USD">USD</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <input
                type="text"
                required
                value={newDebt.description}
                onChange={(e) =>
                  setNewDebt({ ...newDebt, description: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reference Number
                </label>
                <input
                  type="text"
                  value={newDebt.reference_number}
                  onChange={(e) =>
                    setNewDebt({ ...newDebt, reference_number: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Due Date
                </label>
                <input
                  type="date"
                  required
                  value={newDebt.due_date}
                  onChange={(e) =>
                    setNewDebt({ ...newDebt, due_date: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Priority
              </label>
              <select
                value={newDebt.priority}
                onChange={(e) =>
                  setNewDebt({ ...newDebt, priority: e.target.value as any })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <textarea
                value={newDebt.notes}
                onChange={(e) =>
                  setNewDebt({ ...newDebt, notes: e.target.value })
                }
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Add Debt
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

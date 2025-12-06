import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import {
  Plus,
  Trash2,
  Calendar,
  TrendingUp,
  Banknote,
  Repeat,
  Sparkles,
} from "lucide-react";
import Modal from "./Modal";
import {
  formatCurrency,
  formatNumberInput,
  parseCurrency,
} from "../lib/currency";

interface IncomeRecord {
  id: string;
  amount: number;
  description: string;
  type: "daily" | "monthly";
  date: string;
}

export default function Income() {
  const { user } = useAuth();
  const [incomes, setIncomes] = useState<IncomeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    amount: "",
    description: "",
    type: "monthly" as "daily" | "monthly",
    date: new Date().toISOString().split("T")[0],
  });

  useEffect(() => {
    if (user) {
      loadIncomes();
    }
  }, [user]);

  const loadIncomes = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("income")
        .select("*")
        .eq("user_id", user.id)
        .order("date", { ascending: false });

      if (error) throw error;
      setIncomes(data || []);
    } catch (error) {
      console.error("Error loading incomes:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const { error } = await supabase.from("income").insert({
        user_id: user.id,
        amount: parseCurrency(formData.amount),
        description: formData.description,
        type: formData.type,
        date: formData.date,
      });

      if (error) throw error;

      setFormData({
        amount: "",
        description: "",
        type: "monthly",
        date: new Date().toISOString().split("T")[0],
      });
      setShowModal(false);
      loadIncomes();
    } catch (error) {
      console.error("Error adding income:", error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this income record?")) return;

    try {
      const { error } = await supabase.from("income").delete().eq("id", id);
      if (error) throw error;
      loadIncomes();
    } catch (error) {
      console.error("Error deleting income:", error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading income data...</p>
        </div>
      </div>
    );
  }

  const totalMonthlyIncome = incomes.reduce((sum, income) => {
    if (income.type === "daily") {
      const daysInMonth = 30;
      return sum + Number(income.amount) * daysInMonth;
    }
    return sum + Number(income.amount);
  }, 0);

  return (
    <div className="space-y-4 sm:space-y-6 p-4 sm:p-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 flex items-center gap-2">
            <TrendingUp className="w-7 h-7 sm:w-8 sm:h-8 text-emerald-600" />
            Income Tracker
          </h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1">
            Track and manage your income sources
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center justify-center gap-2 px-4 sm:px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl hover:from-emerald-600 hover:to-teal-700 transition-all shadow-lg hover:shadow-xl active:scale-95 font-medium"
        >
          <Plus className="w-5 h-5" />
          <span>Add Income</span>
        </button>
      </div>

      {/* Summary Card */}
      <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl shadow-xl p-6 sm:p-8 text-white">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 backdrop-blur-sm p-3 rounded-xl shadow-lg">
              <Banknote className="w-6 h-6 sm:w-8 sm:h-8" />
            </div>
            <div>
              <p className="text-sm sm:text-base text-emerald-50 font-medium">
                Monthly Income
              </p>
              <p className="text-xs text-emerald-100">Estimated total</p>
            </div>
          </div>
          <Repeat className="w-5 h-5 text-emerald-100" />
        </div>
        <p className="text-3xl sm:text-5xl font-bold mb-2 tracking-tight">
          {formatCurrency(totalMonthlyIncome)}
        </p>
        <div className="flex items-center gap-2 text-sm text-emerald-100">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-emerald-200 animate-pulse"></div>
            <span>
              {incomes.length} income{" "}
              {incomes.length === 1 ? "source" : "sources"}
            </span>
          </div>
        </div>
      </div>

      {/* Income Table */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-gray-100 bg-gradient-to-r from-emerald-50 to-teal-50">
          <h2 className="text-lg sm:text-xl font-bold text-gray-800">
            Income Records
          </h2>
          <p className="text-xs sm:text-sm text-gray-600 mt-1">
            Your income history
          </p>
        </div>

        {incomes.length === 0 ? (
          <div className="p-8 sm:p-12 text-center">
            <div className="bg-gray-100 w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center mx-auto mb-4">
              <TrendingUp className="w-8 h-8 sm:w-10 sm:h-10 text-gray-400" />
            </div>
            <p className="text-gray-500 font-medium mb-2">
              No income records yet
            </p>
            <p className="text-sm text-gray-400">
              Start by adding your first income source!
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b-2 border-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {incomes.map((income, index) => (
                    <tr
                      key={income.id}
                      className={`hover:bg-gradient-to-r hover:from-emerald-50 hover:to-teal-50 transition-all ${
                        index % 2 === 0 ? "bg-white" : "bg-gray-50/50"
                      }`}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-emerald-600" />
                          <span className="text-sm font-medium text-gray-900">
                            {new Date(income.date).toLocaleDateString("en-KE", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">
                          {income.description || "No description"}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 capitalize">
                          {income.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <span className="text-sm font-bold text-emerald-600">
                          {formatCurrency(income.amount)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <button
                          onClick={() => handleDelete(income.id)}
                          className="inline-flex items-center p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          aria-label="Delete income"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden divide-y divide-gray-100">
              {incomes.map((income) => (
                <div
                  key={income.id}
                  className="p-4 hover:bg-gradient-to-r hover:from-emerald-50 hover:to-teal-50 transition-all"
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2">
                      <div className="bg-gradient-to-br from-emerald-100 to-teal-100 p-2 rounded-lg">
                        <Calendar className="w-4 h-4 text-emerald-600" />
                      </div>
                      <span className="text-xs font-medium text-gray-600">
                        {new Date(income.date).toLocaleDateString("en-KE", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                    <button
                      onClick={() => handleDelete(income.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      aria-label="Delete income"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-900">
                      {income.description || "No description"}
                    </p>

                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 capitalize">
                        {income.type}
                      </span>
                      <span className="text-base font-bold text-emerald-600">
                        {formatCurrency(income.amount)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Modal Form */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Add New Income"
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Amount (KES)
              </label>
              <div className="relative">
                <Banknote className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={formData.amount}
                  onChange={(e) => {
                    const formatted = formatNumberInput(e.target.value);
                    setFormData({ ...formData, amount: formatted });
                  }}
                  required
                  className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all text-lg font-semibold"
                  placeholder="10,000.00"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Enter amount with commas
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Type
              </label>
              <select
                value={formData.type}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    type: e.target.value as "daily" | "monthly",
                  })
                }
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all bg-white"
              >
                <option value="monthly">Monthly</option>
                <option value="daily">Daily</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Description
            </label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              required
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
              placeholder="e.g., Salary, Freelance work, Business income"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Date
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="date"
                value={formData.date}
                onChange={(e) =>
                  setFormData({ ...formData, date: e.target.value })
                }
                required
                className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-600 text-white py-3 rounded-xl font-semibold hover:from-emerald-600 hover:to-teal-700 transition-all shadow-lg hover:shadow-xl active:scale-95"
            >
              Add Income
            </button>
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="px-6 py-3 border-2 border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-all font-semibold active:scale-95"
            >
              Cancel
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

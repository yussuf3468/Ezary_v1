import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import {
  Plus,
  Trash2,
  ShoppingBag,
  Home,
  Car,
  Zap,
  Film,
  Heart,
  Tag,
  Calendar,
  Banknote,
  Users,
  GraduationCap,
  CreditCard,
} from "lucide-react";
import Modal from "./Modal";
import {
  formatCurrency,
  parseCurrency,
  formatNumberInput,
} from "../lib/currency";

interface ExpenseRecord {
  id: string;
  amount: number;
  category: string;
  description: string;
  date: string;
}

const categories = [
  { value: "food", label: "Food", icon: ShoppingBag },
  { value: "rent", label: "Rent", icon: Home },
  { value: "transport", label: "Transport", icon: Car },
  { value: "utilities", label: "Utilities", icon: Zap },
  { value: "entertainment", label: "Entertainment", icon: Film },
  { value: "healthcare", label: "Healthcare", icon: Heart },
  { value: "education", label: "Education/Tuition", icon: GraduationCap },
  { value: "family", label: "Family Support", icon: Users },
  { value: "debt_payment", label: "Debt Payment", icon: CreditCard },
  { value: "other", label: "Other", icon: Tag },
];

export default function Expenses() {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [formData, setFormData] = useState({
    amount: "",
    category: "food",
    description: "",
    date: new Date().toISOString().split("T")[0],
  });

  useEffect(() => {
    if (user) {
      loadExpenses();
    }
  }, [user]);

  const loadExpenses = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .eq("user_id", user.id)
        .order("date", { ascending: false });

      if (error) throw error;
      setExpenses(data || []);
    } catch (error) {
      console.error("Error loading expenses:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const { error } = await supabase.from("expenses").insert({
        user_id: user.id,
        amount: parseCurrency(formData.amount),
        category: formData.category,
        description: formData.description,
        date: formData.date,
      });

      if (error) throw error;

      setFormData({
        amount: "",
        category: "food",
        description: "",
        date: new Date().toISOString().split("T")[0],
      });
      setShowForm(false);
      loadExpenses();
    } catch (error) {
      console.error("Error adding expense:", error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this expense?")) return;

    try {
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) throw error;
      loadExpenses();
    } catch (error) {
      console.error("Error deleting expense:", error);
    }
  };

  if (loading) {
    return <div className="text-gray-500">Loading...</div>;
  }

  const filteredExpenses =
    filterCategory === "all"
      ? expenses
      : expenses.filter((e) => e.category === filterCategory);

  const totalExpenses = filteredExpenses.reduce(
    (sum, expense) => sum + Number(expense.amount),
    0
  );

  const getCategoryIcon = (category: string) => {
    const cat = categories.find((c) => c.value === category);
    return cat ? cat.icon : Tag;
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 flex items-center gap-2">
            <div className="bg-gradient-to-br from-red-100 to-pink-100 p-2 sm:p-2.5 rounded-xl">
              <ShoppingBag className="w-6 h-6 sm:w-7 sm:h-7 text-red-600" />
            </div>
            Expense Tracker
          </h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1">
            Monitor your spending habits
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-red-500 to-pink-600 text-white rounded-xl hover:from-red-600 hover:to-pink-700 transition-all shadow-lg hover:shadow-xl transform hover:scale-105 font-semibold"
        >
          <Plus className="w-5 h-5" />
          <span className="hidden sm:inline">Add Expense</span>
          <span className="sm:hidden">Add</span>
        </button>
      </div>

      {/* Total Card */}
      <div className="bg-gradient-to-br from-red-500 via-pink-600 to-rose-600 rounded-2xl shadow-xl p-6 sm:p-8 text-white overflow-hidden relative">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full -ml-12 -mb-12"></div>
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <Banknote className="w-5 h-5 opacity-90" />
            <p className="text-sm sm:text-base font-medium opacity-90">
              Total Expenses
            </p>
          </div>
          <p className="text-3xl sm:text-4xl md:text-5xl font-bold mb-1">
            {formatCurrency(totalExpenses)}
          </p>
          <p className="text-xs sm:text-sm opacity-75">
            {filteredExpenses.length}{" "}
            {filteredExpenses.length === 1 ? "transaction" : "transactions"}
          </p>
        </div>
      </div>

      {/* Add Expense Modal */}
      <Modal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title="Add New Expense"
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
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
                  className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all text-lg font-semibold"
                  placeholder="10,000.00"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Enter amount with commas
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Category
              </label>
              <select
                value={formData.category}
                onChange={(e) =>
                  setFormData({ ...formData, category: e.target.value })
                }
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all text-base"
              >
                {categories.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
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
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all"
              placeholder="e.g., Grocery shopping"
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
                className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              className="flex-1 bg-gradient-to-r from-red-500 to-pink-600 text-white py-3 rounded-xl hover:from-red-600 hover:to-pink-700 transition-all shadow-lg hover:shadow-xl font-semibold"
            >
              Add Expense
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-6 py-3 border-2 border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-all font-medium"
            >
              Cancel
            </button>
          </div>
        </form>
      </Modal>

      {/* Category Filter */}
      <div className="bg-white rounded-2xl shadow-lg p-4 sm:p-5 border border-gray-100">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilterCategory("all")}
            className={`px-3 sm:px-4 py-2 rounded-lg transition-all text-sm font-medium ${
              filterCategory === "all"
                ? "bg-gradient-to-r from-red-500 to-pink-600 text-white shadow-md"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            All
          </button>
          {categories.map((cat) => {
            const Icon = cat.icon;
            return (
              <button
                key={cat.value}
                onClick={() => setFilterCategory(cat.value)}
                className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg transition-all text-sm font-medium ${
                  filterCategory === cat.value
                    ? "bg-gradient-to-r from-red-500 to-pink-600 text-white shadow-md"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{cat.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Expense Table */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-gray-100 bg-gradient-to-r from-red-50 to-pink-50">
          <h2 className="text-lg sm:text-xl font-bold text-gray-800">
            Expense Records
          </h2>
          <p className="text-xs sm:text-sm text-gray-600 mt-1">
            Your spending history
          </p>
        </div>

        {filteredExpenses.length === 0 ? (
          <div className="p-8 sm:p-12 text-center">
            <div className="bg-gray-100 w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center mx-auto mb-4">
              <ShoppingBag className="w-8 h-8 sm:w-10 sm:h-10 text-gray-400" />
            </div>
            <p className="text-gray-500 font-medium mb-2">No expenses found</p>
            <p className="text-sm text-gray-400">
              Start tracking your spending!
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
                      Category
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
                  {filteredExpenses.map((expense, index) => {
                    const Icon = getCategoryIcon(expense.category);
                    return (
                      <tr
                        key={expense.id}
                        className={`hover:bg-gradient-to-r hover:from-red-50 hover:to-pink-50 transition-all ${
                          index % 2 === 0 ? "bg-white" : "bg-gray-50/50"
                        }`}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-red-600" />
                            <span className="text-sm font-medium text-gray-900">
                              {new Date(expense.date).toLocaleDateString(
                                "en-KE",
                                {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                }
                              )}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-gray-900">
                            {expense.description || "No description"}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div className="bg-red-100 p-1.5 rounded-lg">
                              <Icon className="w-4 h-4 text-red-600" />
                            </div>
                            <span className="text-sm font-medium text-gray-700 capitalize">
                              {
                                categories.find(
                                  (c) => c.value === expense.category
                                )?.label
                              }
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <span className="text-sm font-bold text-red-600">
                            {formatCurrency(expense.amount)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <button
                            onClick={() => handleDelete(expense.id)}
                            className="inline-flex items-center p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            aria-label="Delete expense"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden divide-y divide-gray-100">
              {filteredExpenses.map((expense) => {
                const Icon = getCategoryIcon(expense.category);
                return (
                  <div
                    key={expense.id}
                    className="p-4 hover:bg-gradient-to-r hover:from-red-50 hover:to-pink-50 transition-all"
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2">
                        <div className="bg-gradient-to-br from-red-100 to-pink-100 p-2 rounded-lg">
                          <Calendar className="w-4 h-4 text-red-600" />
                        </div>
                        <span className="text-xs font-medium text-gray-600">
                          {new Date(expense.date).toLocaleDateString("en-KE", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                      <button
                        onClick={() => handleDelete(expense.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        aria-label="Delete expense"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm font-medium text-gray-900">
                        {expense.description || "No description"}
                      </p>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="bg-red-100 p-1.5 rounded-lg">
                            <Icon className="w-3.5 h-3.5 text-red-600" />
                          </div>
                          <span className="text-xs font-medium text-gray-700 capitalize">
                            {
                              categories.find(
                                (c) => c.value === expense.category
                              )?.label
                            }
                          </span>
                        </div>
                        <span className="text-base font-bold text-red-600">
                          {formatCurrency(expense.amount)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

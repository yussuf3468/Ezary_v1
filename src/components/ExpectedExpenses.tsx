import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import {
  Plus,
  Trash2,
  Calendar,
  AlertCircle,
  CheckCircle,
  Clock,
  Banknote,
  FileText,
} from "lucide-react";
import Modal from "./Modal";
import {
  formatCurrency,
  parseCurrency,
  formatNumberInput,
} from "../lib/currency";

interface ExpectedExpense {
  id: string;
  title: string;
  amount: number;
  due_date: string;
  category: string;
  notes?: string;
  status: "pending" | "paid";
  created_at: string;
}

const categories = [
  { value: "tuition", label: "Tuition/School Fees" },
  { value: "rent", label: "Rent" },
  { value: "utilities", label: "Utilities" },
  { value: "insurance", label: "Insurance" },
  { value: "subscription", label: "Subscription" },
  { value: "loan_payment", label: "Loan Payment" },
  { value: "tax", label: "Tax" },
  { value: "medical", label: "Medical" },
  { value: "other", label: "Other" },
];

export default function ExpectedExpenses() {
  const { user } = useAuth();
  const [expectedExpenses, setExpectedExpenses] = useState<ExpectedExpense[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    amount: "",
    due_date: "",
    category: "tuition",
    notes: "",
  });

  useEffect(() => {
    if (user) {
      loadExpectedExpenses();
    }
  }, [user]);

  const loadExpectedExpenses = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("expected_expenses")
        .select("*")
        .eq("user_id", user.id)
        .order("due_date", { ascending: true });

      if (error) throw error;
      setExpectedExpenses(data || []);
    } catch (error) {
      console.error("Error loading expected expenses:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const { error } = await supabase.from("expected_expenses").insert({
        user_id: user.id,
        title: formData.title,
        amount: parseCurrency(formData.amount),
        due_date: formData.due_date,
        category: formData.category,
        notes: formData.notes || null,
        status: "pending",
      });

      if (error) throw error;

      setFormData({
        title: "",
        amount: "",
        due_date: "",
        category: "tuition",
        notes: "",
      });
      setShowForm(false);
      loadExpectedExpenses();
    } catch (error) {
      console.error("Error adding expected expense:", error);
      alert("Failed to add expected expense");
    }
  };

  const handleMarkAsPaid = async (expense: ExpectedExpense) => {
    if (
      !confirm(`Mark "${expense.title}" as paid and record as actual expense?`)
    )
      return;

    try {
      // Update status to paid
      const { error: updateError } = await supabase
        .from("expected_expenses")
        .update({ status: "paid" })
        .eq("id", expense.id);

      if (updateError) throw updateError;

      // Record as actual expense
      const { error: expenseError } = await supabase.from("expenses").insert({
        user_id: user!.id,
        amount: expense.amount,
        category:
          expense.category === "tuition" ? "education" : expense.category,
        description: expense.title,
        date: new Date().toISOString().split("T")[0],
      });

      if (expenseError) throw expenseError;

      alert("Expense recorded successfully!");
      loadExpectedExpenses();
    } catch (error) {
      console.error("Error marking as paid:", error);
      alert("Failed to mark as paid");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this expected expense?"))
      return;

    try {
      const { error } = await supabase
        .from("expected_expenses")
        .delete()
        .eq("id", id);

      if (error) throw error;
      loadExpectedExpenses();
    } catch (error) {
      console.error("Error deleting expected expense:", error);
      alert("Failed to delete expected expense");
    }
  };

  if (loading) {
    return <div className="text-gray-500">Loading...</div>;
  }

  const pendingExpenses = expectedExpenses.filter(
    (e) => e.status === "pending"
  );
  const paidExpenses = expectedExpenses.filter((e) => e.status === "paid");
  const totalPending = pendingExpenses.reduce(
    (sum, e) => sum + Number(e.amount),
    0
  );
  const today = new Date().toISOString().split("T")[0];
  const overdueExpenses = pendingExpenses.filter((e) => e.due_date < today);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 flex items-center gap-2">
            <div className="bg-gradient-to-br from-orange-100 to-amber-100 p-2 sm:p-2.5 rounded-xl">
              <Calendar className="w-6 h-6 sm:w-7 sm:h-7 text-orange-600" />
            </div>
            Expected Expenses
          </h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1">
            Track upcoming bills and payments
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="w-full sm:w-auto bg-gradient-to-r from-orange-500 to-amber-600 text-white px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl hover:from-orange-600 hover:to-amber-700 transition-all shadow-lg hover:shadow-xl font-semibold flex items-center justify-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Add Expected Expense
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-orange-500 to-amber-600 rounded-2xl shadow-lg p-4 sm:p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm sm:text-base opacity-90">
              Total Pending
            </span>
            <Clock className="w-5 h-5 opacity-75" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold">
            {formatCurrency(totalPending)}
          </p>
          <p className="text-xs sm:text-sm opacity-75 mt-1">
            {pendingExpenses.length} items
          </p>
        </div>

        <div className="bg-gradient-to-br from-red-500 to-pink-600 rounded-2xl shadow-lg p-4 sm:p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm sm:text-base opacity-90">Overdue</span>
            <AlertCircle className="w-5 h-5 opacity-75" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold">
            {overdueExpenses.length}
          </p>
          <p className="text-xs sm:text-sm opacity-75 mt-1">
            {formatCurrency(
              overdueExpenses.reduce((sum, e) => sum + Number(e.amount), 0)
            )}
          </p>
        </div>

        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl shadow-lg p-4 sm:p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm sm:text-base opacity-90">Paid</span>
            <CheckCircle className="w-5 h-5 opacity-75" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold">
            {paidExpenses.length}
          </p>
          <p className="text-xs sm:text-sm opacity-75 mt-1">This month</p>
        </div>
      </div>

      {/* Pending Expenses */}
      {pendingExpenses.length > 0 && (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="p-4 sm:p-6 border-b border-gray-100 bg-gradient-to-r from-orange-50 to-amber-50">
            <h2 className="text-lg sm:text-xl font-bold text-gray-800">
              Pending Expenses
            </h2>
          </div>
          <div className="divide-y divide-gray-100">
            {pendingExpenses.map((expense) => {
              const isOverdue = expense.due_date < today;
              const daysUntil = Math.ceil(
                (new Date(expense.due_date).getTime() -
                  new Date(today).getTime()) /
                  (1000 * 60 * 60 * 24)
              );

              return (
                <div
                  key={expense.id}
                  className={`p-4 sm:p-6 hover:bg-gray-50 transition-colors ${
                    isOverdue ? "bg-red-50" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-bold text-gray-800 text-base sm:text-lg">
                          {expense.title}
                        </h3>
                        <span className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded-full">
                          {
                            categories.find((c) => c.value === expense.category)
                              ?.label
                          }
                        </span>
                      </div>
                      <p className="text-xl sm:text-2xl font-bold text-orange-600 mb-2">
                        {formatCurrency(expense.amount)}
                      </p>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          <span>
                            Due:{" "}
                            {new Date(expense.due_date).toLocaleDateString()}
                          </span>
                        </div>
                        {isOverdue ? (
                          <span className="text-red-600 font-semibold">
                            Overdue!
                          </span>
                        ) : daysUntil === 0 ? (
                          <span className="text-amber-600 font-semibold">
                            Due today
                          </span>
                        ) : daysUntil === 1 ? (
                          <span className="text-amber-600">Due tomorrow</span>
                        ) : (
                          <span className="text-gray-500">
                            In {daysUntil} days
                          </span>
                        )}
                      </div>
                      {expense.notes && (
                        <p className="text-sm text-gray-600 mt-2 flex items-start gap-1">
                          <FileText className="w-4 h-4 mt-0.5 flex-shrink-0" />
                          {expense.notes}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => handleMarkAsPaid(expense)}
                        className="bg-emerald-500 text-white px-3 py-2 rounded-lg hover:bg-emerald-600 transition-colors text-sm font-medium whitespace-nowrap"
                      >
                        Mark Paid
                      </button>
                      <button
                        onClick={() => handleDelete(expense.id)}
                        className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Paid Expenses */}
      {paidExpenses.length > 0 && (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="p-4 sm:p-6 border-b border-gray-100 bg-gradient-to-r from-emerald-50 to-teal-50">
            <h2 className="text-lg sm:text-xl font-bold text-gray-800">
              Paid Expenses
            </h2>
          </div>
          <div className="divide-y divide-gray-100">
            {paidExpenses.map((expense) => (
              <div key={expense.id} className="p-4 sm:p-6 opacity-60">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle className="w-5 h-5 text-emerald-600" />
                      <h3 className="font-bold text-gray-800">
                        {expense.title}
                      </h3>
                    </div>
                    <p className="text-lg font-bold text-gray-600">
                      {formatCurrency(expense.amount)}
                    </p>
                    <p className="text-sm text-gray-500">
                      Due: {new Date(expense.due_date).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDelete(expense.id)}
                    className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {expectedExpenses.length === 0 && (
        <div className="text-center py-12 bg-white rounded-2xl shadow-lg border border-gray-100">
          <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg mb-2">No expected expenses yet</p>
          <p className="text-gray-400 text-sm">
            Add upcoming bills and payments to track them
          </p>
        </div>
      )}

      {/* Add Form Modal */}
      <Modal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title="Add Expected Expense"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Title
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              required
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
              placeholder="e.g., College Tuition Fee"
            />
          </div>

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
                className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
                placeholder="50,000.00"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Due Date
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="date"
                value={formData.due_date}
                onChange={(e) =>
                  setFormData({ ...formData, due_date: e.target.value })
                }
                required
                className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
              />
            </div>
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
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
            >
              {categories.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Notes (Optional)
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
              rows={3}
              placeholder="Additional details..."
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              className="flex-1 bg-gradient-to-r from-orange-500 to-amber-600 text-white py-3 rounded-xl hover:from-orange-600 hover:to-amber-700 transition-all shadow-lg hover:shadow-xl font-semibold"
            >
              Add Expected Expense
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
    </div>
  );
}

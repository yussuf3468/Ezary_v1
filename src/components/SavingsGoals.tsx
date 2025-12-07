import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import {
  Target,
  Plus,
  Trash2,
  Calendar,
  CheckCircle2,
  X,
  TrendingUp,
  ArrowDownCircle,
} from "lucide-react";
import {
  formatCurrency,
  parseCurrency,
  formatNumberInput,
} from "../lib/currency";

interface SavingsGoal {
  id: string;
  user_id: string;
  goal_name: string;
  target_amount: number;
  current_amount: number;
  target_date: string;
  created_at: string;
  category: string;
  description?: string;
  is_achieved?: boolean;
}

export default function SavingsGoals() {
  const { user } = useAuth();
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddGoalModal, setShowAddGoalModal] = useState(false);
  const [showContributionModal, setShowContributionModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<SavingsGoal | null>(null);
  const [contributionAmount, setContributionAmount] = useState("");
  const [contributionNote, setContributionNote] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawNote, setWithdrawNote] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    target_amount: "",
    target_date: "",
    category: "emergency_fund",
  });

  const categories = [
    {
      value: "emergency_fund",
      label: "Emergency Fund",
      icon: "🛡️",
      color: "from-blue-500 to-cyan-600",
    },
    {
      value: "investment",
      label: "Investment",
      icon: "📈",
      color: "from-green-500 to-emerald-600",
    },
    {
      value: "vacation",
      label: "Vacation",
      icon: "✈️",
      color: "from-sky-500 to-blue-600",
    },
    {
      value: "car",
      label: "Car/Vehicle",
      icon: "🚗",
      color: "from-orange-500 to-amber-600",
    },
    {
      value: "house",
      label: "House/Property",
      icon: "🏠",
      color: "from-purple-500 to-pink-600",
    },
    {
      value: "education",
      label: "Education",
      icon: "🎓",
      color: "from-indigo-500 to-purple-600",
    },
    {
      value: "gadget",
      label: "Gadget/Electronics",
      icon: "💻",
      color: "from-gray-500 to-slate-600",
    },
    {
      value: "business",
      label: "Business",
      icon: "💼",
      color: "from-teal-500 to-cyan-600",
    },
    {
      value: "other",
      label: "Other",
      icon: "🎯",
      color: "from-pink-500 to-rose-600",
    },
  ];

  useEffect(() => {
    if (user) {
      loadGoals();
    }
  }, [user]);

  const loadGoals = async () => {
    try {
      const { data, error } = await supabase
        .from("savings_goals")
        .select("*")
        .eq("user_id", user?.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setGoals(data || []);
    } catch (error) {
      console.error("Error loading savings goals:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const target_amount = parseCurrency(formData.target_amount);
    if (target_amount <= 0) {
      alert("Please enter a valid target amount");
      return;
    }

    if (!formData.name.trim()) {
      alert("Please enter a goal name");
      return;
    }

    try {
      const { error } = await supabase.from("savings_goals").insert([
        {
          user_id: user?.id,
          goal_name: formData.name.trim(),
          target_amount,
          current_amount: 0,
          target_date: formData.target_date || null,
          category: formData.category,
        },
      ]);

      if (error) throw error;

      setFormData({
        name: "",
        target_amount: "",
        target_date: "",
        category: "emergency_fund",
      });
      setShowAddGoalModal(false);
      loadGoals();
    } catch (error: any) {
      alert("Error creating goal: " + error.message);
    }
  };

  const handleAddContribution = async () => {
    const amount = parseCurrency(contributionAmount);
    if (amount <= 0 || !selectedGoal) {
      alert("Please enter a valid amount");
      return;
    }

    try {
      const newAmount = selectedGoal.current_amount + amount;

      const { error: updateError } = await supabase
        .from("savings_goals")
        .update({ current_amount: newAmount })
        .eq("id", selectedGoal.id);

      if (updateError) throw updateError;

      const { error: expenseError } = await supabase.from("expenses").insert([
        {
          user_id: user?.id,
          description: `Savings: ${selectedGoal.goal_name}${
            contributionNote ? ` - ${contributionNote}` : ""
          }`,
          amount,
          category: "savings",
          date: new Date().toISOString().split("T")[0],
        },
      ]);

      if (expenseError) throw expenseError;

      setContributionAmount("");
      setContributionNote("");
      setShowContributionModal(false);
      setSelectedGoal(null);
      loadGoals();
    } catch (error: any) {
      alert("Error adding contribution: " + error.message);
    }
  };

  const handleWithdraw = async () => {
    const amount = parseCurrency(withdrawAmount);
    if (amount <= 0 || !selectedGoal) {
      alert("Please enter a valid amount");
      return;
    }

    if (amount > selectedGoal.current_amount) {
      alert("Withdrawal amount cannot exceed current savings");
      return;
    }

    try {
      const newAmount = selectedGoal.current_amount - amount;

      const { error: updateError } = await supabase
        .from("savings_goals")
        .update({ current_amount: newAmount })
        .eq("id", selectedGoal.id);

      if (updateError) throw updateError;

      const { error: incomeError } = await supabase.from("income").insert([
        {
          user_id: user?.id,
          description: `Savings Withdrawal: ${selectedGoal.goal_name}${
            withdrawNote ? ` - ${withdrawNote}` : ""
          }`,
          amount,
          type: "one-time",
          date: new Date().toISOString().split("T")[0],
        },
      ]);

      if (incomeError) throw incomeError;

      setWithdrawAmount("");
      setWithdrawNote("");
      setShowWithdrawModal(false);
      setSelectedGoal(null);
      loadGoals();
    } catch (error: any) {
      alert("Error withdrawing: " + error.message);
    }
  };

  const handleDeleteGoal = async (id: string) => {
    if (!confirm("Are you sure you want to delete this savings goal?")) return;

    try {
      const { error } = await supabase
        .from("savings_goals")
        .delete()
        .eq("id", id);

      if (error) throw error;
      loadGoals();
    } catch (error: any) {
      alert("Error deleting goal: " + error.message);
    }
  };

  const calculateProgress = (goal: SavingsGoal) => {
    return Math.min((goal.current_amount / goal.target_amount) * 100, 100);
  };

  const getDaysRemaining = (targetDate: string) => {
    if (!targetDate) return null;
    const today = new Date();
    const target = new Date(targetDate);
    const diffTime = target.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  const totalSaved = goals.reduce((sum, goal) => sum + goal.current_amount, 0);
  const totalTarget = goals.reduce((sum, goal) => sum + goal.target_amount, 0);
  const overallProgress =
    totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0;

  return (
    <div className="space-y-4 sm:space-y-6 pb-6">
      {/* Header Stats - Mobile First */}
      <div className="bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-2xl p-4 sm:p-6 text-white shadow-xl">
        <div className="flex items-center gap-2 mb-4">
          <div className="bg-white/20 p-2 rounded-xl backdrop-blur-sm">
            <Target className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold">Savings Goals</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
          <div className="bg-white/10 rounded-xl p-3 sm:p-5 md:p-6 backdrop-blur-sm">
            <p className="text-indigo-100 text-[10px] sm:text-xs md:text-sm mb-1">
              Saved
            </p>
            <p className="text-base sm:text-xl md:text-2xl lg:text-3xl font-bold text-white break-all leading-tight">
              {formatCurrency(totalSaved)}
            </p>
          </div>
          <div className="bg-white/10 rounded-xl p-3 sm:p-5 md:p-6 backdrop-blur-sm">
            <p className="text-indigo-100 text-[10px] sm:text-xs md:text-sm mb-1">
              Target
            </p>
            <p className="text-base sm:text-xl md:text-2xl lg:text-3xl font-bold text-white break-all leading-tight">
              {formatCurrency(totalTarget)}
            </p>
          </div>
          <div className="bg-white/10 rounded-xl p-3 sm:p-5 md:p-6 backdrop-blur-sm col-span-2 md:col-span-1">
            <p className="text-indigo-100 text-[10px] sm:text-xs md:text-sm mb-1">
              Progress
            </p>
            <p className="text-base sm:text-xl md:text-2xl lg:text-3xl font-bold text-white">
              {overallProgress.toFixed(0)}%
            </p>
          </div>
        </div>
      </div>

      {/* Add Goal Button - Mobile First */}
      <button
        onClick={() => setShowAddGoalModal(true)}
        className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-4 rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all flex items-center justify-center gap-2 font-semibold shadow-lg active:scale-95 transform"
      >
        <Plus className="w-5 h-5" />
        Create New Goal
      </button>

      {/* Goals List - Mobile First Cards */}
      {goals.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-md p-8 sm:p-12 text-center">
          <div className="bg-gray-100 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
            <Target className="w-10 h-10 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-800 mb-2">
            No Savings Goals Yet
          </h3>
          <p className="text-gray-600 text-sm">
            Create your first goal to start tracking your savings journey
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {goals.map((goal) => {
            const progress = calculateProgress(goal);
            const daysRemaining = getDaysRemaining(goal.target_date);
            const category = categories.find((c) => c.value === goal.category);
            const isCompleted = progress >= 100;

            return (
              <div
                key={goal.id}
                className={`bg-white rounded-2xl shadow-md p-4 sm:p-5 transition-all hover:shadow-lg ${
                  isCompleted ? "ring-2 ring-green-500" : ""
                }`}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div
                      className={`bg-gradient-to-br ${
                        category?.color || "from-gray-500 to-slate-600"
                      } p-3 rounded-xl shadow-md flex-shrink-0`}
                    >
                      <span className="text-2xl">{category?.icon || "🎯"}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-base sm:text-lg font-bold text-gray-800 truncate">
                        {goal.goal_name}
                      </h3>
                      <p className="text-xs sm:text-sm text-gray-500">
                        {category?.label}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteGoal(goal.id)}
                    className="text-red-500 hover:text-red-600 p-2 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>

                {/* Progress Section */}
                <div className="mb-4">
                  <div className="flex justify-between items-baseline text-sm mb-2">
                    <span className="font-semibold text-gray-700">
                      {formatCurrency(goal.current_amount)}
                    </span>
                    <span className="text-gray-500 text-xs">
                      of {formatCurrency(goal.target_amount)}
                    </span>
                  </div>
                  <div className="relative w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                    <div
                      className={`h-4 rounded-full transition-all duration-500 ${
                        isCompleted
                          ? "bg-gradient-to-r from-green-500 to-emerald-500"
                          : `bg-gradient-to-r ${
                              category?.color || "from-indigo-500 to-purple-500"
                            }`
                      }`}
                      style={{ width: `${Math.min(progress, 100)}%` }}
                    >
                      <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                    </div>
                  </div>
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-sm font-semibold text-gray-700">
                      {progress.toFixed(1)}%
                    </span>
                    {isCompleted && (
                      <span className="flex items-center gap-1 text-green-600 text-sm font-semibold bg-green-50 px-2 py-1 rounded-full">
                        <CheckCircle2 className="w-4 h-4" />
                        Complete!
                      </span>
                    )}
                  </div>
                </div>

                {/* Target Date */}
                {goal.target_date && (
                  <div className="flex items-center gap-2 text-sm text-gray-600 mb-4 bg-gray-50 rounded-lg p-2">
                    <Calendar className="w-4 h-4 flex-shrink-0" />
                    <span className="text-xs sm:text-sm">
                      Target: {new Date(goal.target_date).toLocaleDateString()}
                    </span>
                    {daysRemaining !== null && (
                      <span
                        className={`ml-auto font-semibold text-xs px-2 py-1 rounded-full ${
                          daysRemaining < 0
                            ? "bg-red-100 text-red-700"
                            : daysRemaining < 30
                            ? "bg-orange-100 text-orange-700"
                            : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {daysRemaining < 0
                          ? "Overdue"
                          : `${daysRemaining}d left`}
                      </span>
                    )}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => {
                      setSelectedGoal(goal);
                      setShowContributionModal(true);
                    }}
                    className="bg-gradient-to-r from-green-50 to-emerald-50 text-green-700 py-3 rounded-xl hover:from-green-100 hover:to-emerald-100 transition-all flex items-center justify-center gap-2 font-semibold border border-green-200 active:scale-95 transform"
                  >
                    <Plus className="w-5 h-5" />
                    Add Money
                  </button>
                  <button
                    onClick={() => {
                      setSelectedGoal(goal);
                      setShowWithdrawModal(true);
                    }}
                    disabled={goal.current_amount <= 0}
                    className="bg-gradient-to-r from-orange-50 to-red-50 text-orange-700 py-3 rounded-xl hover:from-orange-100 hover:to-red-100 transition-all flex items-center justify-center gap-2 font-semibold border border-orange-200 active:scale-95 transform disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ArrowDownCircle className="w-5 h-5" />
                    Withdraw
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Goal Modal */}
      {showAddGoalModal && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
          onClick={() => setShowAddGoalModal(false)}
        >
          <div
            className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md max-h-[95vh] sm:max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-4 rounded-t-3xl sm:rounded-t-2xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-white/20 p-2 rounded-xl">
                  <Target className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold">Create New Goal</h3>
              </div>
              <button
                onClick={() => setShowAddGoalModal(false)}
                className="p-2 hover:bg-white/20 rounded-xl transition-colors active:scale-90"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              className="p-4 pb-6 space-y-4 max-h-[70vh] overflow-y-auto"
            >
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Goal Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  placeholder="Emergency Fund"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Category
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {categories.map((cat) => (
                    <button
                      key={cat.value}
                      type="button"
                      onClick={() =>
                        setFormData({ ...formData, category: cat.value })
                      }
                      className={`p-3 rounded-xl border-2 transition-all flex items-center gap-2 ${
                        formData.category === cat.value
                          ? `bg-gradient-to-r ${cat.color} text-white border-transparent shadow-lg`
                          : "border-gray-200 hover:border-gray-300 bg-white"
                      }`}
                    >
                      <span className="text-xl">{cat.icon}</span>
                      <span className="text-xs font-semibold truncate">
                        {cat.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Target Amount (KES) *
                </label>
                <input
                  type="text"
                  value={formData.target_amount}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      target_amount: formatNumberInput(e.target.value),
                    })
                  }
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  placeholder="50,000"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Target Date (Optional)
                </label>
                <input
                  type="date"
                  value={formData.target_date}
                  onChange={(e) =>
                    setFormData({ ...formData, target_date: e.target.value })
                  }
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  min={new Date().toISOString().split("T")[0]}
                />
              </div>

              <div className="flex gap-3 pt-4 pb-24 sm:pb-4">
                <button
                  type="button"
                  onClick={() => setShowAddGoalModal(false)}
                  className="flex-1 px-6 py-3 border-2 border-gray-200 rounded-xl hover:bg-gray-50 active:bg-gray-100 transition-colors font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 rounded-xl hover:from-indigo-700 hover:to-purple-700 active:scale-95 transition-all font-semibold shadow-lg"
                >
                  Create Goal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Contribution Modal */}
      {showContributionModal && selectedGoal && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
          onClick={() => {
            setShowContributionModal(false);
            setSelectedGoal(null);
            setContributionAmount("");
            setContributionNote("");
          }}
        >
          <div
            className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white p-4 rounded-t-3xl sm:rounded-t-2xl">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="bg-white/20 p-2 rounded-xl">
                    <TrendingUp className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold">Add Money</h3>
                </div>
                <button
                  onClick={() => {
                    setShowContributionModal(false);
                    setSelectedGoal(null);
                    setContributionAmount("");
                    setContributionNote("");
                  }}
                  className="p-2 hover:bg-white/20 rounded-xl transition-colors active:scale-90"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="flex items-center gap-2 bg-white/10 rounded-xl p-3 backdrop-blur-sm">
                <span className="text-3xl">
                  {categories.find((c) => c.value === selectedGoal.category)
                    ?.icon || "🎯"}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">
                    {selectedGoal.goal_name}
                  </p>
                  <p className="text-sm text-green-100">
                    {formatCurrency(selectedGoal.current_amount)} of{" "}
                    {formatCurrency(selectedGoal.target_amount)}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 pb-6 space-y-4 max-h-[60vh] overflow-y-auto">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Amount (KES) *
                </label>
                <input
                  type="text"
                  value={contributionAmount}
                  onChange={(e) =>
                    setContributionAmount(formatNumberInput(e.target.value))
                  }
                  placeholder="5,000"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all text-lg font-semibold"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Note (Optional)
                </label>
                <input
                  type="text"
                  value={contributionNote}
                  onChange={(e) => setContributionNote(e.target.value)}
                  placeholder="Monthly savings"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                />
              </div>

              <div className="flex gap-3 pt-4 pb-24 sm:pb-4">
                <button
                  onClick={() => {
                    setShowContributionModal(false);
                    setSelectedGoal(null);
                    setContributionAmount("");
                    setContributionNote("");
                  }}
                  className="flex-1 px-6 py-3 border-2 border-gray-200 rounded-xl hover:bg-gray-50 active:bg-gray-100 transition-colors font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddContribution}
                  className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 text-white py-3 rounded-xl hover:from-green-600 hover:to-emerald-700 active:scale-95 transition-all font-semibold shadow-lg"
                >
                  Add Money
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Withdraw Modal */}
      {showWithdrawModal && selectedGoal && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
          onClick={() => {
            setShowWithdrawModal(false);
            setSelectedGoal(null);
            setWithdrawAmount("");
            setWithdrawNote("");
          }}
        >
          <div
            className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-orange-500 to-red-600 text-white p-4 rounded-t-3xl sm:rounded-t-2xl">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="bg-white/20 p-2 rounded-xl">
                    <ArrowDownCircle className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold">Withdraw Money</h3>
                </div>
                <button
                  onClick={() => {
                    setShowWithdrawModal(false);
                    setSelectedGoal(null);
                    setWithdrawAmount("");
                    setWithdrawNote("");
                  }}
                  className="p-2 hover:bg-white/20 rounded-xl transition-colors active:scale-90"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="flex items-center gap-2 bg-white/10 rounded-xl p-3 backdrop-blur-sm">
                <span className="text-3xl">
                  {categories.find((c) => c.value === selectedGoal.category)
                    ?.icon || "🎯"}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">
                    {selectedGoal.goal_name}
                  </p>
                  <p className="text-sm text-orange-100">
                    Available: {formatCurrency(selectedGoal.current_amount)}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 pb-6 space-y-4 max-h-[60vh] overflow-y-auto">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Amount (KES) *
                </label>
                <input
                  type="text"
                  value={withdrawAmount}
                  onChange={(e) =>
                    setWithdrawAmount(formatNumberInput(e.target.value))
                  }
                  placeholder="5,000"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all text-lg font-semibold"
                  autoFocus
                />
                <p className="text-xs text-gray-500 mt-1">
                  Max: {formatCurrency(selectedGoal.current_amount)}
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Reason (Optional)
                </label>
                <input
                  type="text"
                  value={withdrawNote}
                  onChange={(e) => setWithdrawNote(e.target.value)}
                  placeholder="Emergency expense"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                />
              </div>

              <div className="flex gap-3 pt-4 pb-24 sm:pb-4">
                <button
                  onClick={() => {
                    setShowWithdrawModal(false);
                    setSelectedGoal(null);
                    setWithdrawAmount("");
                    setWithdrawNote("");
                  }}
                  className="flex-1 px-6 py-3 border-2 border-gray-200 rounded-xl hover:bg-gray-50 active:bg-gray-100 transition-colors font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleWithdraw}
                  className="flex-1 bg-gradient-to-r from-orange-500 to-red-600 text-white py-3 rounded-xl hover:from-orange-600 hover:to-red-700 active:scale-95 transition-all font-semibold shadow-lg"
                >
                  Withdraw
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

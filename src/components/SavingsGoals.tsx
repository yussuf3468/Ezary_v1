import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import {
  Target,
  Plus,
  Trash2,
  DollarSign,
  Calendar,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Edit2,
  X,
} from "lucide-react";
import {
  formatCurrency,
  parseCurrency,
  formatNumberInput,
} from "../lib/currency";

interface SavingsGoal {
  id: string;
  user_id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  target_date: string;
  created_at: string;
  category: string;
}

interface Contribution {
  id: string;
  goal_id: string;
  amount: number;
  date: string;
  note?: string;
}

export default function SavingsGoals() {
  const { user } = useAuth();
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<string | null>(null);
  const [contributionAmount, setContributionAmount] = useState("");
  const [contributionNote, setContributionNote] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    target_amount: "",
    target_date: "",
    category: "emergency_fund",
  });

  const categories = [
    { value: "emergency_fund", label: "Emergency Fund", icon: "🛡️" },
    { value: "investment", label: "Investment", icon: "📈" },
    { value: "vacation", label: "Vacation", icon: "✈️" },
    { value: "car", label: "Car/Vehicle", icon: "🚗" },
    { value: "house", label: "House/Property", icon: "🏠" },
    { value: "education", label: "Education", icon: "🎓" },
    { value: "gadget", label: "Gadget/Electronics", icon: "💻" },
    { value: "business", label: "Business", icon: "💼" },
    { value: "other", label: "Other", icon: "🎯" },
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
          name: formData.name.trim(),
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
      setShowAddForm(false);
      loadGoals();
    } catch (error: any) {
      alert("Error creating goal: " + error.message);
    }
  };

  const handleAddContribution = async (goalId: string) => {
    const amount = parseCurrency(contributionAmount);
    if (amount <= 0) {
      alert("Please enter a valid amount");
      return;
    }

    try {
      const goal = goals.find((g) => g.id === goalId);
      if (!goal) return;

      const newAmount = goal.current_amount + amount;

      // Update goal amount
      const { error: updateError } = await supabase
        .from("savings_goals")
        .update({ current_amount: newAmount })
        .eq("id", goalId);

      if (updateError) throw updateError;

      // Record as income (since it's money you're setting aside)
      const { error: incomeError } = await supabase.from("income").insert([
        {
          user_id: user?.id,
          description: `Savings contribution: ${goal.name}${contributionNote ? ` - ${contributionNote}` : ""}`,
          amount,
          type: "one-time",
          date: new Date().toISOString().split("T")[0],
        },
      ]);

      if (incomeError) throw incomeError;

      setContributionAmount("");
      setContributionNote("");
      setSelectedGoal(null);
      loadGoals();
    } catch (error: any) {
      alert("Error adding contribution: " + error.message);
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
        <div className="text-gray-500">Loading savings goals...</div>
      </div>
    );
  }

  const totalSaved = goals.reduce((sum, goal) => sum + goal.current_amount, 0);
  const totalTarget = goals.reduce((sum, goal) => sum + goal.target_amount, 0);
  const overallProgress = totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl p-6 text-white">
        <div className="flex items-center gap-2 mb-4">
          <Target className="w-6 h-6" />
          <h2 className="text-2xl font-bold">Savings Goals</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-indigo-100 text-sm">Total Saved</p>
            <p className="text-2xl font-bold">{formatCurrency(totalSaved)}</p>
          </div>
          <div>
            <p className="text-indigo-100 text-sm">Total Target</p>
            <p className="text-2xl font-bold">{formatCurrency(totalTarget)}</p>
          </div>
          <div>
            <p className="text-indigo-100 text-sm">Overall Progress</p>
            <p className="text-2xl font-bold">{overallProgress.toFixed(1)}%</p>
          </div>
        </div>
      </div>

      {/* Add Goal Button */}
      <button
        onClick={() => setShowAddForm(!showAddForm)}
        className="w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
      >
        {showAddForm ? (
          <>
            <X className="w-5 h-5" />
            Cancel
          </>
        ) : (
          <>
            <Plus className="w-5 h-5" />
            Add New Goal
          </>
        )}
      </button>

      {/* Add Goal Form */}
      {showAddForm && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            Create New Savings Goal
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Goal Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="e.g., Emergency Fund, New Laptop"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category
              </label>
              <select
                value={formData.category}
                onChange={(e) =>
                  setFormData({ ...formData, category: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                {categories.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.icon} {cat.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
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
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="50,000"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Target Date (Optional)
              </label>
              <input
                type="date"
                value={formData.target_date}
                onChange={(e) =>
                  setFormData({ ...formData, target_date: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                min={new Date().toISOString().split("T")[0]}
              />
            </div>

            <button
              type="submit"
              className="w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 transition-colors font-medium"
            >
              Create Goal
            </button>
          </form>
        </div>
      )}

      {/* Goals List */}
      {goals.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <Target className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-800 mb-2">
            No Savings Goals Yet
          </h3>
          <p className="text-gray-600 mb-4">
            Start by creating your first savings goal to track your progress
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {goals.map((goal) => {
            const progress = calculateProgress(goal);
            const daysRemaining = getDaysRemaining(goal.target_date);
            const category = categories.find((c) => c.value === goal.category);
            const isCompleted = progress >= 100;

            return (
              <div
                key={goal.id}
                className={`bg-white rounded-lg shadow-md p-6 ${
                  isCompleted ? "border-2 border-green-500" : ""
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{category?.icon || "🎯"}</span>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800">
                        {goal.name}
                      </h3>
                      <p className="text-sm text-gray-500">{category?.label}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteGoal(goal.id)}
                    className="text-red-500 hover:text-red-600 transition-colors"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>

                {/* Progress Bar */}
                <div className="mb-4">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-600">
                      {formatCurrency(goal.current_amount)}
                    </span>
                    <span className="text-gray-600">
                      {formatCurrency(goal.target_amount)}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full transition-all ${
                        isCompleted
                          ? "bg-green-500"
                          : "bg-gradient-to-r from-indigo-500 to-purple-500"
                      }`}
                      style={{ width: `${Math.min(progress, 100)}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-sm font-medium text-gray-700">
                      {progress.toFixed(1)}% Complete
                    </span>
                    {isCompleted && (
                      <span className="flex items-center gap-1 text-green-600 text-sm font-medium">
                        <CheckCircle2 className="w-4 h-4" />
                        Goal Reached!
                      </span>
                    )}
                  </div>
                </div>

                {/* Target Date */}
                {goal.target_date && (
                  <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
                    <Calendar className="w-4 h-4" />
                    <span>
                      Target: {new Date(goal.target_date).toLocaleDateString()}
                    </span>
                    {daysRemaining !== null && (
                      <span
                        className={`ml-2 font-medium ${
                          daysRemaining < 0
                            ? "text-red-500"
                            : daysRemaining < 30
                            ? "text-orange-500"
                            : "text-gray-600"
                        }`}
                      >
                        ({daysRemaining < 0 ? "Overdue" : `${daysRemaining} days left`})
                      </span>
                    )}
                  </div>
                )}

                {/* Add Contribution */}
                {selectedGoal === goal.id ? (
                  <div className="space-y-3 mt-4 pt-4 border-t">
                    <input
                      type="text"
                      value={contributionAmount}
                      onChange={(e) =>
                        setContributionAmount(formatNumberInput(e.target.value))
                      }
                      placeholder="Amount to add (KES)"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                    <input
                      type="text"
                      value={contributionNote}
                      onChange={(e) => setContributionNote(e.target.value)}
                      placeholder="Note (optional)"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAddContribution(goal.id)}
                        className="flex-1 bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 transition-colors"
                      >
                        Add Contribution
                      </button>
                      <button
                        onClick={() => {
                          setSelectedGoal(null);
                          setContributionAmount("");
                          setContributionNote("");
                        }}
                        className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setSelectedGoal(goal.id)}
                    className="w-full bg-indigo-50 text-indigo-600 py-2 rounded-lg hover:bg-indigo-100 transition-colors flex items-center justify-center gap-2 font-medium"
                  >
                    <Plus className="w-4 h-4" />
                    Add Contribution
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

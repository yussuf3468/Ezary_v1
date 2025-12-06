import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import {
  Home,
  Calendar,
  AlertCircle,
  CheckCircle,
  Banknote,
} from "lucide-react";
import {
  formatCurrency,
  parseCurrency,
  formatNumberInput,
} from "../lib/currency";

interface RentSettings {
  id: string;
  monthly_amount: number;
  due_day: number;
}

export default function Rent() {
  const { user } = useAuth();
  const [rentSettings, setRentSettings] = useState<RentSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [rentPaidThisMonth, setRentPaidThisMonth] = useState(false);
  const [formData, setFormData] = useState({
    monthly_amount: "",
    due_day: "1",
  });
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (user) {
      loadRentSettings();
      checkRentPayment();
    }
  }, [user]);

  const checkRentPayment = async () => {
    if (!user) return;

    try {
      const today = new Date();
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .eq("user_id", user.id)
        .eq("category", "rent")
        .gte("date", startOfMonth.toISOString().split("T")[0])
        .lte("date", endOfMonth.toISOString().split("T")[0]);

      if (error) throw error;

      setRentPaidThisMonth((data && data.length > 0) || false);
    } catch (error) {
      console.error("Error checking rent payment:", error);
    }
  };

  const loadRentSettings = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("rent_settings")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setRentSettings(data);
        setFormData({
          monthly_amount: data.monthly_amount.toString(),
          due_day: data.due_day.toString(),
        });
      } else {
        setIsEditing(true);
      }
    } catch (error) {
      console.error("Error loading rent settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      if (rentSettings) {
        const { error } = await supabase
          .from("rent_settings")
          .update({
            monthly_amount: parseCurrency(formData.monthly_amount),
            due_day: Number(formData.due_day),
            updated_at: new Date().toISOString(),
          })
          .eq("id", rentSettings.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from("rent_settings").insert({
          user_id: user.id,
          monthly_amount: parseCurrency(formData.monthly_amount),
          due_day: Number(formData.due_day),
        });

        if (error) throw error;
      }

      setIsEditing(false);
      loadRentSettings();
    } catch (error) {
      console.error("Error saving rent settings:", error);
    }
  };

  const addRentExpense = async () => {
    if (!user || !rentSettings) return;

    try {
      const today = new Date();
      const { error } = await supabase.from("expenses").insert({
        user_id: user.id,
        amount: rentSettings.monthly_amount,
        category: "rent",
        description: "Monthly rent payment",
        date: today.toISOString().split("T")[0],
      });

      if (error) throw error;
      alert("Rent payment recorded successfully!");
      checkRentPayment(); // Refresh the rent payment status
    } catch (error) {
      console.error("Error recording rent payment:", error);
      alert("Failed to record rent payment");
    }
  };

  if (loading) {
    return <div className="text-gray-500">Loading...</div>;
  }

  const today = new Date();
  const currentDay = today.getDate();
  const dueDay = rentSettings ? rentSettings.due_day : 1;
  const isDue = currentDay >= dueDay && !rentPaidThisMonth;
  const daysUntilDue = isDue ? 0 : dueDay - currentDay;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 flex items-center gap-2">
          <div className="bg-gradient-to-br from-blue-100 to-cyan-100 p-2 sm:p-2.5 rounded-xl">
            <Home className="w-6 h-6 sm:w-7 sm:h-7 text-blue-600" />
          </div>
          Rent Management
        </h1>
        <p className="text-sm sm:text-base text-gray-600 mt-1">
          Set and track your monthly rent
        </p>
      </div>

      {rentSettings && !isEditing ? (
        <>
          {/* Rent Card */}
          <div className="bg-gradient-to-br from-blue-500 via-cyan-600 to-blue-600 rounded-2xl shadow-xl p-6 sm:p-8 text-white overflow-hidden relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full -ml-12 -mb-12"></div>
            <div className="relative z-10 text-center">
              <div className="flex items-center justify-center mb-4">
                <div className="bg-white/20 p-4 rounded-xl backdrop-blur-sm">
                  <Home className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
                </div>
              </div>
              <p className="text-sm sm:text-base font-medium opacity-90 mb-2">
                Monthly Rent
              </p>
              <p className="text-4xl sm:text-5xl font-bold mb-4">
                {formatCurrency(rentSettings.monthly_amount)}
              </p>
              <div className="flex items-center justify-center gap-2 opacity-90">
                <Calendar className="w-4 h-4" />
                <span className="text-xs sm:text-sm">
                  Due on day {rentSettings.due_day} of each month
                </span>
              </div>
            </div>
          </div>

          {/* Due Status Alert */}
          {isDue ? (
            <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4 sm:p-6">
              <div className="flex items-start gap-3 sm:gap-4">
                <AlertCircle className="w-5 h-5 sm:w-6 sm:h-6 text-amber-600 mt-1 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-amber-900 text-base sm:text-lg mb-2">
                    Rent Payment Due
                  </h3>
                  <p className="text-sm sm:text-base text-amber-700 mb-4">
                    Your monthly rent of{" "}
                    {formatCurrency(rentSettings.monthly_amount)} is due this
                    month. Would you like to record this payment as an expense?
                  </p>
                  <button
                    onClick={addRentExpense}
                    className="w-full sm:w-auto bg-gradient-to-r from-emerald-500 to-teal-600 text-white px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl hover:from-emerald-600 hover:to-teal-700 transition-all shadow-lg hover:shadow-xl font-semibold"
                  >
                    Record Rent Payment
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-4 sm:p-6">
              <div className="flex items-start gap-3 sm:gap-4">
                <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-600 mt-1 flex-shrink-0" />
                <div>
                  <h3 className="font-bold text-emerald-900 text-base sm:text-lg mb-2">
                    Rent Not Due Yet
                  </h3>
                  <p className="text-sm sm:text-base text-emerald-700">
                    Your next rent payment is due in {daysUntilDue} day
                    {daysUntilDue !== 1 ? "s" : ""}.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Rent Settings Table */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
            <div className="p-4 sm:p-6 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-cyan-50">
              <h2 className="text-lg sm:text-xl font-bold text-gray-800">
                Rent Settings
              </h2>
            </div>
            <div className="p-4 sm:p-6">
              <div className="space-y-3 text-gray-700">
                <div className="flex justify-between items-center py-3 border-b border-gray-100">
                  <span className="font-semibold text-sm sm:text-base">
                    Monthly Amount:
                  </span>
                  <span className="font-bold text-blue-600 text-sm sm:text-base">
                    {formatCurrency(rentSettings.monthly_amount)}
                  </span>
                </div>
                <div className="flex justify-between items-center py-3 border-b border-gray-100">
                  <span className="font-semibold text-sm sm:text-base">
                    Due Day:
                  </span>
                  <span className="text-sm sm:text-base">
                    Day {rentSettings.due_day} of each month
                  </span>
                </div>
                <div className="flex justify-between items-center py-3">
                  <span className="font-semibold text-sm sm:text-base">
                    Annual Rent:
                  </span>
                  <span className="font-bold text-blue-600 text-sm sm:text-base">
                    {formatCurrency(Number(rentSettings.monthly_amount) * 12)}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setIsEditing(true)}
                className="w-full mt-6 bg-gradient-to-r from-blue-500 to-cyan-600 text-white py-3 rounded-xl hover:from-blue-600 hover:to-cyan-700 transition-all shadow-lg hover:shadow-xl font-semibold"
              >
                Update Settings
              </button>
            </div>
          </div>
        </>
      ) : (
        <div className="bg-white rounded-2xl shadow-lg p-4 sm:p-6 border border-gray-100">
          <h2 className="text-lg sm:text-xl font-bold text-gray-800 mb-4 sm:mb-6">
            {rentSettings ? "Update Rent Settings" : "Set Up Rent Settings"}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Monthly Rent Amount (KES)
              </label>
              <div className="relative">
                <Banknote className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={formData.monthly_amount}
                  onChange={(e) => {
                    const formatted = formatNumberInput(e.target.value);
                    setFormData({ ...formData, monthly_amount: formatted });
                  }}
                  required
                  className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-lg font-semibold"
                  placeholder="10,000.00"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Enter amount with commas
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Due Day of Month (1-31)
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={formData.due_day}
                  onChange={(e) =>
                    setFormData({ ...formData, due_day: e.target.value })
                  }
                  required
                  className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  placeholder="1"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                The day of the month when rent is due (e.g., 1 for the 1st of
                each month)
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                className="flex-1 bg-gradient-to-r from-blue-500 to-cyan-600 text-white py-3 rounded-xl hover:from-blue-600 hover:to-cyan-700 transition-all shadow-lg hover:shadow-xl font-semibold"
              >
                {rentSettings ? "Update Settings" : "Save Settings"}
              </button>
              {rentSettings && (
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-6 py-3 border-2 border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-all font-medium"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

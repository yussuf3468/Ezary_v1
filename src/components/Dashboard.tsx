import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  CreditCard,
  AlertCircle,
  Calendar,
  ArrowUp,
  ArrowDown,
  Target,
  Clock,
  DollarSign,
} from "lucide-react";
import { formatCurrency } from "../lib/currency";

interface FinancialSummary {
  totalIncome: number;
  totalExpenses: number;
  balance: number;
  totalDebt: number;
}

interface RecentTransaction {
  id: string;
  type: "income" | "expense";
  amount: number;
  description: string;
  category?: string;
  date: string;
}

interface UpcomingPayment {
  id: string;
  creditor_name: string;
  amount: number;
  amount_paid: number;
  due_date: string;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<FinancialSummary>({
    totalIncome: 0,
    totalExpenses: 0,
    balance: 0,
    totalDebt: 0,
  });
  const [loading, setLoading] = useState(true);
  const [recentTransactions, setRecentTransactions] = useState<
    RecentTransaction[]
  >([]);
  const [upcomingPayments, setUpcomingPayments] = useState<UpcomingPayment[]>(
    []
  );
  const [previousMonthExpenses, setPreviousMonthExpenses] = useState(0);
  const [savingsRate, setSavingsRate] = useState(0);

  useEffect(() => {
    if (user) {
      loadFinancialSummary();

      // Refresh dashboard every 5 seconds when active
      const interval = setInterval(() => {
        loadFinancialSummary();
      }, 5000);

      return () => clearInterval(interval);
    }
  }, [user]);

  const loadFinancialSummary = async () => {
    if (!user) return;

    try {
      const currentMonth = new Date().toISOString().slice(0, 7);
      const previousMonth = new Date(
        new Date().setMonth(new Date().getMonth() - 1)
      )
        .toISOString()
        .slice(0, 7);

      const [
        incomeResult,
        expensesResult,
        debtsResult,
        prevExpensesResult,
        recentIncomeResult,
        recentExpensesResult,
        upcomingDebtsResult,
      ] = await Promise.all([
        supabase
          .from("income")
          .select("amount, type")
          .eq("user_id", user.id)
          .gte("date", `${currentMonth}-01`),
        supabase
          .from("expenses")
          .select("amount")
          .eq("user_id", user.id)
          .gte("date", `${currentMonth}-01`),
        supabase
          .from("debts")
          .select("amount, amount_paid")
          .eq("status", "active")
          .eq("user_id", user.id),
        supabase
          .from("expenses")
          .select("amount")
          .eq("user_id", user.id)
          .gte("date", `${previousMonth}-01`)
          .lt("date", `${currentMonth}-01`),
        supabase
          .from("income")
          .select("id, amount, description, date")
          .eq("user_id", user.id)
          .order("date", { ascending: false })
          .limit(3),
        supabase
          .from("expenses")
          .select("id, amount, description, category, date")
          .eq("user_id", user.id)
          .order("date", { ascending: false })
          .limit(3),
        supabase
          .from("debts")
          .select("id, creditor_name, amount, amount_paid, due_date")
          .eq("user_id", user.id)
          .neq("status", "cleared")
          .not("due_date", "is", null)
          .gte("due_date", new Date().toISOString().split("T")[0])
          .order("due_date", { ascending: true })
          .limit(3),
      ]);

      let totalIncome = 0;
      if (incomeResult.data) {
        incomeResult.data.forEach((income) => {
          if (income.type === "daily") {
            const daysInMonth = new Date(
              new Date().getFullYear(),
              new Date().getMonth() + 1,
              0
            ).getDate();
            totalIncome += Number(income.amount) * daysInMonth;
          } else {
            totalIncome += Number(income.amount);
          }
        });
      }

      const totalExpenses =
        expensesResult.data?.reduce(
          (sum, expense) => sum + Number(expense.amount),
          0
        ) || 0;

      const totalDebt =
        debtsResult.data?.reduce(
          (sum, debt) => sum + (Number(debt.amount) - Number(debt.amount_paid)),
          0
        ) || 0;

      const prevExpenses =
        prevExpensesResult.data?.reduce(
          (sum, expense) => sum + Number(expense.amount),
          0
        ) || 0;
      setPreviousMonthExpenses(prevExpenses);

      const balance = totalIncome - totalExpenses;
      const savings = totalIncome > 0 ? (balance / totalIncome) * 100 : 0;
      setSavingsRate(savings);

      // Combine recent transactions
      const incomeTransactions: RecentTransaction[] = (
        recentIncomeResult.data || []
      ).map((item) => ({
        id: item.id,
        type: "income" as const,
        amount: Number(item.amount),
        description: item.description || "Income",
        date: item.date,
      }));

      const expenseTransactions: RecentTransaction[] = (
        recentExpensesResult.data || []
      ).map((item) => ({
        id: item.id,
        type: "expense" as const,
        amount: Number(item.amount),
        description: item.description || "Expense",
        category: item.category,
        date: item.date,
      }));

      const allTransactions = [...incomeTransactions, ...expenseTransactions]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 5);

      setRecentTransactions(allTransactions);
      setUpcomingPayments(upcomingDebtsResult.data || []);

      setSummary({
        totalIncome,
        totalExpenses,
        balance: totalIncome - totalExpenses,
        totalDebt,
      });
    } catch (error) {
      console.error("Error loading financial summary:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading dashboard...</div>
      </div>
    );
  }

  const cards = [
    {
      title: "Total Income",
      value: formatCurrency(summary.totalIncome),
      icon: TrendingUp,
      color: "from-emerald-500 to-teal-600",
      textColor: "text-emerald-600",
    },
    {
      title: "Total Expenses",
      value: formatCurrency(summary.totalExpenses),
      icon: TrendingDown,
      color: "from-red-500 to-pink-600",
      textColor: "text-red-600",
    },
    {
      title: "Balance",
      value: formatCurrency(summary.balance),
      icon: Wallet,
      color:
        summary.balance >= 0
          ? "from-blue-500 to-cyan-600"
          : "from-orange-500 to-red-600",
      textColor: summary.balance >= 0 ? "text-blue-600" : "text-orange-600",
    },
    {
      title: "Total Debt",
      value: formatCurrency(summary.totalDebt),
      icon: CreditCard,
      color: "from-purple-500 to-pink-600",
      textColor: "text-purple-600",
    },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">
          Welcome, Yussuf Muse
        </h1>
        <p className="text-sm sm:text-base text-gray-600 mt-1">
          Your financial overview for this month
        </p>
      </div>

      {/* Stats Cards - Compact Mobile, Grid Desktop */}
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
        {cards.map((card, index) => {
          const Icon = card.icon;
          return (
            <div
              key={index}
              className="bg-white rounded-xl sm:rounded-2xl shadow-md hover:shadow-lg transition-all p-3 sm:p-5 md:p-6 border border-gray-100"
            >
              <div className="flex items-start justify-between mb-2 sm:mb-3">
                <div
                  className={`bg-gradient-to-br ${card.color} p-2 sm:p-2.5 md:p-3 rounded-lg sm:rounded-xl shadow-sm`}
                >
                  <Icon className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-white" />
                </div>
              </div>
              <h3 className="text-gray-600 text-[10px] sm:text-xs md:text-sm font-medium mb-1 truncate">
                {card.title}
              </h3>
              <p
                className={`text-base sm:text-xl md:text-2xl lg:text-3xl font-bold ${card.textColor} break-all leading-tight`}
              >
                {card.value}
              </p>
            </div>
          );
        })}
      </div>

      {/* Financial Progress */}
      <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg p-4 sm:p-6 border border-gray-100">
        <h2 className="text-lg sm:text-xl font-bold text-gray-800 mb-3 sm:mb-4">
          Financial Progress
        </h2>
        <div className="space-y-4 sm:space-y-5">
          <div>
            <div className="flex justify-between text-xs sm:text-sm mb-2">
              <span className="text-gray-700 font-medium">
                Expenses vs Income
              </span>
              <span className="text-gray-600 font-semibold">
                {summary.totalIncome > 0
                  ? `${(
                      (summary.totalExpenses / summary.totalIncome) *
                      100
                    ).toFixed(1)}%`
                  : "0%"}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5 sm:h-3 overflow-hidden">
              <div
                className="bg-gradient-to-r from-emerald-500 to-teal-600 h-2.5 sm:h-3 rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(
                    (summary.totalExpenses / summary.totalIncome) * 100,
                    100
                  )}%`,
                }}
              />
            </div>
          </div>

          {summary.totalDebt > 0 && (
            <div>
              <div className="flex justify-between text-xs sm:text-sm mb-2">
                <span className="text-gray-700 font-medium">
                  Debt to Income Ratio
                </span>
                <span className="text-gray-600 font-semibold">
                  {summary.totalIncome > 0
                    ? `${(
                        (summary.totalDebt / summary.totalIncome) *
                        100
                      ).toFixed(1)}%`
                    : "0%"}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5 sm:h-3 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-purple-500 to-pink-600 h-2.5 sm:h-3 rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(
                      (summary.totalDebt / summary.totalIncome) * 100,
                      100
                    )}%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quick Insights Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {/* Spending Comparison */}
        <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg p-4 sm:p-6 border border-gray-100">
          <div className="flex items-center gap-2 mb-3 sm:mb-4">
            <div className="bg-gradient-to-br from-blue-500 to-cyan-600 p-2 rounded-lg">
              <TrendingDown className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <h3 className="text-base sm:text-lg font-bold text-gray-800">
              Spending Trend
            </h3>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs sm:text-sm text-gray-600">
                This Month
              </span>
              <span className="text-sm sm:text-base font-bold text-gray-900">
                {formatCurrency(summary.totalExpenses)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs sm:text-sm text-gray-600">
                Last Month
              </span>
              <span className="text-sm sm:text-base font-medium text-gray-600">
                {formatCurrency(previousMonthExpenses)}
              </span>
            </div>
            {previousMonthExpenses > 0 && (
              <div className="pt-2 border-t border-gray-100">
                <div className="flex items-center gap-2">
                  {summary.totalExpenses > previousMonthExpenses ? (
                    <>
                      <ArrowUp className="w-4 h-4 text-red-600" />
                      <span className="text-xs sm:text-sm text-red-600 font-semibold">
                        +
                        {(
                          ((summary.totalExpenses - previousMonthExpenses) /
                            previousMonthExpenses) *
                          100
                        ).toFixed(1)}
                        % increase
                      </span>
                    </>
                  ) : (
                    <>
                      <ArrowDown className="w-4 h-4 text-emerald-600" />
                      <span className="text-xs sm:text-sm text-emerald-600 font-semibold">
                        {(
                          ((previousMonthExpenses - summary.totalExpenses) /
                            previousMonthExpenses) *
                          100
                        ).toFixed(1)}
                        % decrease
                      </span>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Savings Rate */}
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl sm:rounded-2xl shadow-lg p-4 sm:p-6 text-white">
          <div className="flex items-center gap-2 mb-3 sm:mb-4">
            <Target className="w-5 h-5 sm:w-6 sm:h-6" />
            <h3 className="text-base sm:text-lg font-bold">Savings Rate</h3>
          </div>
          <div className="space-y-2">
            <p className="text-3xl sm:text-4xl font-bold">
              {savingsRate.toFixed(1)}%
            </p>
            <p className="text-xs sm:text-sm opacity-90">
              {savingsRate >= 20
                ? "Excellent! Keep it up!"
                : savingsRate >= 10
                ? "Good progress!"
                : "Try to save more"}
            </p>
            <div className="pt-2 mt-2 border-t border-white/20">
              <div className="flex justify-between text-xs sm:text-sm">
                <span className="opacity-90">Amount Saved</span>
                <span className="font-bold">
                  {formatCurrency(summary.balance)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity & Upcoming Payments */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Recent Transactions */}
        <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
              <h3 className="text-base sm:text-lg font-bold text-gray-800">
                Recent Activity
              </h3>
            </div>
          </div>
          <div className="divide-y divide-gray-100">
            {recentTransactions.length === 0 ? (
              <div className="p-6 text-center text-sm text-gray-500">
                No recent transactions
              </div>
            ) : (
              recentTransactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="p-3 sm:p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2 sm:gap-3 flex-1 min-w-0">
                      <div
                        className={`p-1.5 sm:p-2 rounded-lg ${
                          transaction.type === "income"
                            ? "bg-emerald-100"
                            : "bg-red-100"
                        }`}
                      >
                        {transaction.type === "income" ? (
                          <ArrowDown className="w-3 h-3 sm:w-4 sm:h-4 text-emerald-600" />
                        ) : (
                          <ArrowUp className="w-3 h-3 sm:w-4 sm:h-4 text-red-600" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs sm:text-sm font-medium text-gray-900 truncate">
                          {transaction.description}
                        </p>
                        <p className="text-[10px] sm:text-xs text-gray-500">
                          {new Date(transaction.date).toLocaleDateString(
                            "en-KE",
                            {
                              month: "short",
                              day: "numeric",
                            }
                          )}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`text-xs sm:text-sm font-bold whitespace-nowrap ${
                        transaction.type === "income"
                          ? "text-emerald-600"
                          : "text-red-600"
                      }`}
                    >
                      {transaction.type === "income" ? "+" : "-"}
                      {formatCurrency(transaction.amount)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Upcoming Payments */}
        <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-gray-100 bg-gradient-to-r from-orange-50 to-amber-50">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-orange-600" />
              <h3 className="text-base sm:text-lg font-bold text-gray-800">
                Upcoming Debts
              </h3>
            </div>
          </div>
          <div className="divide-y divide-gray-100">
            {upcomingPayments.length === 0 ? (
              <div className="p-6 text-center text-sm text-gray-500">
                No upcoming debt payments
              </div>
            ) : (
              upcomingPayments.map((payment) => {
                const remaining =
                  Number(payment.amount) - Number(payment.amount_paid);
                const daysUntil = Math.ceil(
                  (new Date(payment.due_date).getTime() -
                    new Date().getTime()) /
                    (1000 * 60 * 60 * 24)
                );

                return (
                  <div
                    key={payment.id}
                    className="p-3 sm:p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs sm:text-sm font-medium text-gray-900 truncate">
                          {payment.creditor_name}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] sm:text-xs text-gray-500">
                            Due in {daysUntil}{" "}
                            {daysUntil === 1 ? "day" : "days"}
                          </span>
                          <span
                            className={`text-[10px] sm:text-xs px-1.5 py-0.5 rounded-full font-medium ${
                              daysUntil <= 7
                                ? "bg-red-100 text-red-700"
                                : "bg-amber-100 text-amber-700"
                            }`}
                          >
                            {daysUntil <= 7 ? "Urgent" : "Upcoming"}
                          </span>
                        </div>
                      </div>
                      <span className="text-xs sm:text-sm font-bold text-red-600 whitespace-nowrap">
                        {formatCurrency(remaining)}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

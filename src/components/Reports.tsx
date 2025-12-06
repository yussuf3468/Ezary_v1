import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import {
  FileText,
  TrendingUp,
  TrendingDown,
  Calendar,
  Download,
  Filter,
  BarChart3,
  DollarSign,
  ArrowUpCircle,
  ArrowDownCircle,
} from "lucide-react";
import { formatCurrency } from "../lib/currency";

interface CategoryData {
  category: string;
  amount: number;
  percentage: number;
  count: number;
}

interface DetailedTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  category?: string;
  type: "income" | "expense";
}

interface MonthlyData {
  month: string;
  income: number;
  expenses: number;
  balance: number;
}

type ReportPeriod = "current" | "last3" | "last6" | "year" | "custom";

export default function Reports() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [categoryData, setCategoryData] = useState<CategoryData[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [incomeTransactions, setIncomeTransactions] = useState<
    DetailedTransaction[]
  >([]);
  const [expenseTransactions, setExpenseTransactions] = useState<
    DetailedTransaction[]
  >([]);
  const [selectedPeriod, setSelectedPeriod] = useState<ReportPeriod>("current");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [totalIncome, setTotalIncome] = useState(0);
  const [totalExpenses, setTotalExpenses] = useState(0);

  useEffect(() => {
    if (user) {
      loadReports();
    }
  }, [user, selectedPeriod, customStartDate, customEndDate]);

  const getDateRange = () => {
    const today = new Date();
    let startDate = "";
    let endDate = today.toISOString().split("T")[0];

    switch (selectedPeriod) {
      case "current":
        startDate = `${today.getFullYear()}-${String(
          today.getMonth() + 1
        ).padStart(2, "0")}-01`;
        break;
      case "last3":
        const last3 = new Date(today.setMonth(today.getMonth() - 3));
        startDate = last3.toISOString().split("T")[0];
        endDate = new Date().toISOString().split("T")[0];
        break;
      case "last6":
        const last6 = new Date(today.setMonth(today.getMonth() - 6));
        startDate = last6.toISOString().split("T")[0];
        endDate = new Date().toISOString().split("T")[0];
        break;
      case "year":
        startDate = `${new Date().getFullYear()}-01-01`;
        break;
      case "custom":
        startDate = customStartDate;
        endDate = customEndDate;
        break;
    }

    return { startDate, endDate };
  };

  const loadReports = async () => {
    if (!user) return;
    if (selectedPeriod === "custom" && (!customStartDate || !customEndDate))
      return;

    setLoading(true);
    try {
      const { startDate, endDate } = getDateRange();

      // Fetch all data in parallel
      const [incomeResult, expensesResult] = await Promise.all([
        supabase
          .from("income")
          .select("*")
          .eq("user_id", user.id)
          .gte("date", startDate)
          .lte("date", endDate)
          .order("date", { ascending: false }),
        supabase
          .from("expenses")
          .select("*")
          .eq("user_id", user.id)
          .gte("date", startDate)
          .lte("date", endDate)
          .order("date", { ascending: false }),
      ]);

      // Process income
      const incomeData = incomeResult.data || [];
      const incomeTransactionsData: DetailedTransaction[] = incomeData.map(
        (item) => ({
          id: item.id,
          date: item.date,
          description: item.description || "Income",
          amount: Number(item.amount),
          type: "income" as const,
        })
      );
      setIncomeTransactions(incomeTransactionsData);

      const totalInc = incomeData.reduce(
        (sum, item) => sum + Number(item.amount),
        0
      );
      setTotalIncome(totalInc);

      // Process expenses
      const expenseData = expensesResult.data || [];
      const expenseTransactionsData: DetailedTransaction[] = expenseData.map(
        (item) => ({
          id: item.id,
          date: item.date,
          description: item.description || "Expense",
          amount: Number(item.amount),
          category: item.category,
          type: "expense" as const,
        })
      );
      setExpenseTransactions(expenseTransactionsData);

      const totalExp = expenseData.reduce(
        (sum, item) => sum + Number(item.amount),
        0
      );
      setTotalExpenses(totalExp);

      // Category breakdown
      const categoryTotals: Record<string, { amount: number; count: number }> =
        {};
      expenseData.forEach((expense) => {
        const cat = expense.category || "other";
        if (!categoryTotals[cat]) {
          categoryTotals[cat] = { amount: 0, count: 0 };
        }
        categoryTotals[cat].amount += Number(expense.amount);
        categoryTotals[cat].count += 1;
      });

      const categoryArray: CategoryData[] = Object.entries(categoryTotals).map(
        ([category, data]) => ({
          category,
          amount: data.amount,
          count: data.count,
          percentage: totalExp > 0 ? (data.amount / totalExp) * 100 : 0,
        })
      );
      categoryArray.sort((a, b) => b.amount - a.amount);
      setCategoryData(categoryArray);

      // Monthly trend
      const monthlyMap: Record<string, { income: number; expenses: number }> =
        {};

      incomeData.forEach((item) => {
        const month = item.date.slice(0, 7);
        if (!monthlyMap[month]) monthlyMap[month] = { income: 0, expenses: 0 };
        monthlyMap[month].income += Number(item.amount);
      });

      expenseData.forEach((item) => {
        const month = item.date.slice(0, 7);
        if (!monthlyMap[month]) monthlyMap[month] = { income: 0, expenses: 0 };
        monthlyMap[month].expenses += Number(item.amount);
      });

      const monthlyArray: MonthlyData[] = Object.entries(monthlyMap)
        .map(([month, data]) => ({
          month,
          income: data.income,
          expenses: data.expenses,
          balance: data.income - data.expenses,
        }))
        .sort((a, b) => a.month.localeCompare(b.month));

      setMonthlyData(monthlyArray);
    } catch (error) {
      console.error("Error loading reports:", error);
    } finally {
      setLoading(false);
    }
  };

  const exportToPDF = () => {
    const { startDate, endDate } = getDateRange();
    const balance = totalIncome - totalExpenses;

    // Create HTML content for PDF
    let htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Financial Report - ${startDate} to ${endDate}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; color: #333; }
          h1 { color: #059669; border-bottom: 3px solid #059669; padding-bottom: 10px; }
          h2 { color: #0891b2; margin-top: 30px; }
          .summary { background: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-top: 15px; }
          .summary-item { text-align: center; }
          .summary-label { font-size: 12px; color: #666; }
          .summary-value { font-size: 24px; font-weight: bold; margin-top: 5px; }
          .income { color: #059669; }
          .expense { color: #dc2626; }
          .balance { color: ${balance >= 0 ? "#0891b2" : "#f59e0b"}; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th { background: #f3f4f6; padding: 12px; text-align: left; border-bottom: 2px solid #d1d5db; }
          td { padding: 10px; border-bottom: 1px solid #e5e7eb; }
          tr:hover { background: #f9fafb; }
          .footer { margin-top: 40px; text-align: center; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <h1>Financial Report</h1>
        <p><strong>Period:</strong> ${new Date(startDate).toLocaleDateString(
          "en-KE"
        )} - ${new Date(endDate).toLocaleDateString("en-KE")}</p>
        <p><strong>Generated:</strong> ${new Date().toLocaleDateString(
          "en-KE"
        )} ${new Date().toLocaleTimeString("en-KE")}</p>
        
        <div class="summary">
          <h2 style="margin-top: 0;">Financial Summary</h2>
          <div class="summary-grid">
            <div class="summary-item">
              <div class="summary-label">Total Income</div>
              <div class="summary-value income">${formatCurrency(
                totalIncome
              )}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Total Expenses</div>
              <div class="summary-value expense">${formatCurrency(
                totalExpenses
              )}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Net Balance</div>
              <div class="summary-value balance">${formatCurrency(
                balance
              )}</div>
            </div>
          </div>
        </div>

        <h2>Expense Breakdown by Category</h2>
        <table>
          <thead>
            <tr>
              <th>Category</th>
              <th>Amount</th>
              <th>Transactions</th>
              <th>Percentage</th>
            </tr>
          </thead>
          <tbody>
            ${categoryData
              .map(
                (cat) => `
              <tr>
                <td style="text-transform: capitalize;">${cat.category.replace(
                  "_",
                  " "
                )}</td>
                <td>${formatCurrency(cat.amount)}</td>
                <td>${cat.count}</td>
                <td>${cat.percentage.toFixed(1)}%</td>
              </tr>
            `
              )
              .join("")}
          </tbody>
        </table>

        <h2>Income Transactions (${incomeTransactions.length})</h2>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Description</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            ${incomeTransactions
              .map(
                (t) => `
              <tr>
                <td>${new Date(t.date).toLocaleDateString("en-KE")}</td>
                <td>${t.description}</td>
                <td class="income">${formatCurrency(t.amount)}</td>
              </tr>
            `
              )
              .join("")}
          </tbody>
        </table>

        <h2>Expense Transactions (${expenseTransactions.length})</h2>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Description</th>
              <th>Category</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            ${expenseTransactions
              .map(
                (t) => `
              <tr>
                <td>${new Date(t.date).toLocaleDateString("en-KE")}</td>
                <td>${t.description}</td>
                <td style="text-transform: capitalize;">${(
                  t.category || "other"
                ).replace("_", " ")}</td>
                <td class="expense">${formatCurrency(t.amount)}</td>
              </tr>
            `
              )
              .join("")}
          </tbody>
        </table>

        ${
          monthlyData.length > 0
            ? `
          <h2>Monthly Trend</h2>
          <table>
            <thead>
              <tr>
                <th>Month</th>
                <th>Income</th>
                <th>Expenses</th>
                <th>Balance</th>
              </tr>
            </thead>
            <tbody>
              ${monthlyData
                .map(
                  (m) => `
                <tr>
                  <td>${new Date(m.month + "-01").toLocaleDateString("en-US", {
                    month: "short",
                    year: "numeric",
                  })}</td>
                  <td class="income">${formatCurrency(m.income)}</td>
                  <td class="expense">${formatCurrency(m.expenses)}</td>
                  <td class="${
                    m.balance >= 0 ? "income" : "expense"
                  }">${formatCurrency(m.balance)}</td>
                </tr>
              `
                )
                .join("")}
            </tbody>
          </table>
        `
            : ""
        }

        <div class="footer">
          <p>MyFinance - Personal Finance Manager</p>
          <p>This report is confidential and for your personal use only.</p>
        </div>
      </body>
      </html>
    `;

    // Create blob and download
    const blob = new Blob([htmlContent], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `financial-report-${startDate}-to-${endDate}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getCategoryColor = (index: number) => {
    const colors = [
      "bg-red-500",
      "bg-blue-500",
      "bg-emerald-500",
      "bg-amber-500",
      "bg-purple-500",
      "bg-teal-500",
      "bg-indigo-500",
      "bg-pink-500",
      "bg-cyan-500",
      "bg-orange-500",
    ];
    return colors[index % colors.length];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading reports...</div>
      </div>
    );
  }

  const balance = totalIncome - totalExpenses;
  const savingsRate = totalIncome > 0 ? (balance / totalIncome) * 100 : 0;

  return (
    <div className="space-y-4 sm:space-y-6 pb-20 sm:pb-6">
      {/* Header with Export */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 bg-gradient-to-r from-teal-500 to-cyan-600 p-4 sm:p-6 rounded-xl text-white shadow-lg">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6 sm:h-8 sm:w-8" />
            Financial Reports
          </h2>
          <p className="text-teal-50 text-sm mt-1">
            Comprehensive financial analysis and insights
          </p>
        </div>
        <button
          onClick={exportToPDF}
          className="flex items-center gap-2 bg-white text-teal-600 px-4 py-2 rounded-lg hover:bg-teal-50 transition-colors font-semibold shadow-md"
        >
          <Download className="h-5 w-5" />
          Export Report
        </button>
      </div>

      {/* Period Filter */}
      <div className="bg-white rounded-xl shadow-md p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="h-5 w-5 text-gray-600" />
          <h3 className="font-semibold text-gray-900">Report Period</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-3">
          <button
            onClick={() => setSelectedPeriod("current")}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedPeriod === "current"
                ? "bg-teal-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            This Month
          </button>
          <button
            onClick={() => setSelectedPeriod("last3")}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedPeriod === "last3"
                ? "bg-teal-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Last 3 Months
          </button>
          <button
            onClick={() => setSelectedPeriod("last6")}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedPeriod === "last6"
                ? "bg-teal-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Last 6 Months
          </button>
          <button
            onClick={() => setSelectedPeriod("year")}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedPeriod === "year"
                ? "bg-teal-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            This Year
          </button>
          <button
            onClick={() => setSelectedPeriod("custom")}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedPeriod === "custom"
                ? "bg-teal-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Custom
          </button>
        </div>

        {selectedPeriod === "custom" && (
          <div className="grid grid-cols-2 gap-3 mt-3 p-3 bg-gray-50 rounded-lg">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Date
              </label>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-4 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <ArrowUpCircle className="h-8 w-8 opacity-80" />
          </div>
          <p className="text-emerald-100 text-xs sm:text-sm">Total Income</p>
          <p className="text-xl sm:text-2xl font-bold mt-1">
            {formatCurrency(totalIncome)}
          </p>
          <p className="text-xs text-emerald-100 mt-1">
            {incomeTransactions.length} transactions
          </p>
        </div>

        <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl p-4 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <ArrowDownCircle className="h-8 w-8 opacity-80" />
          </div>
          <p className="text-red-100 text-xs sm:text-sm">Total Expenses</p>
          <p className="text-xl sm:text-2xl font-bold mt-1">
            {formatCurrency(totalExpenses)}
          </p>
          <p className="text-xs text-red-100 mt-1">
            {expenseTransactions.length} transactions
          </p>
        </div>

        <div
          className={`bg-gradient-to-br ${
            balance >= 0
              ? "from-cyan-500 to-cyan-600"
              : "from-amber-500 to-amber-600"
          } rounded-xl p-4 text-white shadow-lg`}
        >
          <div className="flex items-center justify-between mb-2">
            <DollarSign className="h-8 w-8 opacity-80" />
          </div>
          <p className="text-white/90 text-xs sm:text-sm">Net Balance</p>
          <p className="text-xl sm:text-2xl font-bold mt-1">
            {formatCurrency(balance)}
          </p>
          <p className="text-xs text-white/80 mt-1">
            {balance >= 0 ? "Surplus" : "Deficit"}
          </p>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-4 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <BarChart3 className="h-8 w-8 opacity-80" />
          </div>
          <p className="text-purple-100 text-xs sm:text-sm">Savings Rate</p>
          <p className="text-xl sm:text-2xl font-bold mt-1">
            {savingsRate.toFixed(1)}%
          </p>
          <div className="w-full bg-purple-400/30 rounded-full h-2 mt-2">
            <div
              className="bg-white rounded-full h-2 transition-all duration-300"
              style={{ width: `${Math.min(Math.max(savingsRate, 0), 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Category Breakdown */}
      {categoryData.length > 0 && (
        <div className="bg-white rounded-xl shadow-md p-4 sm:p-6">
          <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 sm:h-6 sm:w-6 text-teal-600" />
            Expense Breakdown by Category
          </h3>

          {/* Mobile: Cards */}
          <div className="block sm:hidden space-y-3">
            {categoryData.map((cat, index) => (
              <div key={cat.category} className="bg-gray-50 rounded-lg p-3">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-3 h-3 rounded-full ${getCategoryColor(
                          index
                        )}`}
                      />
                      <span className="font-medium text-gray-900 capitalize">
                        {cat.category.replace("_", " ")}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {cat.count} transactions
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-900">
                      {formatCurrency(cat.amount)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {cat.percentage.toFixed(1)}%
                    </p>
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`${getCategoryColor(
                      index
                    )} rounded-full h-2 transition-all duration-300`}
                    style={{ width: `${cat.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Desktop: Table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">
                    Category
                  </th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">
                    Amount
                  </th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700">
                    Transactions
                  </th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">
                    Percentage
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">
                    Distribution
                  </th>
                </tr>
              </thead>
              <tbody>
                {categoryData.map((cat, index) => (
                  <tr
                    key={cat.category}
                    className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-3 h-3 rounded-full ${getCategoryColor(
                            index
                          )}`}
                        />
                        <span className="font-medium capitalize">
                          {cat.category.replace("_", " ")}
                        </span>
                      </div>
                    </td>
                    <td className="text-right py-3 px-4 font-semibold">
                      {formatCurrency(cat.amount)}
                    </td>
                    <td className="text-center py-3 px-4 text-gray-600">
                      {cat.count}
                    </td>
                    <td className="text-right py-3 px-4 text-gray-600">
                      {cat.percentage.toFixed(1)}%
                    </td>
                    <td className="py-3 px-4">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`${getCategoryColor(
                            index
                          )} rounded-full h-2 transition-all duration-300`}
                          style={{ width: `${cat.percentage}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Monthly Trend */}
      {monthlyData.length > 0 && (
        <div className="bg-white rounded-xl shadow-md p-4 sm:p-6">
          <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-teal-600" />
            Monthly Trend
          </h3>

          {/* Mobile: Cards */}
          <div className="block sm:hidden space-y-3">
            {monthlyData.map((month) => (
              <div
                key={month.month}
                className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg p-3"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="h-4 w-4 text-gray-600" />
                  <span className="font-semibold text-gray-900">
                    {new Date(month.month + "-01").toLocaleDateString("en-US", {
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-xs text-gray-600">Income</p>
                    <p className="text-sm font-bold text-emerald-600">
                      {formatCurrency(month.income)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">Expenses</p>
                    <p className="text-sm font-bold text-red-600">
                      {formatCurrency(month.expenses)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">Balance</p>
                    <p
                      className={`text-sm font-bold ${
                        month.balance >= 0 ? "text-cyan-600" : "text-amber-600"
                      }`}
                    >
                      {formatCurrency(month.balance)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop: Chart */}
          <div className="hidden sm:block space-y-6">
            <div className="space-y-4">
              {monthlyData.map((month) => {
                const maxValue = Math.max(
                  ...monthlyData.map((m) => Math.max(m.income, m.expenses))
                );
                return (
                  <div key={month.month} className="space-y-1">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-gray-600 w-24">
                        {new Date(month.month + "-01").toLocaleDateString(
                          "en-US",
                          { month: "short", year: "numeric" }
                        )}
                      </span>
                      <div className="flex-1 flex gap-2">
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <div
                              className="bg-gradient-to-r from-emerald-500 to-emerald-600 h-6 rounded transition-all duration-300 flex items-center justify-end pr-2"
                              style={{
                                width: `${
                                  maxValue > 0
                                    ? (month.income / maxValue) * 100
                                    : 0
                                }%`,
                              }}
                            >
                              <span className="text-xs text-white font-medium">
                                {month.income > 0 &&
                                  formatCurrency(month.income)}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div
                              className="bg-gradient-to-r from-red-500 to-red-600 h-6 rounded transition-all duration-300 flex items-center justify-end pr-2"
                              style={{
                                width: `${
                                  maxValue > 0
                                    ? (month.expenses / maxValue) * 100
                                    : 0
                                }%`,
                              }}
                            >
                              <span className="text-xs text-white font-medium">
                                {month.expenses > 0 &&
                                  formatCurrency(month.expenses)}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="w-32 flex items-center justify-end">
                          <span
                            className={`text-sm font-bold ${
                              month.balance >= 0
                                ? "text-emerald-600"
                                : "text-red-600"
                            }`}
                          >
                            {month.balance >= 0 ? "+" : ""}
                            {formatCurrency(month.balance)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-center gap-6 pt-4 border-t border-gray-200">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-gradient-to-r from-emerald-500 to-emerald-600 rounded" />
                <span className="text-sm text-gray-600">Income</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-gradient-to-r from-red-500 to-red-600 rounded" />
                <span className="text-sm text-gray-600">Expenses</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recent Transactions Summary */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl shadow-md p-4 sm:p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
            <ArrowUpCircle className="h-5 w-5 text-emerald-600" />
            Recent Income ({Math.min(incomeTransactions.length, 5)})
          </h3>
          <div className="space-y-2">
            {incomeTransactions.slice(0, 5).map((transaction) => (
              <div
                key={transaction.id}
                className="flex justify-between items-center p-2 bg-emerald-50 rounded-lg"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate text-sm">
                    {transaction.description}
                  </p>
                  <p className="text-xs text-gray-500">
                    {new Date(transaction.date).toLocaleDateString("en-KE")}
                  </p>
                </div>
                <span className="text-sm font-bold text-emerald-600 ml-2">
                  {formatCurrency(transaction.amount)}
                </span>
              </div>
            ))}
            {incomeTransactions.length === 0 && (
              <p className="text-gray-500 text-sm text-center py-4">
                No income transactions in this period
              </p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md p-4 sm:p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
            <ArrowDownCircle className="h-5 w-5 text-red-600" />
            Recent Expenses ({Math.min(expenseTransactions.length, 5)})
          </h3>
          <div className="space-y-2">
            {expenseTransactions.slice(0, 5).map((transaction) => (
              <div
                key={transaction.id}
                className="flex justify-between items-center p-2 bg-red-50 rounded-lg"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate text-sm">
                    {transaction.description}
                  </p>
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-gray-500">
                      {new Date(transaction.date).toLocaleDateString("en-KE")}
                    </p>
                    <span className="text-xs text-gray-400">•</span>
                    <p className="text-xs text-gray-500 capitalize">
                      {transaction.category?.replace("_", " ")}
                    </p>
                  </div>
                </div>
                <span className="text-sm font-bold text-red-600 ml-2">
                  {formatCurrency(transaction.amount)}
                </span>
              </div>
            ))}
            {expenseTransactions.length === 0 && (
              <p className="text-gray-500 text-sm text-center py-4">
                No expense transactions in this period
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

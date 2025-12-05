import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { PieChart, TrendingUp, TrendingDown, Calendar } from 'lucide-react';

interface CategoryData {
  category: string;
  amount: number;
  percentage: number;
}

interface MonthlyData {
  month: string;
  income: number;
  expenses: number;
}

export default function Reports() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [categoryData, setCategoryData] = useState<CategoryData[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));

  useEffect(() => {
    if (user) {
      loadReports();
    }
  }, [user, selectedMonth]);

  const loadReports = async () => {
    if (!user) return;

    try {
      const { data: expenses, error: expensesError } = await supabase
        .from('expenses')
        .select('category, amount')
        .eq('user_id', user.id)
        .gte('date', `${selectedMonth}-01`)
        .lt('date', getNextMonth(selectedMonth));

      if (expensesError) throw expensesError;

      const categoryTotals = expenses?.reduce((acc, expense) => {
        const category = expense.category;
        acc[category] = (acc[category] || 0) + Number(expense.amount);
        return acc;
      }, {} as Record<string, number>) || {};

      const totalExpenses = Object.values(categoryTotals).reduce((sum, val) => sum + val, 0);

      const categoryDataArray: CategoryData[] = Object.entries(categoryTotals).map(([category, amount]) => ({
        category,
        amount,
        percentage: totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0,
      }));

      categoryDataArray.sort((a, b) => b.amount - a.amount);
      setCategoryData(categoryDataArray);

      const last6Months = getLast6Months();
      const monthlyDataPromises = last6Months.map(async (month) => {
        const [incomeResult, expensesResult] = await Promise.all([
          supabase
            .from('income')
            .select('amount, type')
            .eq('user_id', user.id)
            .gte('date', `${month}-01`)
            .lt('date', getNextMonth(month)),
          supabase
            .from('expenses')
            .select('amount')
            .eq('user_id', user.id)
            .gte('date', `${month}-01`)
            .lt('date', getNextMonth(month)),
        ]);

        let income = 0;
        if (incomeResult.data) {
          incomeResult.data.forEach((inc) => {
            if (inc.type === 'daily') {
              const daysInMonth = new Date(
                parseInt(month.split('-')[0]),
                parseInt(month.split('-')[1]),
                0
              ).getDate();
              income += Number(inc.amount) * daysInMonth;
            } else {
              income += Number(inc.amount);
            }
          });
        }

        const expenses = expensesResult.data?.reduce(
          (sum, exp) => sum + Number(exp.amount),
          0
        ) || 0;

        return { month, income, expenses };
      });

      const monthlyResults = await Promise.all(monthlyDataPromises);
      setMonthlyData(monthlyResults);
    } catch (error) {
      console.error('Error loading reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const getNextMonth = (month: string) => {
    const [year, monthNum] = month.split('-').map(Number);
    const date = new Date(year, monthNum, 1);
    return date.toISOString().slice(0, 7);
  };

  const getLast6Months = () => {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      months.push(date.toISOString().slice(0, 7));
    }
    return months;
  };

  const getCategoryColor = (index: number) => {
    const colors = [
      'from-red-500 to-pink-600',
      'from-blue-500 to-cyan-600',
      'from-emerald-500 to-teal-600',
      'from-amber-500 to-orange-600',
      'from-purple-500 to-pink-600',
      'from-teal-500 to-cyan-600',
      'from-indigo-500 to-blue-600',
    ];
    return colors[index % colors.length];
  };

  const formatMonth = (month: string) => {
    const date = new Date(month + '-01');
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  if (loading) {
    return <div className="text-gray-500">Loading reports...</div>;
  }

  const topCategory = categoryData.length > 0 ? categoryData[0] : null;
  const totalExpenses = categoryData.reduce((sum, cat) => sum + cat.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Reports & Analytics</h1>
          <p className="text-gray-600 mt-1">Visualize your financial data</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Select Month</label>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
          />
        </div>
      </div>

      {topCategory && (
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-6">
          <div className="flex items-start gap-4">
            <div className="bg-amber-100 p-3 rounded-xl">
              <TrendingUp className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <h3 className="font-bold text-amber-900 text-lg mb-1">Top Spending Category</h3>
              <p className="text-amber-700">
                You spent the most on{' '}
                <span className="font-bold">{topCategory.category}</span> this month:{' '}
                <span className="font-bold">${topCategory.amount.toFixed(2)}</span> (
                {topCategory.percentage.toFixed(1)}% of total expenses)
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-gradient-to-br from-blue-500 to-cyan-600 p-2 rounded-lg">
            <PieChart className="w-5 h-5 text-white" />
          </div>
          <h2 className="text-xl font-bold text-gray-800">Spending by Category</h2>
        </div>

        {categoryData.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            No expense data available for this month
          </div>
        ) : (
          <div className="space-y-4">
            {categoryData.map((category, index) => (
              <div key={category.category} className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-gray-700 font-medium capitalize">
                    {category.category}
                  </span>
                  <div className="text-right">
                    <span className="text-gray-900 font-bold">
                      ${category.amount.toFixed(2)}
                    </span>
                    <span className="text-gray-500 text-sm ml-2">
                      {category.percentage.toFixed(1)}%
                    </span>
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div
                    className={`bg-gradient-to-r ${getCategoryColor(index)} h-3 rounded-full transition-all duration-500`}
                    style={{ width: `${category.percentage}%` }}
                  />
                </div>
              </div>
            ))}
            <div className="pt-4 border-t border-gray-200 mt-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-800 font-bold text-lg">Total Expenses</span>
                <span className="text-red-600 font-bold text-2xl">
                  ${totalExpenses.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-2 rounded-lg">
            <Calendar className="w-5 h-5 text-white" />
          </div>
          <h2 className="text-xl font-bold text-gray-800">6-Month Trend</h2>
        </div>

        <div className="space-y-6">
          {monthlyData.map((data, index) => {
            const netIncome = data.income - data.expenses;
            const maxValue = Math.max(...monthlyData.map(d => Math.max(d.income, d.expenses)));

            return (
              <div key={data.month} className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-gray-700 font-medium">{formatMonth(data.month)}</span>
                  <span className={`font-bold ${netIncome >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {netIncome >= 0 ? '+' : ''}${netIncome.toFixed(2)}
                  </span>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-600" />
                    <div className="flex-1">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-600">Income</span>
                        <span className="text-emerald-600 font-medium">
                          ${data.income.toFixed(2)}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-emerald-500 to-teal-600 h-2 rounded-full transition-all duration-500"
                          style={{ width: `${(data.income / maxValue) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <TrendingDown className="w-4 h-4 text-red-600" />
                    <div className="flex-1">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-600">Expenses</span>
                        <span className="text-red-600 font-medium">
                          ${data.expenses.toFixed(2)}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-red-500 to-pink-600 h-2 rounded-full transition-all duration-500"
                          style={{ width: `${(data.expenses / maxValue) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

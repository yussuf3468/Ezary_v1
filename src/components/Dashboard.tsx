import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { TrendingUp, TrendingDown, Wallet, CreditCard, AlertCircle } from 'lucide-react';

interface FinancialSummary {
  totalIncome: number;
  totalExpenses: number;
  balance: number;
  totalDebt: number;
  monthlyRent: number;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<FinancialSummary>({
    totalIncome: 0,
    totalExpenses: 0,
    balance: 0,
    totalDebt: 0,
    monthlyRent: 0,
  });
  const [loading, setLoading] = useState(true);
  const [rentDue, setRentDue] = useState(false);

  useEffect(() => {
    if (user) {
      loadFinancialSummary();
    }
  }, [user]);

  const loadFinancialSummary = async () => {
    if (!user) return;

    try {
      const currentMonth = new Date().toISOString().slice(0, 7);

      const [incomeResult, expensesResult, debtsResult, rentResult] = await Promise.all([
        supabase
          .from('income')
          .select('amount, type')
          .eq('user_id', user.id)
          .gte('date', `${currentMonth}-01`),
        supabase
          .from('expenses')
          .select('amount')
          .eq('user_id', user.id)
          .gte('date', `${currentMonth}-01`),
        supabase
          .from('debts')
          .select('amount, amount_paid')
          .eq('user_id', user.id)
          .neq('status', 'cleared'),
        supabase
          .from('rent_settings')
          .select('monthly_amount, due_day')
          .eq('user_id', user.id)
          .maybeSingle(),
      ]);

      let totalIncome = 0;
      if (incomeResult.data) {
        incomeResult.data.forEach((income) => {
          if (income.type === 'daily') {
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

      const totalExpenses = expensesResult.data?.reduce(
        (sum, expense) => sum + Number(expense.amount),
        0
      ) || 0;

      const totalDebt = debtsResult.data?.reduce(
        (sum, debt) => sum + (Number(debt.amount) - Number(debt.amount_paid)),
        0
      ) || 0;

      const monthlyRent = rentResult.data ? Number(rentResult.data.monthly_amount) : 0;

      if (rentResult.data) {
        const today = new Date();
        const dueDay = rentResult.data.due_day;
        const currentDay = today.getDate();
        setRentDue(currentDay >= dueDay);
      }

      setSummary({
        totalIncome,
        totalExpenses,
        balance: totalIncome - totalExpenses,
        totalDebt,
        monthlyRent,
      });
    } catch (error) {
      console.error('Error loading financial summary:', error);
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
      title: 'Total Income',
      value: `$${summary.totalIncome.toFixed(2)}`,
      icon: TrendingUp,
      color: 'from-emerald-500 to-teal-600',
      textColor: 'text-emerald-600',
    },
    {
      title: 'Total Expenses',
      value: `$${summary.totalExpenses.toFixed(2)}`,
      icon: TrendingDown,
      color: 'from-red-500 to-pink-600',
      textColor: 'text-red-600',
    },
    {
      title: 'Balance',
      value: `$${summary.balance.toFixed(2)}`,
      icon: Wallet,
      color: summary.balance >= 0 ? 'from-blue-500 to-cyan-600' : 'from-orange-500 to-red-600',
      textColor: summary.balance >= 0 ? 'text-blue-600' : 'text-orange-600',
    },
    {
      title: 'Total Debt',
      value: `$${summary.totalDebt.toFixed(2)}`,
      icon: CreditCard,
      color: 'from-purple-500 to-pink-600',
      textColor: 'text-purple-600',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-800">Dashboard</h1>
        <p className="text-gray-600 mt-1">Your financial overview for this month</p>
      </div>

      {rentDue && summary.monthlyRent > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start">
          <AlertCircle className="w-5 h-5 text-amber-600 mr-3 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-amber-900">Rent Payment Due</h3>
            <p className="text-sm text-amber-700 mt-1">
              Your monthly rent of ${summary.monthlyRent.toFixed(2)} is due this month.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card, index) => {
          const Icon = card.icon;
          return (
            <div
              key={index}
              className="bg-white rounded-xl shadow-lg hover:shadow-xl transition p-6 border border-gray-100"
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`bg-gradient-to-br ${card.color} p-3 rounded-xl`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
              </div>
              <h3 className="text-gray-600 text-sm font-medium mb-1">{card.title}</h3>
              <p className={`text-3xl font-bold ${card.textColor}`}>{card.value}</p>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Financial Progress</h2>
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-700 font-medium">Expenses vs Income</span>
              <span className="text-gray-600">
                {summary.totalIncome > 0
                  ? `${((summary.totalExpenses / summary.totalIncome) * 100).toFixed(1)}%`
                  : '0%'}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <div
                className="bg-gradient-to-r from-emerald-500 to-teal-600 h-3 rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min((summary.totalExpenses / summary.totalIncome) * 100, 100)}%`,
                }}
              />
            </div>
          </div>

          {summary.totalDebt > 0 && (
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-700 font-medium">Debt to Income Ratio</span>
                <span className="text-gray-600">
                  {summary.totalIncome > 0
                    ? `${((summary.totalDebt / summary.totalIncome) * 100).toFixed(1)}%`
                    : '0%'}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-purple-500 to-pink-600 h-3 rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min((summary.totalDebt / summary.totalIncome) * 100, 100)}%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

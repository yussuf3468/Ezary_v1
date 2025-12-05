import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Trash2, Calendar } from 'lucide-react';

interface IncomeRecord {
  id: string;
  amount: number;
  description: string;
  type: 'daily' | 'monthly';
  date: string;
}

export default function Income() {
  const { user } = useAuth();
  const [incomes, setIncomes] = useState<IncomeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    amount: '',
    description: '',
    type: 'monthly' as 'daily' | 'monthly',
    date: new Date().toISOString().split('T')[0],
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
        .from('income')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false });

      if (error) throw error;
      setIncomes(data || []);
    } catch (error) {
      console.error('Error loading incomes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const { error } = await supabase.from('income').insert({
        user_id: user.id,
        amount: Number(formData.amount),
        description: formData.description,
        type: formData.type,
        date: formData.date,
      });

      if (error) throw error;

      setFormData({
        amount: '',
        description: '',
        type: 'monthly',
        date: new Date().toISOString().split('T')[0],
      });
      setShowForm(false);
      loadIncomes();
    } catch (error) {
      console.error('Error adding income:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this income record?')) return;

    try {
      const { error } = await supabase.from('income').delete().eq('id', id);
      if (error) throw error;
      loadIncomes();
    } catch (error) {
      console.error('Error deleting income:', error);
    }
  };

  if (loading) {
    return <div className="text-gray-500">Loading...</div>;
  }

  const totalMonthlyIncome = incomes.reduce((sum, income) => {
    if (income.type === 'daily') {
      const daysInMonth = 30;
      return sum + Number(income.amount) * daysInMonth;
    }
    return sum + Number(income.amount);
  }, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Income Tracker</h1>
          <p className="text-gray-600 mt-1">Track your income sources</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-lg hover:from-emerald-600 hover:to-teal-700 transition shadow-lg hover:shadow-xl"
        >
          <Plus className="w-5 h-5 mr-2" />
          Add Income
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
        <div className="text-center">
          <p className="text-gray-600 text-sm font-medium mb-2">Estimated Monthly Income</p>
          <p className="text-4xl font-bold text-emerald-600">${totalMonthlyIncome.toFixed(2)}</p>
        </div>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Add New Income</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as 'daily' | 'monthly' })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                >
                  <option value="monthly">Monthly</option>
                  <option value="daily">Daily</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                placeholder="e.g., Salary, Freelance work"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-600 text-white py-2 rounded-lg hover:from-emerald-600 hover:to-teal-700 transition shadow-lg"
              >
                Add Income
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-800">Income Records</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {incomes.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No income records yet. Add your first income!
            </div>
          ) : (
            incomes.map((income) => (
              <div key={income.id} className="p-4 hover:bg-gray-50 transition">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <div className="bg-emerald-100 p-2 rounded-lg">
                        <Calendar className="w-5 h-5 text-emerald-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-800">
                          ${Number(income.amount).toFixed(2)}{' '}
                          <span className="text-sm font-normal text-gray-500">
                            / {income.type}
                          </span>
                        </p>
                        <p className="text-sm text-gray-600">{income.description || 'No description'}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(income.date).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(income.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Trash2, ShoppingBag, Home, Car, Zap, Film, Heart, Tag } from 'lucide-react';

interface ExpenseRecord {
  id: string;
  amount: number;
  category: string;
  description: string;
  date: string;
}

const categories = [
  { value: 'food', label: 'Food', icon: ShoppingBag },
  { value: 'rent', label: 'Rent', icon: Home },
  { value: 'transport', label: 'Transport', icon: Car },
  { value: 'utilities', label: 'Utilities', icon: Zap },
  { value: 'entertainment', label: 'Entertainment', icon: Film },
  { value: 'healthcare', label: 'Healthcare', icon: Heart },
  { value: 'other', label: 'Other', icon: Tag },
];

export default function Expenses() {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [formData, setFormData] = useState({
    amount: '',
    category: 'food',
    description: '',
    date: new Date().toISOString().split('T')[0],
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
        .from('expenses')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false });

      if (error) throw error;
      setExpenses(data || []);
    } catch (error) {
      console.error('Error loading expenses:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const { error } = await supabase.from('expenses').insert({
        user_id: user.id,
        amount: Number(formData.amount),
        category: formData.category,
        description: formData.description,
        date: formData.date,
      });

      if (error) throw error;

      setFormData({
        amount: '',
        category: 'food',
        description: '',
        date: new Date().toISOString().split('T')[0],
      });
      setShowForm(false);
      loadExpenses();
    } catch (error) {
      console.error('Error adding expense:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this expense?')) return;

    try {
      const { error } = await supabase.from('expenses').delete().eq('id', id);
      if (error) throw error;
      loadExpenses();
    } catch (error) {
      console.error('Error deleting expense:', error);
    }
  };

  if (loading) {
    return <div className="text-gray-500">Loading...</div>;
  }

  const filteredExpenses = filterCategory === 'all'
    ? expenses
    : expenses.filter((e) => e.category === filterCategory);

  const totalExpenses = filteredExpenses.reduce((sum, expense) => sum + Number(expense.amount), 0);

  const getCategoryIcon = (category: string) => {
    const cat = categories.find((c) => c.value === category);
    return cat ? cat.icon : Tag;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Expense Tracker</h1>
          <p className="text-gray-600 mt-1">Monitor your spending habits</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center px-4 py-2 bg-gradient-to-r from-red-500 to-pink-600 text-white rounded-lg hover:from-red-600 hover:to-pink-700 transition shadow-lg hover:shadow-xl"
        >
          <Plus className="w-5 h-5 mr-2" />
          Add Expense
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
        <div className="text-center">
          <p className="text-gray-600 text-sm font-medium mb-2">Total Expenses</p>
          <p className="text-4xl font-bold text-red-600">${totalExpenses.toFixed(2)}</p>
        </div>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Add New Expense</h2>
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
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
                placeholder="e.g., Grocery shopping"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 bg-gradient-to-r from-red-500 to-pink-600 text-white py-2 rounded-lg hover:from-red-600 hover:to-pink-700 transition shadow-lg"
              >
                Add Expense
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

      <div className="bg-white rounded-xl shadow-lg p-4 border border-gray-100">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilterCategory('all')}
            className={`px-4 py-2 rounded-lg transition ${
              filterCategory === 'all'
                ? 'bg-gradient-to-r from-red-500 to-pink-600 text-white shadow-md'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setFilterCategory(cat.value)}
              className={`px-4 py-2 rounded-lg transition ${
                filterCategory === cat.value
                  ? 'bg-gradient-to-r from-red-500 to-pink-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-800">Expense Records</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {filteredExpenses.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No expenses found. Start tracking your spending!
            </div>
          ) : (
            filteredExpenses.map((expense) => {
              const Icon = getCategoryIcon(expense.category);
              return (
                <div key={expense.id} className="p-4 hover:bg-gray-50 transition">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <div className="bg-red-100 p-2 rounded-lg">
                          <Icon className="w-5 h-5 text-red-600" />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-800">
                            ${Number(expense.amount).toFixed(2)}
                          </p>
                          <p className="text-sm text-gray-600">
                            {expense.description || 'No description'}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {categories.find((c) => c.value === expense.category)?.label} •{' '}
                            {new Date(expense.date).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                            })}
                          </p>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete(expense.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

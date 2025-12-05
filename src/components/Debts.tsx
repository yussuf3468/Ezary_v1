import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Trash2, CreditCard, DollarSign, Calendar, CheckCircle } from 'lucide-react';

interface DebtRecord {
  id: string;
  creditor_name: string;
  amount: number;
  amount_paid: number;
  due_date: string | null;
  status: 'unpaid' | 'partially_paid' | 'cleared';
}

export default function Debts() {
  const { user } = useAuth();
  const [debts, setDebts] = useState<DebtRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [formData, setFormData] = useState({
    creditor_name: '',
    amount: '',
    due_date: '',
  });

  useEffect(() => {
    if (user) {
      loadDebts();
    }
  }, [user]);

  const loadDebts = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('debts')
        .select('*')
        .eq('user_id', user.id)
        .order('due_date', { ascending: true });

      if (error) throw error;
      setDebts(data || []);
    } catch (error) {
      console.error('Error loading debts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const { error } = await supabase.from('debts').insert({
        user_id: user.id,
        creditor_name: formData.creditor_name,
        amount: Number(formData.amount),
        amount_paid: 0,
        due_date: formData.due_date || null,
        status: 'unpaid',
      });

      if (error) throw error;

      setFormData({
        creditor_name: '',
        amount: '',
        due_date: '',
      });
      setShowForm(false);
      loadDebts();
    } catch (error) {
      console.error('Error adding debt:', error);
    }
  };

  const handlePayment = async (debtId: string) => {
    if (!paymentAmount) return;

    const debt = debts.find((d) => d.id === debtId);
    if (!debt) return;

    const newAmountPaid = Number(debt.amount_paid) + Number(paymentAmount);
    const remaining = Number(debt.amount) - newAmountPaid;

    let newStatus: 'unpaid' | 'partially_paid' | 'cleared' = 'unpaid';
    if (remaining <= 0) {
      newStatus = 'cleared';
    } else if (newAmountPaid > 0) {
      newStatus = 'partially_paid';
    }

    try {
      const { error } = await supabase
        .from('debts')
        .update({
          amount_paid: newAmountPaid,
          status: newStatus,
        })
        .eq('id', debtId);

      if (error) throw error;

      setPaymentAmount('');
      setShowPaymentForm(null);
      loadDebts();
    } catch (error) {
      console.error('Error recording payment:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this debt record?')) return;

    try {
      const { error } = await supabase.from('debts').delete().eq('id', id);
      if (error) throw error;
      loadDebts();
    } catch (error) {
      console.error('Error deleting debt:', error);
    }
  };

  if (loading) {
    return <div className="text-gray-500">Loading...</div>;
  }

  const totalDebt = debts.reduce((sum, debt) => {
    if (debt.status !== 'cleared') {
      return sum + (Number(debt.amount) - Number(debt.amount_paid));
    }
    return sum;
  }, 0);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'cleared':
        return 'bg-emerald-100 text-emerald-700';
      case 'partially_paid':
        return 'bg-amber-100 text-amber-700';
      default:
        return 'bg-red-100 text-red-700';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'cleared':
        return 'Cleared';
      case 'partially_paid':
        return 'Partially Paid';
      default:
        return 'Unpaid';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Debt Manager</h1>
          <p className="text-gray-600 mt-1">Track and manage your debts</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-600 text-white rounded-lg hover:from-blue-600 hover:to-cyan-700 transition shadow-lg hover:shadow-xl"
        >
          <Plus className="w-5 h-5 mr-2" />
          Add Debt
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
        <div className="text-center">
          <p className="text-gray-600 text-sm font-medium mb-2">Total Outstanding Debt</p>
          <p className="text-4xl font-bold text-red-600">${totalDebt.toFixed(2)}</p>
        </div>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Add New Debt</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Creditor Name</label>
              <input
                type="text"
                value={formData.creditor_name}
                onChange={(e) => setFormData({ ...formData, creditor_name: e.target.value })}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                placeholder="e.g., Credit Card, Bank Loan"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount Owed ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Due Date (Optional)</label>
                <input
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 bg-gradient-to-r from-blue-500 to-cyan-600 text-white py-2 rounded-lg hover:from-blue-600 hover:to-cyan-700 transition shadow-lg"
              >
                Add Debt
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
          <h2 className="text-xl font-bold text-gray-800">Debt Records</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {debts.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No debts recorded. Add a debt to start tracking!
            </div>
          ) : (
            debts.map((debt) => {
              const remaining = Number(debt.amount) - Number(debt.amount_paid);
              const progress = (Number(debt.amount_paid) / Number(debt.amount)) * 100;

              return (
                <div key={debt.id} className="p-4 hover:bg-gray-50 transition">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        <div className="bg-blue-100 p-2 rounded-lg">
                          <CreditCard className="w-5 h-5 text-blue-600" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-gray-800">{debt.creditor_name}</p>
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(debt.status)}`}>
                              {getStatusLabel(debt.status)}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
                            <span className="flex items-center gap-1">
                              <DollarSign className="w-4 h-4" />
                              Total: ${Number(debt.amount).toFixed(2)}
                            </span>
                            {debt.due_date && (
                              <span className="flex items-center gap-1">
                                <Calendar className="w-4 h-4" />
                                Due: {new Date(debt.due_date).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDelete(debt.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>

                    {debt.status !== 'cleared' && (
                      <>
                        <div>
                          <div className="flex justify-between text-sm mb-2">
                            <span className="text-gray-700">Progress</span>
                            <span className="text-gray-600">
                              ${Number(debt.amount_paid).toFixed(2)} / ${Number(debt.amount).toFixed(2)}
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                            <div
                              className="bg-gradient-to-r from-blue-500 to-cyan-600 h-2 rounded-full transition-all duration-500"
                              style={{ width: `${Math.min(progress, 100)}%` }}
                            />
                          </div>
                          <p className="text-sm text-gray-600 mt-1">
                            Remaining: ${remaining.toFixed(2)}
                          </p>
                        </div>

                        {showPaymentForm === debt.id ? (
                          <div className="flex gap-2">
                            <input
                              type="number"
                              step="0.01"
                              value={paymentAmount}
                              onChange={(e) => setPaymentAmount(e.target.value)}
                              placeholder="Payment amount"
                              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                            />
                            <button
                              onClick={() => handlePayment(debt.id)}
                              className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-lg hover:from-emerald-600 hover:to-teal-700 transition"
                            >
                              <CheckCircle className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => {
                                setShowPaymentForm(null);
                                setPaymentAmount('');
                              }}
                              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setShowPaymentForm(debt.id)}
                            className="w-full py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-lg hover:from-emerald-600 hover:to-teal-700 transition text-sm font-medium"
                          >
                            Record Payment
                          </button>
                        )}
                      </>
                    )}
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

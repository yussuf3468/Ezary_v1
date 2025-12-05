import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Home, Calendar, AlertCircle, CheckCircle } from 'lucide-react';

interface RentSettings {
  id: string;
  monthly_amount: number;
  due_day: number;
}

export default function Rent() {
  const { user } = useAuth();
  const [rentSettings, setRentSettings] = useState<RentSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    monthly_amount: '',
    due_day: '1',
  });
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (user) {
      loadRentSettings();
    }
  }, [user]);

  const loadRentSettings = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('rent_settings')
        .select('*')
        .eq('user_id', user.id)
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
      console.error('Error loading rent settings:', error);
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
          .from('rent_settings')
          .update({
            monthly_amount: Number(formData.monthly_amount),
            due_day: Number(formData.due_day),
            updated_at: new Date().toISOString(),
          })
          .eq('id', rentSettings.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from('rent_settings').insert({
          user_id: user.id,
          monthly_amount: Number(formData.monthly_amount),
          due_day: Number(formData.due_day),
        });

        if (error) throw error;
      }

      setIsEditing(false);
      loadRentSettings();
    } catch (error) {
      console.error('Error saving rent settings:', error);
    }
  };

  const addRentExpense = async () => {
    if (!user || !rentSettings) return;

    try {
      const today = new Date();
      const { error } = await supabase.from('expenses').insert({
        user_id: user.id,
        amount: rentSettings.monthly_amount,
        category: 'rent',
        description: 'Monthly rent payment',
        date: today.toISOString().split('T')[0],
      });

      if (error) throw error;
      alert('Rent payment recorded successfully!');
    } catch (error) {
      console.error('Error recording rent payment:', error);
      alert('Failed to record rent payment');
    }
  };

  if (loading) {
    return <div className="text-gray-500">Loading...</div>;
  }

  const today = new Date();
  const currentDay = today.getDate();
  const dueDay = rentSettings ? rentSettings.due_day : 1;
  const isDue = currentDay >= dueDay;
  const daysUntilDue = isDue ? 0 : dueDay - currentDay;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Rent Management</h1>
          <p className="text-gray-600 mt-1">Set and track your monthly rent</p>
        </div>
      </div>

      {rentSettings && !isEditing ? (
        <>
          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
            <div className="text-center">
              <div className="flex items-center justify-center mb-4">
                <div className="bg-gradient-to-br from-blue-500 to-cyan-600 p-4 rounded-xl">
                  <Home className="w-10 h-10 text-white" />
                </div>
              </div>
              <p className="text-gray-600 text-sm font-medium mb-2">Monthly Rent</p>
              <p className="text-5xl font-bold text-blue-600 mb-4">
                ${Number(rentSettings.monthly_amount).toFixed(2)}
              </p>
              <div className="flex items-center justify-center gap-2 text-gray-700">
                <Calendar className="w-4 h-4" />
                <span className="text-sm">Due on day {rentSettings.due_day} of each month</span>
              </div>
            </div>
          </div>

          {isDue ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
              <div className="flex items-start gap-4">
                <AlertCircle className="w-6 h-6 text-amber-600 mt-1 flex-shrink-0" />
                <div className="flex-1">
                  <h3 className="font-bold text-amber-900 text-lg mb-2">Rent Payment Due</h3>
                  <p className="text-amber-700 mb-4">
                    Your monthly rent of ${Number(rentSettings.monthly_amount).toFixed(2)} is due this month.
                    Would you like to record this payment as an expense?
                  </p>
                  <button
                    onClick={addRentExpense}
                    className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white px-6 py-3 rounded-lg hover:from-emerald-600 hover:to-teal-700 transition shadow-lg hover:shadow-xl font-medium"
                  >
                    Record Rent Payment
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6">
              <div className="flex items-start gap-4">
                <CheckCircle className="w-6 h-6 text-emerald-600 mt-1 flex-shrink-0" />
                <div>
                  <h3 className="font-bold text-emerald-900 text-lg mb-2">Rent Not Due Yet</h3>
                  <p className="text-emerald-700">
                    Your next rent payment is due in {daysUntilDue} day{daysUntilDue !== 1 ? 's' : ''}.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Rent Settings</h2>
            <div className="space-y-3 text-gray-700">
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="font-medium">Monthly Amount:</span>
                <span>${Number(rentSettings.monthly_amount).toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="font-medium">Due Day:</span>
                <span>Day {rentSettings.due_day} of each month</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="font-medium">Annual Rent:</span>
                <span className="font-bold text-blue-600">
                  ${(Number(rentSettings.monthly_amount) * 12).toFixed(2)}
                </span>
              </div>
            </div>
            <button
              onClick={() => setIsEditing(true)}
              className="w-full mt-6 bg-gradient-to-r from-blue-500 to-cyan-600 text-white py-3 rounded-lg hover:from-blue-600 hover:to-cyan-700 transition shadow-lg hover:shadow-xl font-medium"
            >
              Update Settings
            </button>
          </div>
        </>
      ) : (
        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
          <h2 className="text-xl font-bold text-gray-800 mb-4">
            {rentSettings ? 'Update Rent Settings' : 'Set Up Rent Settings'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Monthly Rent Amount ($)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.monthly_amount}
                onChange={(e) => setFormData({ ...formData, monthly_amount: e.target.value })}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Due Day of Month (1-31)
              </label>
              <input
                type="number"
                min="1"
                max="31"
                value={formData.due_day}
                onChange={(e) => setFormData({ ...formData, due_day: e.target.value })}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                placeholder="1"
              />
              <p className="text-xs text-gray-500 mt-1">
                The day of the month when rent is due (e.g., 1 for the 1st of each month)
              </p>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 bg-gradient-to-r from-blue-500 to-cyan-600 text-white py-3 rounded-lg hover:from-blue-600 hover:to-cyan-700 transition shadow-lg font-medium"
              >
                {rentSettings ? 'Update Settings' : 'Save Settings'}
              </button>
              {rentSettings && (
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
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

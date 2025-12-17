import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import {
  Users,
  TrendingUp,
  DollarSign,
  Truck,
  ArrowRight,
  Calendar,
  AlertCircle,
} from "lucide-react";
import { formatCurrency } from "../lib/currency";

interface DashboardStats {
  totalClients: number;
  activeClients: number;
  totalVehicles: number;
  revenueKES: number;
  revenueUSD: number;
  pendingKES: number;
  pendingUSD: number;
}

interface RecentClient {
  id: string;
  client_name: string;
  client_code: string;
  status: string;
  created_at: string;
}

interface UpcomingDebt {
  id: string;
  client_name: string;
  amount: number;
  balance: number;
  currency: "KES" | "USD";
  due_date: string;
  status: string;
}

interface DashboardProps {
  onNavigate: (page: string, clientId?: string) => void;
}

export default function CMSDashboard({ onNavigate }: DashboardProps) {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalClients: 0,
    activeClients: 0,
    totalVehicles: 0,
    revenueKES: 0,
    revenueUSD: 0,
    pendingKES: 0,
    pendingUSD: 0,
  });
  const [recentClients, setRecentClients] = useState<RecentClient[]>([]);
  const [upcomingDebts, setUpcomingDebts] = useState<UpcomingDebt[]>([]);
  const [overdueDebts, setOverdueDebts] = useState<UpcomingDebt[]>([]);
  const [loading, setLoading] = useState(true);

  const loadDashboardData = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Load clients stats - only needed fields
      const { data: clientsData, error: clientsError } = await supabase
        .from("clients")
        .select("id, status, client_name, client_code, created_at")
        .eq("user_id", user.id);

      if (clientsError) throw clientsError;

      const totalClients = clientsData?.length || 0;
      const activeClients =
        clientsData?.filter((c) => c.status === "active").length || 0;

      // Get recent clients
      const recent =
        clientsData
          ?.sort(
            (a, b) =>
              new Date(b.created_at).getTime() -
              new Date(a.created_at).getTime()
          )
          .slice(0, 5) || [];
      setRecentClients(recent);

      // Load vehicles count
      const { data: vehiclesData, error: vehiclesError } = await supabase
        .from("vehicles")
        .select("id")
        .eq("user_id", user.id);

      if (vehiclesError) throw vehiclesError;
      const totalVehicles = vehiclesData?.length || 0;

      // Load KES revenue
      const { data: kesData, error: kesError } = await supabase
        .from("client_transactions_kes")
        .select("debit, credit")
        .eq("user_id", user.id);

      if (kesError) throw kesError;

      const revenueKES =
        kesData?.reduce((sum, t) => sum + Number(t.credit || 0), 0) || 0;

      const pendingKES =
        kesData?.reduce((sum, t) => sum + Number(t.debit || 0), 0) || 0;

      // Load USD revenue
      const { data: usdData, error: usdError } = await supabase
        .from("client_transactions_usd")
        .select("debit, credit")
        .eq("user_id", user.id);

      if (usdError) throw usdError;

      const revenueUSD =
        usdData?.reduce((sum, t) => sum + Number(t.credit || 0), 0) || 0;

      const pendingUSD =
        usdData?.reduce((sum, t) => sum + Number(t.debit || 0), 0) || 0;

      // Load upcoming debts (due within 7 days)
      const sevenDaysFromNow = new Date();
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

      const { data: upcomingDebtsData, error: upcomingDebtsError } =
        await supabase
          .from("client_debts")
          .select(
            `
          id,
          amount,
          balance,
          currency,
          due_date,
          status,
          clients (
            client_name
          )
        `
          )
          .eq("user_id", user.id)
          .in("status", ["pending", "overdue"])
          .gte("due_date", new Date().toISOString().split("T")[0])
          .lte("due_date", sevenDaysFromNow.toISOString().split("T")[0])
          .order("due_date", { ascending: true })
          .limit(5);

      if (!upcomingDebtsError && upcomingDebtsData) {
        const debtsWithClient = upcomingDebtsData.map((debt: any) => ({
          ...debt,
          client_name: debt.clients?.client_name || "Unknown",
        }));
        setUpcomingDebts(debtsWithClient);
      }

      // Load overdue debts
      const { data: overdueDebtsData, error: overdueDebtsError } =
        await supabase
          .from("client_debts")
          .select(
            `
          id,
          amount,
          balance,
          currency,
          due_date,
          status,
          clients (
            client_name
          )
        `
          )
          .eq("user_id", user.id)
          .eq("status", "overdue")
          .order("due_date", { ascending: true })
          .limit(5);

      if (!overdueDebtsError && overdueDebtsData) {
        const debtsWithClient = overdueDebtsData.map((debt: any) => ({
          ...debt,
          client_name: debt.clients?.client_name || "Unknown",
        }));
        setOverdueDebts(debtsWithClient);
      }

      setStats({
        totalClients,
        activeClients,
        totalVehicles,
        revenueKES,
        revenueUSD,
        pendingKES,
        pendingUSD,
      });
    } catch (error) {
      console.error("Error loading dashboard data:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadDashboardData();
    }
  }, [user, loadDashboardData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-500 text-lg">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 text-sm">
          Here's an overview of your business
        </p>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
        {/* Total Clients */}
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-4 text-white shadow hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-2">
            <Users className="w-6 h-6 opacity-80" />
          </div>
          <p className="text-blue-100 text-xs mb-1">Total Clients</p>
          <p className="text-2xl font-bold">{stats.totalClients}</p>
        </div>

        {/* Active Clients */}
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg p-4 text-white shadow hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-2">
            <TrendingUp className="w-6 h-6 opacity-80" />
          </div>
          <p className="text-emerald-100 text-xs mb-1">Active Clients</p>
          <p className="text-2xl font-bold">{stats.activeClients}</p>
        </div>

        {/* Total Revenue KES */}
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg p-4 text-white shadow hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-2">
            <DollarSign className="w-6 h-6 opacity-80" />
            <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">
              KES
            </span>
          </div>
          <p className="text-purple-100 text-xs mb-1">Revenue</p>
          <p className="text-lg font-bold">
            {formatCurrency(stats.revenueKES, "KES")}
          </p>
        </div>

        {/* Total Revenue USD */}
        <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-lg p-4 text-white shadow hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-2">
            <DollarSign className="w-6 h-6 opacity-80" />
            <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">
              USD
            </span>
          </div>
          <p className="text-amber-100 text-xs mb-1">Revenue</p>
          <p className="text-lg font-bold">
            {formatCurrency(stats.revenueUSD, "USD")}
          </p>
        </div>
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Pending Payments KES */}
        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-xs mb-1">
                Pending Payments (KES)
              </p>
              <p className="text-xl font-bold text-gray-900">
                {formatCurrency(stats.pendingKES, "KES")}
              </p>
            </div>
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-amber-600" />
            </div>
          </div>
        </div>

        {/* Pending Payments USD */}
        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-xs mb-1">
                Pending Payments (USD)
              </p>
              <p className="text-xl font-bold text-gray-900">
                {formatCurrency(stats.pendingUSD, "USD")}
              </p>
            </div>
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-blue-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Debt Alerts */}
      {(overdueDebts.length > 0 || upcomingDebts.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* Overdue Debts */}
          {overdueDebts.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle className="w-5 h-5 text-red-600" />
                <h3 className="font-bold text-red-900">
                  Overdue Debts ({overdueDebts.length})
                </h3>
              </div>
              <div className="space-y-2">
                {overdueDebts.map((debt) => {
                  const daysOverdue = Math.ceil(
                    (new Date().getTime() - new Date(debt.due_date).getTime()) /
                      (1000 * 60 * 60 * 24)
                  );
                  return (
                    <div
                      key={debt.id}
                      className="flex items-center justify-between bg-white rounded p-2 border border-red-100"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {debt.client_name}
                        </p>
                        <p className="text-xs text-red-600">
                          {daysOverdue} days overdue
                        </p>
                      </div>
                      <span className="text-sm font-bold text-red-600">
                        {formatCurrency(debt.balance, debt.currency)}
                      </span>
                    </div>
                  );
                })}
              </div>
              <button
                onClick={() => onNavigate("debts")}
                className="w-full mt-3 py-2 text-sm font-medium text-red-600 hover:bg-red-100 rounded transition-colors"
              >
                View All Debts
              </button>
            </div>
          )}

          {/* Upcoming Debts */}
          {upcomingDebts.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="w-5 h-5 text-amber-600" />
                <h3 className="font-bold text-amber-900">
                  Upcoming Debts ({upcomingDebts.length})
                </h3>
              </div>
              <div className="space-y-2">
                {upcomingDebts.map((debt) => {
                  const daysUntil = Math.ceil(
                    (new Date(debt.due_date).getTime() - new Date().getTime()) /
                      (1000 * 60 * 60 * 24)
                  );
                  return (
                    <div
                      key={debt.id}
                      className="flex items-center justify-between bg-white rounded p-2 border border-amber-100"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {debt.client_name}
                        </p>
                        <p className="text-xs text-amber-600">
                          Due in {daysUntil} days
                        </p>
                      </div>
                      <span className="text-sm font-bold text-amber-600">
                        {formatCurrency(debt.balance, debt.currency)}
                      </span>
                    </div>
                  );
                })}
              </div>
              <button
                onClick={() => onNavigate("debts")}
                className="w-full mt-3 py-2 text-sm font-medium text-amber-600 hover:bg-amber-100 rounded transition-colors"
              >
                View All Debts
              </button>
            </div>
          )}
        </div>
      )}

      {/* Quick Actions & Recent Clients */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quick Actions */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Quick Actions
          </h2>
          <div className="space-y-3">
            <button
              onClick={() => onNavigate("clients")}
              className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl hover:shadow-md transition-all duration-200 group"
            >
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-emerald-600" />
                <span className="font-medium text-gray-900">
                  View All Clients
                </span>
              </div>
              <ArrowRight className="w-5 h-5 text-emerald-600 group-hover:translate-x-1 transition-transform" />
            </button>

            <button
              onClick={() => onNavigate("vehicles")}
              className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl hover:shadow-md transition-all duration-200 group"
            >
              <div className="flex items-center gap-3">
                <Truck className="w-5 h-5 text-blue-600" />
                <span className="font-medium text-gray-900">
                  Manage Vehicles ({stats.totalVehicles})
                </span>
              </div>
              <ArrowRight className="w-5 h-5 text-blue-600 group-hover:translate-x-1 transition-transform" />
            </button>

            <button
              onClick={() => onNavigate("reports")}
              className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-xl hover:shadow-md transition-all duration-200 group"
            >
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-purple-600" />
                <span className="font-medium text-gray-900">
                  Generate Reports
                </span>
              </div>
              <ArrowRight className="w-5 h-5 text-purple-600 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>

        {/* Recent Clients */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">Recent Clients</h2>
            <button
              onClick={() => onNavigate("clients")}
              className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
            >
              View All
            </button>
          </div>

          {recentClients.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">No clients yet</p>
              <button
                onClick={() => onNavigate("clients")}
                className="mt-3 text-sm text-emerald-600 hover:text-emerald-700 font-medium"
              >
                Add your first client
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {recentClients.map((client) => (
                <button
                  key={client.id}
                  onClick={() => onNavigate("client-detail", client.id)}
                  className="w-full flex items-center justify-between p-3 border border-gray-100 rounded-lg hover:border-emerald-200 hover:bg-emerald-50/30 transition-all duration-200 group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full flex items-center justify-center text-white font-semibold">
                      {client.client_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="text-left">
                      <p className="font-medium text-gray-900 group-hover:text-emerald-600 transition-colors">
                        {client.client_name}
                      </p>
                      <p className="text-xs text-gray-500 font-mono">
                        {client.client_code}
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-emerald-600 group-hover:translate-x-1 transition-all" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

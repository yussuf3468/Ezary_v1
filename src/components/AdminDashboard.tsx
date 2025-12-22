import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "react-toastify";
import {
  Users,
  DollarSign,
  TrendingUp,
  Shield,
  Search,
  Mail,
  Building2,
} from "lucide-react";

interface UserStats {
  user_id: string;
  email: string;
  created_at: string;
  total_clients: number;
  total_kes_balance: number;
  total_usd_balance: number;
  total_transactions: number;
  total_debts: number;
}

interface Client {
  id: string;
  client_name: string;
  client_code: string;
  status: string;
  created_at: string;
  user_id: string;
  user_email: string;
  kes_balance: number;
  usd_balance: number;
}

export default function AdminDashboard() {
  const { user, userRole } = useAuth();
  const [loading, setLoading] = useState(true);
  const [userStats, setUserStats] = useState<UserStats[]>([]);
  const [allClients, setAllClients] = useState<Client[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string>("all");

  useEffect(() => {
    if (user && (userRole === "admin" || userRole === "superadmin")) {
      loadAdminData();
    }
  }, [user, userRole]);

  const loadAdminData = async () => {
    try {
      setLoading(true);

      // Get all users with their emails
      const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
      
      if (authError) throw authError;

      // Get all clients
      const { data: clientsData, error: clientsError } = await supabase
        .from("clients")
        .select("id, client_name, client_code, status, created_at, user_id");

      if (clientsError) throw clientsError;

      // Get all transactions
      const { data: kesTransactions, error: kesError } = await supabase
        .from("client_transactions_kes")
        .select("client_id, credit, debit, user_id");

      if (kesError) throw kesError;

      const { data: usdTransactions, error: usdError } = await supabase
        .from("client_transactions_usd")
        .select("client_id, credit, debit, user_id");

      if (usdError) throw usdError;

      // Get all debts
      const { data: debtsData, error: debtsError } = await supabase
        .from("client_debts")
        .select("user_id");

      if (debtsError) throw debtsError;

      // Calculate balances for each client
      const clientBalances = new Map<string, { kes: number; usd: number }>();

      kesTransactions?.forEach((txn) => {
        const existing = clientBalances.get(txn.client_id) || { kes: 0, usd: 0 };
        existing.kes += (txn.credit || 0) - (txn.debit || 0);
        clientBalances.set(txn.client_id, existing);
      });

      usdTransactions?.forEach((txn) => {
        const existing = clientBalances.get(txn.client_id) || { kes: 0, usd: 0 };
        existing.usd += (txn.credit || 0) - (txn.debit || 0);
        clientBalances.set(txn.client_id, existing);
      });

      // Build user stats
      const stats: UserStats[] = authUsers.users.map((authUser) => {
        const userClients = clientsData?.filter((c) => c.user_id === authUser.id) || [];
        const userKesTransactions = kesTransactions?.filter((t) => t.user_id === authUser.id) || [];
        const userUsdTransactions = usdTransactions?.filter((t) => t.user_id === authUser.id) || [];
        const userDebts = debtsData?.filter((d) => d.user_id === authUser.id) || [];

        const totalKes = userKesTransactions.reduce(
          (sum, t) => sum + (t.credit || 0) - (t.debit || 0),
          0
        );
        const totalUsd = userUsdTransactions.reduce(
          (sum, t) => sum + (t.credit || 0) - (t.debit || 0),
          0
        );

        return {
          user_id: authUser.id,
          email: authUser.email || "No email",
          created_at: authUser.created_at,
          total_clients: userClients.length,
          total_kes_balance: totalKes,
          total_usd_balance: totalUsd,
          total_transactions: userKesTransactions.length + userUsdTransactions.length,
          total_debts: userDebts.length,
        };
      });

      // Build clients list with user info
      const clientsList: Client[] = (clientsData || []).map((client) => {
        const userEmail = authUsers.users.find((u) => u.id === client.user_id)?.email || "Unknown";
        const balance = clientBalances.get(client.id) || { kes: 0, usd: 0 };

        return {
          ...client,
          user_email: userEmail,
          kes_balance: balance.kes,
          usd_balance: balance.usd,
        };
      });

      setUserStats(stats);
      setAllClients(clientsList);
    } catch (error: any) {
      console.error("Error loading admin data:", error);
      toast.error(`Failed to load admin data: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const filteredClients = allClients.filter((client) => {
    const matchesSearch =
      client.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.client_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.user_email.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesUser = selectedUserId === "all" || client.user_id === selectedUserId;

    return matchesSearch && matchesUser;
  });

  const totalStats = {
    totalUsers: userStats.length,
    totalClients: allClients.length,
    totalKes: userStats.reduce((sum, u) => sum + u.total_kes_balance, 0),
    totalUsd: userStats.reduce((sum, u) => sum + u.total_usd_balance, 0),
    totalTransactions: userStats.reduce((sum, u) => sum + u.total_transactions, 0),
    totalDebts: userStats.reduce((sum, u) => sum + u.total_debts, 0),
  };

  if (userRole !== "admin" && userRole !== "superadmin") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Shield className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Access Denied</h2>
          <p className="text-gray-400">You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-white text-lg">Loading admin dashboard...</div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 md:p-8">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center shadow-md">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">
            Super Admin Dashboard
          </h1>
        </div>
        <p className="text-sm text-gray-400 ml-13">
          Monitor all users and system-wide statistics
        </p>
      </div>

      {/* Global Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 backdrop-blur-xl rounded-xl p-6 border border-purple-500/20">
          <div className="flex items-center justify-between mb-2">
            <span className="text-purple-400 text-sm font-bold">Total Users</span>
            <Users className="w-5 h-5 text-purple-400" />
          </div>
          <p className="text-3xl font-black text-white">{totalStats.totalUsers}</p>
        </div>

        <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 backdrop-blur-xl rounded-xl p-6 border border-blue-500/20">
          <div className="flex items-center justify-between mb-2">
            <span className="text-blue-400 text-sm font-bold">Total Clients</span>
            <Building2 className="w-5 h-5 text-blue-400" />
          </div>
          <p className="text-3xl font-black text-white">{totalStats.totalClients}</p>
        </div>

        <div className="bg-gradient-to-br from-emerald-500/10 to-teal-500/10 backdrop-blur-xl rounded-xl p-6 border border-emerald-500/20">
          <div className="flex items-center justify-between mb-2">
            <span className="text-emerald-400 text-sm font-bold">Total Balance (KES)</span>
            <DollarSign className="w-5 h-5 text-emerald-400" />
          </div>
          <p className="text-3xl font-black text-white">
            {totalStats.totalKes.toLocaleString()}
          </p>
        </div>

        <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 backdrop-blur-xl rounded-xl p-6 border border-amber-500/20">
          <div className="flex items-center justify-between mb-2">
            <span className="text-amber-400 text-sm font-bold">Total Balance (USD)</span>
            <DollarSign className="w-5 h-5 text-amber-400" />
          </div>
          <p className="text-3xl font-black text-white">
            {totalStats.totalUsd.toLocaleString()}
          </p>
        </div>

        <div className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 backdrop-blur-xl rounded-xl p-6 border border-indigo-500/20">
          <div className="flex items-center justify-between mb-2">
            <span className="text-indigo-400 text-sm font-bold">Total Transactions</span>
            <TrendingUp className="w-5 h-5 text-indigo-400" />
          </div>
          <p className="text-3xl font-black text-white">{totalStats.totalTransactions}</p>
        </div>

        <div className="bg-gradient-to-br from-red-500/10 to-pink-500/10 backdrop-blur-xl rounded-xl p-6 border border-red-500/20">
          <div className="flex items-center justify-between mb-2">
            <span className="text-red-400 text-sm font-bold">Total Debts</span>
            <DollarSign className="w-5 h-5 text-red-400" />
          </div>
          <p className="text-3xl font-black text-white">{totalStats.totalDebts}</p>
        </div>
      </div>

      {/* User Stats */}
      <div className="bg-white/5 backdrop-blur-xl rounded-xl border border-white/10 p-6 mb-6">
        <h2 className="text-xl font-bold text-white mb-4">User Statistics</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase">
                  User Email
                </th>
                <th className="px-4 py-3 text-center text-xs font-bold text-gray-400 uppercase">
                  Clients
                </th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-400 uppercase">
                  KES Balance
                </th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-400 uppercase">
                  USD Balance
                </th>
                <th className="px-4 py-3 text-center text-xs font-bold text-gray-400 uppercase">
                  Transactions
                </th>
                <th className="px-4 py-3 text-center text-xs font-bold text-gray-400 uppercase">
                  Debts
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase">
                  Joined
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {userStats.map((stat) => (
                <tr key={stat.user_id} className="hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-gray-400" />
                      <span className="text-sm font-medium text-white">{stat.email}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-sm font-bold text-blue-400">{stat.total_clients}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span
                      className={`text-sm font-bold ${
                        stat.total_kes_balance >= 0 ? "text-emerald-400" : "text-red-400"
                      }`}
                    >
                      {stat.total_kes_balance.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span
                      className={`text-sm font-bold ${
                        stat.total_usd_balance >= 0 ? "text-emerald-400" : "text-red-400"
                      }`}
                    >
                      {stat.total_usd_balance.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-sm font-medium text-gray-300">
                      {stat.total_transactions}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-sm font-medium text-gray-300">{stat.total_debts}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-400">
                      {new Date(stat.created_at).toLocaleDateString()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* All Clients */}
      <div className="bg-white/5 backdrop-blur-xl rounded-xl border border-white/10 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <h2 className="text-xl font-bold text-white">All Clients Across System</h2>
          
          <div className="flex gap-3">
            <div className="relative flex-1 sm:flex-initial sm:w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search clients..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white/10 border border-white/20 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="px-4 py-2 bg-white/10 border border-white/20 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="all" className="bg-gray-900">All Users</option>
              {userStats.map((stat) => (
                <option key={stat.user_id} value={stat.user_id} className="bg-gray-900">
                  {stat.email}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase">
                  Client
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase">
                  Owner
                </th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-400 uppercase">
                  KES Balance
                </th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-400 uppercase">
                  USD Balance
                </th>
                <th className="px-4 py-3 text-center text-xs font-bold text-gray-400 uppercase">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase">
                  Created
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {filteredClients.map((client) => (
                <tr key={client.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-sm font-bold text-white">{client.client_name}</p>
                      <p className="text-xs text-gray-400">{client.client_code}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-300">{client.user_email}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span
                      className={`text-sm font-bold ${
                        client.kes_balance >= 0 ? "text-emerald-400" : "text-red-400"
                      }`}
                    >
                      {client.kes_balance.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span
                      className={`text-sm font-bold ${
                        client.usd_balance >= 0 ? "text-emerald-400" : "text-red-400"
                      }`}
                    >
                      {client.usd_balance.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-bold ${
                        client.status === "active"
                          ? "bg-emerald-500/20 text-emerald-400"
                          : "bg-gray-500/20 text-gray-400"
                      }`}
                    >
                      {client.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-400">
                      {new Date(client.created_at).toLocaleDateString()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredClients.length === 0 && (
          <div className="text-center py-8">
            <p className="text-gray-400">No clients found</p>
          </div>
        )}
      </div>
    </div>
  );
}

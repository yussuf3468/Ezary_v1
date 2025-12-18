import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "../lib/supabase";
import { offlineSupabase } from "../lib/offlineSupabase";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import {
  Users,
  TrendingUp,
  DollarSign,
  Calendar,
  AlertCircle,
  Plus,
  Search,
  Eye,
  Clock,
  Activity,
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

interface ClientWithBalance {
  id: string;
  client_name: string;
  client_code: string;
  status: string;
  created_at: string;
  balance_kes: number;
  balance_usd: number;
  transaction_count: number;
  last_transaction_date: string | null;
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
  const toast = useToast();
  const [stats, setStats] = useState<DashboardStats>({
    totalClients: 0,
    activeClients: 0,
    totalVehicles: 0,
    revenueKES: 0,
    revenueUSD: 0,
    pendingKES: 0,
    pendingUSD: 0,
  });
  const [clientsWithBalance, setClientsWithBalance] = useState<
    ClientWithBalance[]
  >([]);
  const [upcomingDebts, setUpcomingDebts] = useState<UpcomingDebt[]>([]);
  const [overdueDebts, setOverdueDebts] = useState<UpcomingDebt[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showQuickAddModal, setShowQuickAddModal] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [quickAddCurrency, setQuickAddCurrency] = useState<"KES" | "USD">(
    "KES"
  );

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

      // Load balances for all clients
      const { data: kesTransactions } = await supabase
        .from("client_transactions_kes")
        .select("client_id, debit, credit, transaction_date")
        .eq("user_id", user.id);

      const { data: usdTransactions } = await supabase
        .from("client_transactions_usd")
        .select("client_id, debit, credit, transaction_date")
        .eq("user_id", user.id);

      // Calculate balances per client
      const clientBalances = new Map<
        string,
        {
          balance_kes: number;
          balance_usd: number;
          transaction_count: number;
          last_transaction_date: string | null;
        }
      >();

      kesTransactions?.forEach((txn) => {
        const existing = clientBalances.get(txn.client_id) || {
          balance_kes: 0,
          balance_usd: 0,
          transaction_count: 0,
          last_transaction_date: null,
        };
        existing.balance_kes += (txn.credit || 0) - (txn.debit || 0);
        existing.transaction_count += 1;
        if (
          !existing.last_transaction_date ||
          txn.transaction_date > existing.last_transaction_date
        ) {
          existing.last_transaction_date = txn.transaction_date;
        }
        clientBalances.set(txn.client_id, existing);
      });

      usdTransactions?.forEach((txn) => {
        const existing = clientBalances.get(txn.client_id) || {
          balance_kes: 0,
          balance_usd: 0,
          transaction_count: 0,
          last_transaction_date: null,
        };
        existing.balance_usd += (txn.credit || 0) - (txn.debit || 0);
        existing.transaction_count += 1;
        if (
          !existing.last_transaction_date ||
          txn.transaction_date > existing.last_transaction_date
        ) {
          existing.last_transaction_date = txn.transaction_date;
        }
        clientBalances.set(txn.client_id, existing);
      });

      // Merge clients with balances
      const clientsWithBalanceData: ClientWithBalance[] = (
        clientsData || []
      ).map((client) => {
        const balance = clientBalances.get(client.id) || {
          balance_kes: 0,
          balance_usd: 0,
          transaction_count: 0,
          last_transaction_date: null,
        };
        return {
          ...client,
          ...balance,
        };
      });

      setClientsWithBalance(clientsWithBalanceData);

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

  const handleQuickAddTransaction = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    if (!selectedClientId) {
      toast.warning("Please select a client");
      return;
    }

    try {
      toast.info("Adding transaction...");
      const table =
        quickAddCurrency === "KES"
          ? "client_transactions_kes"
          : "client_transactions_usd";

      const transactionData = {
        user_id: user?.id,
        client_id: selectedClientId,
        transaction_date: formData.get("transaction_date"),
        description: formData.get("description"),
        debit:
          formData.get("type") === "receivable"
            ? Number(formData.get("amount"))
            : 0,
        credit:
          formData.get("type") === "paid" ? Number(formData.get("amount")) : 0,
        payment_method: formData.get("payment_method"),
        reference_number: formData.get("reference_number") || null,
        notes: formData.get("notes") || null,
      };

      const result = await offlineSupabase.insert(table, transactionData);

      if (result.error) throw result.error;

      setShowQuickAddModal(false);
      e.currentTarget.reset();
      loadDashboardData(); // Reload to show updated balances

      if (result.offline) {
        toast.success("Transaction queued (offline). Will sync when online.");
      } else {
        toast.success("Transaction added successfully!");
      }
    } catch (error) {
      console.error("Error adding transaction:", error);
      toast.error(
        `Failed to add transaction: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  };

  const filteredClients = useMemo(() => {
    if (!searchTerm.trim()) return clientsWithBalance;

    const term = searchTerm.toLowerCase();
    return clientsWithBalance.filter(
      (client) =>
        client.client_name.toLowerCase().includes(term) ||
        client.client_code.toLowerCase().includes(term)
    );
  }, [clientsWithBalance, searchTerm]);

  // Sort by most active clients (recent transactions + high counts)
  const activeClients = useMemo(() => {
    return [...filteredClients]
      .filter((c) => c.status === "active")
      .sort((a, b) => {
        // Sort by last transaction date, then by transaction count
        if (a.last_transaction_date && b.last_transaction_date) {
          return (
            new Date(b.last_transaction_date).getTime() -
            new Date(a.last_transaction_date).getTime()
          );
        }
        return b.transaction_count - a.transaction_count;
      })
      .slice(0, 12);
  }, [filteredClients]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-16 w-16 border-4 border-emerald-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-3 sm:p-4 md:p-8 space-y-4 sm:space-y-6">
      {/* Modern Header with Quick Add */}
      <div className="bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-600 rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-2xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-white/20 backdrop-blur-sm rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg">
              <span className="text-white font-bold text-2xl sm:text-3xl">
                E
              </span>
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white">
                Client Hub
              </h1>
              <p className="text-xs sm:text-sm text-emerald-100">
                Quick access • Ezary CMS
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowQuickAddModal(true)}
            className="flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 bg-white text-emerald-600 rounded-xl hover:shadow-xl transition-all duration-200 font-semibold text-sm sm:text-base w-full md:w-auto"
          >
            <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
            <span>Add Transaction</span>
          </button>
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 md:gap-4 mb-4 sm:mb-6">
        {/* Total Clients */}
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-3 sm:p-4 text-white shadow hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-1 sm:mb-2">
            <Users className="w-4 h-4 sm:w-6 sm:h-6 opacity-80" />
          </div>
          <p className="text-blue-100 text-[10px] sm:text-xs mb-1">
            Total Clients
          </p>
          <p className="text-xl sm:text-2xl font-bold">{stats.totalClients}</p>
        </div>

        {/* Active Clients */}
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg p-3 sm:p-4 text-white shadow hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-1 sm:mb-2">
            <TrendingUp className="w-4 h-4 sm:w-6 sm:h-6 opacity-80" />
          </div>
          <p className="text-emerald-100 text-[10px] sm:text-xs mb-1">Active</p>
          <p className="text-xl sm:text-2xl font-bold">{stats.activeClients}</p>
        </div>

        {/* Total Revenue KES */}
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg p-3 sm:p-4 text-white shadow hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-1 sm:mb-2">
            <DollarSign className="w-4 h-4 sm:w-6 sm:h-6 opacity-80" />
            <span className="text-[10px] sm:text-xs bg-white/20 px-1.5 sm:px-2 py-0.5 rounded-full">
              KES
            </span>
          </div>
          <p className="text-purple-100 text-[10px] sm:text-xs mb-1">Revenue</p>
          <p className="text-sm sm:text-lg font-bold truncate">
            {formatCurrency(stats.revenueKES, "KES")}
          </p>
        </div>

        {/* Total Revenue USD */}
        <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-lg p-3 sm:p-4 text-white shadow hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-1 sm:mb-2">
            <DollarSign className="w-4 h-4 sm:w-6 sm:h-6 opacity-80" />
            <span className="text-[10px] sm:text-xs bg-white/20 px-1.5 sm:px-2 py-0.5 rounded-full">
              USD
            </span>
          </div>
          <p className="text-amber-100 text-[10px] sm:text-xs mb-1">Revenue</p>
          <p className="text-sm sm:text-lg font-bold truncate">
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

      {/* Active Clients with Search */}
      <div className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <Activity className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-600" />
            <h2 className="text-base sm:text-lg md:text-xl font-bold text-gray-900">
              Active Clients
            </h2>
          </div>
          <button
            onClick={() => onNavigate("clients")}
            className="text-xs sm:text-sm text-emerald-600 hover:text-emerald-700 font-medium"
          >
            View All ({stats.totalClients})
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative mb-3 sm:mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
          <input
            type="text"
            placeholder="Search clients..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 sm:pl-10 pr-4 py-2.5 sm:py-3 text-sm sm:text-base border border-gray-200 rounded-lg sm:rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
        </div>

        {activeClients.length === 0 ? (
          <div className="text-center py-8">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">No clients found</p>
            <button
              onClick={() => onNavigate("clients")}
              className="mt-3 text-sm text-emerald-600 hover:text-emerald-700 font-medium"
            >
              Go to All Clients
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {activeClients.map((client) => {
              const balanceKES = client.balance_kes;
              const balanceUSD = client.balance_usd;

              return (
                <div
                  key={client.id}
                  onClick={() => onNavigate("client-detail", client.id)}
                  className="bg-gradient-to-br from-white to-emerald-50/20 border border-gray-200 rounded-xl p-3 sm:p-4 hover:shadow-lg hover:border-emerald-300 transition-all duration-200 cursor-pointer group"
                >
                  {/* Client Header */}
                  <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg sm:rounded-xl flex items-center justify-center text-white font-bold text-sm sm:text-base shadow-md">
                      {client.client_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm sm:text-base text-gray-900 group-hover:text-emerald-600 transition-colors truncate">
                        {client.client_name}
                      </p>
                      <p className="text-xs text-gray-500 font-mono">
                        {client.client_code}
                      </p>
                    </div>
                  </div>

                  {/* Balance Info */}
                  <div className="grid grid-cols-2 gap-1.5 sm:gap-2 mb-2 sm:mb-3">
                    <div
                      className={`rounded-lg p-1.5 sm:p-2 ${
                        balanceKES > 0
                          ? "bg-emerald-50 border border-emerald-200"
                          : balanceKES < 0
                          ? "bg-red-50 border border-red-200"
                          : "bg-gray-50 border border-gray-200"
                      }`}
                    >
                      <p className="text-[10px] sm:text-xs text-gray-600 mb-0.5 sm:mb-1">
                        KES
                      </p>
                      <p
                        className={`text-xs sm:text-sm font-bold ${
                          balanceKES > 0
                            ? "text-emerald-700"
                            : balanceKES < 0
                            ? "text-red-700"
                            : "text-gray-700"
                        }`}
                      >
                        {balanceKES.toLocaleString()}
                      </p>
                    </div>
                    <div
                      className={`rounded-lg p-1.5 sm:p-2 ${
                        balanceUSD > 0
                          ? "bg-blue-50 border border-blue-200"
                          : balanceUSD < 0
                          ? "bg-red-50 border border-red-200"
                          : "bg-gray-50 border border-gray-200"
                      }`}
                    >
                      <p className="text-[10px] sm:text-xs text-gray-600 mb-0.5 sm:mb-1">
                        USD
                      </p>
                      <p
                        className={`text-xs sm:text-sm font-bold ${
                          balanceUSD > 0
                            ? "text-blue-700"
                            : balanceUSD < 0
                            ? "text-red-700"
                            : "text-gray-700"
                        }`}
                      >
                        ${balanceUSD.toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {/* Transaction Info */}
                  <div className="flex items-center justify-between text-xs text-gray-600 pt-2 border-t border-gray-200">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{client.transaction_count} txns</span>
                    </div>
                    {client.last_transaction_date && (
                      <span>
                        {new Date(
                          client.last_transaction_date
                        ).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    )}
                  </div>

                  {/* Quick View Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onNavigate("client-detail", client.id);
                    }}
                    className="w-full mt-3 flex items-center justify-center gap-2 px-3 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-lg text-xs font-medium hover:shadow-md transition-all"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    View Details
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick Add Transaction Modal */}
      {showQuickAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-6 py-4 rounded-t-2xl">
              <h2 className="text-2xl font-bold">Quick Add Transaction</h2>
              <p className="text-emerald-100 text-sm">
                Add a transaction for any client
              </p>
            </div>

            <form
              onSubmit={handleQuickAddTransaction}
              className="p-6 space-y-4"
            >
              {/* Client Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Client *
                </label>
                <select
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">Choose a client...</option>
                  {clientsWithBalance.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.client_name} ({client.client_code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Currency Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Currency *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setQuickAddCurrency("KES")}
                    className={`px-4 py-3 rounded-lg font-medium transition-all ${
                      quickAddCurrency === "KES"
                        ? "bg-emerald-600 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    KES
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickAddCurrency("USD")}
                    className={`px-4 py-3 rounded-lg font-medium transition-all ${
                      quickAddCurrency === "USD"
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    USD
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Date *
                  </label>
                  <input
                    type="date"
                    name="transaction_date"
                    required
                    defaultValue={new Date().toISOString().split("T")[0]}
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Type *
                  </label>
                  <select
                    name="type"
                    required
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="paid">Paid (Credit)</option>
                    <option value="receivable">Receivable (Debit)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Amount *
                  </label>
                  <input
                    type="number"
                    name="amount"
                    required
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Payment Method
                  </label>
                  <select
                    name="payment_method"
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">Select method...</option>
                    <option value="cash">Cash</option>
                    <option value="mpesa">M-Pesa</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="cheque">Cheque</option>
                    <option value="card">Card</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description *
                </label>
                <input
                  type="text"
                  name="description"
                  required
                  placeholder="e.g., Payment for services"
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowQuickAddModal(false)}
                  className="flex-1 px-6 py-3 border border-gray-300 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl font-medium hover:shadow-lg transition-all duration-200"
                >
                  Add Transaction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

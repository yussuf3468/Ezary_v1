import { useEffect, useState, useMemo } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import {
  Search,
  Plus,
  Users,
  TrendingUp,
  Building2,
  Filter,
  X,
  ArrowUpDown,
  Mail,
  Phone,
  Calendar,
  Eye,
  Edit2,
  Trash2,
  DollarSign,
  Clock,
} from "lucide-react";

interface Client {
  id: string;
  client_name: string;
  client_code: string;
  email: string | null;
  phone: string | null;
  business_name: string | null;
  status: string;
  last_transaction_date: string | null;
  created_at: string;
}

interface ClientBalance {
  client_id: string;
  balance: number;
  transaction_count: number;
}

interface ClientListProps {
  onSelectClient: (clientId: string) => void;
}

type SortField = "name" | "date" | "balance" | "transactions";
type SortOrder = "asc" | "desc";

export default function ClientList({ onSelectClient }: ClientListProps) {
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [balances, setBalances] = useState<Map<string, ClientBalance>>(
    new Map()
  );
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [showAddModal, setShowAddModal] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    inactive: 0,
  });

  useEffect(() => {
    if (user) {
      loadClients();
      loadBalances();
    }
  }, [user]);

  const loadClients = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setClients(data || []);

      // Calculate stats
      const total = data?.length || 0;
      const active = data?.filter((c) => c.status === "active").length || 0;
      const inactive = data?.filter((c) => c.status === "inactive").length || 0;
      setStats({ total, active, inactive });
    } catch (error) {
      console.error("Error loading clients:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadBalances = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("transactions")
        .select("client_id, paid, receivable")
        .eq("user_id", user.id);

      if (error) throw error;

      // Calculate balances by client
      const balanceMap = new Map<string, ClientBalance>();
      data?.forEach((txn) => {
        const existing = balanceMap.get(txn.client_id) || {
          client_id: txn.client_id,
          balance: 0,
          transaction_count: 0,
        };
        existing.balance += (txn.paid || 0) - (txn.receivable || 0);
        existing.transaction_count += 1;
        balanceMap.set(txn.client_id, existing);
      });

      setBalances(balanceMap);
    } catch (error) {
      console.error("Error loading balances:", error);
    }
  };

  // Memoized filtered and sorted clients
  const filteredClients = useMemo(() => {
    let filtered = [...clients];

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((c) => c.status === statusFilter);
    }

    // Search filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.client_name.toLowerCase().includes(term) ||
          c.client_code.toLowerCase().includes(term) ||
          c.email?.toLowerCase().includes(term) ||
          c.phone?.includes(term) ||
          c.business_name?.toLowerCase().includes(term)
      );
    }

    // Sort
    filtered.sort((a, b) => {
      let compareValue = 0;

      switch (sortField) {
        case "name":
          compareValue = a.client_name.localeCompare(b.client_name);
          break;
        case "date":
          compareValue =
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
        case "balance":
          const balanceA = balances.get(a.id)?.balance || 0;
          const balanceB = balances.get(b.id)?.balance || 0;
          compareValue = balanceA - balanceB;
          break;
        case "transactions":
          const txnA = balances.get(a.id)?.transaction_count || 0;
          const txnB = balances.get(b.id)?.transaction_count || 0;
          compareValue = txnA - txnB;
          break;
      }

      return sortOrder === "asc" ? compareValue : -compareValue;
    });

    return filtered;
  }, [clients, searchTerm, statusFilter, sortField, sortOrder, balances]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  const handleAddClient = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    try {
      // Generate client code
      const { data: codeData } = await supabase.rpc("generate_client_code");
      const clientCode = codeData || `CLT-${Date.now().toString().slice(-4)}`;

      const { error } = await supabase.from("clients").insert({
        user_id: user?.id,
        client_name: formData.get("client_name"),
        email: formData.get("email") || null,
        phone: formData.get("phone") || null,
        business_name: formData.get("business_name") || null,
        address: formData.get("address") || null,
        client_code: clientCode,
        status: "active",
      });

      if (error) throw error;

      e.currentTarget.reset();
      setShowAddModal(false);
      loadClients();
    } catch (error) {
      console.error("Error adding client:", error);
      alert("Failed to add client. Please try again.");
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-emerald-100 text-emerald-700 border-emerald-200";
      case "inactive":
        return "bg-gray-100 text-gray-700 border-gray-200";
      case "pending":
        return "bg-amber-100 text-amber-700 border-amber-200";
      default:
        return "bg-blue-100 text-blue-700 border-blue-200";
    }
  };

  const LoadingSkeleton = () => (
    <div className="max-w-7xl mx-auto p-4 md:p-8">
      <div className="mb-8">
        <div className="h-10 w-64 bg-gray-200 rounded-lg mb-4 animate-pulse"></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-white rounded-xl p-6 shadow-sm border border-gray-100"
            >
              <div className="h-4 w-24 bg-gray-200 rounded mb-2 animate-pulse"></div>
              <div className="h-8 w-16 bg-gray-200 rounded animate-pulse"></div>
            </div>
          ))}
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 mb-6">
          <div className="h-12 bg-gray-200 rounded-lg animate-pulse"></div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="bg-white rounded-xl p-6 shadow-sm border border-gray-100"
          >
            <div className="h-6 w-32 bg-gray-200 rounded mb-3 animate-pulse"></div>
            <div className="h-4 w-24 bg-gray-200 rounded mb-4 animate-pulse"></div>
            <div className="space-y-2">
              <div className="h-4 w-full bg-gray-200 rounded animate-pulse"></div>
              <div className="h-4 w-3/4 bg-gray-200 rounded animate-pulse"></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  if (loading) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-md">
                <span className="text-white font-bold text-lg">E</span>
              </div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <Users className="w-8 h-8 text-emerald-600" />
                Client Management
              </h1>
            </div>
            <p className="text-gray-600 ml-13">
              Manage and track all your clients • Ezary CMS
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl hover:shadow-lg transition-all duration-200 font-medium"
          >
            <Plus className="w-5 h-5" />
            Add Client
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm mb-1">Total Clients</p>
                <p className="text-3xl font-bold text-gray-900">
                  {stats.total}
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm mb-1">Active Clients</p>
                <p className="text-3xl font-bold text-emerald-600">
                  {stats.active}
                </p>
              </div>
              <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-emerald-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm mb-1">Inactive Clients</p>
                <p className="text-3xl font-bold text-gray-500">
                  {stats.inactive}
                </p>
              </div>
              <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
                <Building2 className="w-6 h-6 text-gray-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Search, Filters, and Sort */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search clients by name, code, email, or phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-2">
              <ArrowUpDown className="w-5 h-5 text-gray-400" />
              <select
                value={`${sortField}-${sortOrder}`}
                onChange={(e) => {
                  const [field, order] = e.target.value.split("-");
                  setSortField(field as SortField);
                  setSortOrder(order as SortOrder);
                }}
                className="px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white"
              >
                <option value="date-desc">Newest First</option>
                <option value="date-asc">Oldest First</option>
                <option value="name-asc">Name (A-Z)</option>
                <option value="name-desc">Name (Z-A)</option>
                <option value="balance-desc">Highest Balance</option>
                <option value="balance-asc">Lowest Balance</option>
                <option value="transactions-desc">Most Transactions</option>
                <option value="transactions-asc">Least Transactions</option>
              </select>
            </div>
          </div>

          {/* Status Filter Chips */}
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="w-4 h-4 text-gray-400" />
            <button
              onClick={() => setStatusFilter("all")}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                statusFilter === "all"
                  ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              All ({stats.total})
            </button>
            <button
              onClick={() => setStatusFilter("active")}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                statusFilter === "active"
                  ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md"
                  : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
              }`}
            >
              Active ({stats.active})
            </button>
            <button
              onClick={() => setStatusFilter("inactive")}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                statusFilter === "inactive"
                  ? "bg-gradient-to-r from-gray-600 to-gray-700 text-white shadow-md"
                  : "bg-gray-50 text-gray-700 hover:bg-gray-100"
              }`}
            >
              Inactive ({stats.inactive})
            </button>
          </div>

          {/* Results count */}
          <div className="text-sm text-gray-500">
            Showing{" "}
            <span className="font-semibold text-gray-900">
              {filteredClients.length}
            </span>{" "}
            of{" "}
            <span className="font-semibold text-gray-900">
              {clients.length}
            </span>{" "}
            clients
          </div>
        </div>
      </div>

      {/* Client List */}
      {filteredClients.length === 0 ? (
        <div className="bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 rounded-2xl p-12 text-center shadow-sm border border-emerald-100">
          <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-emerald-100 to-teal-200 rounded-full flex items-center justify-center">
            <Users className="w-12 h-12 text-emerald-600" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-2">
            {searchTerm || statusFilter !== "all"
              ? "No clients found"
              : "No clients yet"}
          </h3>
          <p className="text-gray-600 mb-6 max-w-md mx-auto">
            {searchTerm || statusFilter !== "all"
              ? "Try adjusting your search or filters to find what you're looking for"
              : "Start building your client database by adding your first client"}
          </p>
          {!searchTerm && statusFilter === "all" && (
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl hover:shadow-xl transition-all duration-200 font-medium"
            >
              <Plus className="w-5 h-5" />
              Add Your First Client
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredClients.map((client) => {
            const clientBalance = balances.get(client.id);
            const balance = clientBalance?.balance || 0;
            const txnCount = clientBalance?.transaction_count || 0;
            const isPositive = balance > 0;
            const isNegative = balance < 0;

            return (
              <div
                key={client.id}
                className="group bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-xl hover:border-emerald-300 transition-all duration-300 overflow-hidden"
              >
                {/* Gradient Header */}
                <div
                  className={`h-2 bg-gradient-to-r ${
                    client.status === "active"
                      ? "from-emerald-400 via-teal-400 to-cyan-400"
                      : "from-gray-300 via-gray-400 to-gray-500"
                  }`}
                ></div>

                <div className="p-5">
                  {/* Client Info */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3 flex-1">
                      <div
                        className={`w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-md bg-gradient-to-br ${
                          client.status === "active"
                            ? "from-emerald-500 to-teal-600"
                            : "from-gray-400 to-gray-600"
                        }`}
                      >
                        {client.client_name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base font-bold text-gray-900 group-hover:text-emerald-600 transition-colors truncate">
                          {client.client_name}
                        </h3>
                        <p className="text-xs text-gray-500 font-mono">
                          {client.client_code}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Business Name */}
                  {client.business_name && (
                    <div className="flex items-center gap-2 mb-3 text-sm text-gray-600 truncate">
                      <Building2 className="w-4 h-4 flex-shrink-0 text-gray-400" />
                      <span className="truncate">{client.business_name}</span>
                    </div>
                  )}

                  {/* Contact Info */}
                  <div className="space-y-1.5 mb-3">
                    {client.email && (
                      <div className="flex items-center gap-2 text-xs text-gray-600 truncate">
                        <Mail className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" />
                        <span className="truncate">{client.email}</span>
                      </div>
                    )}
                    {client.phone && (
                      <div className="flex items-center gap-2 text-xs text-gray-600">
                        <Phone className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" />
                        <span>{client.phone}</span>
                      </div>
                    )}
                  </div>

                  {/* Balance & Transactions */}
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div
                      className={`rounded-lg p-2.5 ${
                        isPositive
                          ? "bg-emerald-50 border border-emerald-200"
                          : isNegative
                          ? "bg-red-50 border border-red-200"
                          : "bg-gray-50 border border-gray-200"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <DollarSign
                          className={`w-3.5 h-3.5 ${
                            isPositive
                              ? "text-emerald-600"
                              : isNegative
                              ? "text-red-600"
                              : "text-gray-500"
                          }`}
                        />
                        <span className="text-xs text-gray-600 font-medium">
                          Balance
                        </span>
                      </div>
                      <p
                        className={`text-sm font-bold ${
                          isPositive
                            ? "text-emerald-700"
                            : isNegative
                            ? "text-red-700"
                            : "text-gray-700"
                        }`}
                      >
                        KES {balance.toLocaleString()}
                      </p>
                    </div>

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-2.5">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Clock className="w-3.5 h-3.5 text-blue-600" />
                        <span className="text-xs text-gray-600 font-medium">
                          Txns
                        </span>
                      </div>
                      <p className="text-sm font-bold text-blue-700">
                        {txnCount}
                      </p>
                    </div>
                  </div>

                  {/* Last Transaction */}
                  <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-4">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>
                      {client.last_transaction_date
                        ? new Date(
                            client.last_transaction_date
                          ).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })
                        : "No transactions"}
                    </span>
                  </div>

                  {/* Quick Actions */}
                  <div className="grid grid-cols-2 gap-2 pt-3 border-t border-gray-100">
                    <button
                      onClick={() => onSelectClient(client.id)}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-lg text-xs font-medium hover:shadow-lg transition-all duration-200"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      View
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        // TODO: Add edit functionality
                      }}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-200 transition-all duration-200"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      Edit
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Client Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">
                Add New Client
              </h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-6 h-6 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleAddClient} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Client Name *
                </label>
                <input
                  type="text"
                  name="client_name"
                  required
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="John Doe"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    name="email"
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="john@example.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="+254 700 000000"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Business Name
                </label>
                <input
                  type="text"
                  name="business_name"
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="ABC Corporation"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Address
                </label>
                <textarea
                  name="address"
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="Full address..."
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-6 py-3 border border-gray-300 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl font-medium hover:shadow-lg transition-all duration-200"
                >
                  Add Client
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

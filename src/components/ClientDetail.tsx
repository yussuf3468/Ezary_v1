import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "react-toastify";
import {
  ArrowLeft,
  Building2,
  Mail,
  Phone,
  MapPin,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Download,
  Plus,
  Trash2,
  FileText,
  X,
} from "lucide-react";
import { formatCurrency } from "../lib/currency";
import { generateClientPDFReport } from "../lib/pdfGenerator";

interface Client {
  id: string;
  client_name: string;
  client_code: string;
  email: string | null;
  phone: string | null;
  business_name: string | null;
  address: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  last_transaction_date: string | null;
}

interface Transaction {
  id: string;
  debit: number;
  credit: number;
  description: string;
  transaction_date: string;
  payment_method: string | null;
  reference_number: string | null;
  notes: string | null;
}

interface ClientDetailProps {
  clientId: string;
  onBack: () => void;
}

export default function ClientDetail({ clientId, onBack }: ClientDetailProps) {
  const { user } = useAuth();
  const [client, setClient] = useState<Client | null>(null);
  const [transactionsKES, setTransactionsKES] = useState<Transaction[]>([]);
  const [transactionsUSD, setTransactionsUSD] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"kes" | "usd">("kes");
  const [showAddTransaction, setShowAddTransaction] = useState(false);
  const [summaryKES, setSummaryKES] = useState({
    receivable: 0,
    paid: 0,
    balance: 0,
  });
  const [summaryUSD, setSummaryUSD] = useState({
    receivable: 0,
    paid: 0,
    balance: 0,
  });

  // Inline editing state
  const [newRow, setNewRow] = useState({
    date: new Date().toISOString().split("T")[0],
    description: "",
    credit: "",
    debit: "",
  });
  const [isSavingInline, setIsSavingInline] = useState(false);

  useEffect(() => {
    if (user && clientId) {
      loadClientData();
    }
  }, [user, clientId]);

  const calculateSummary = useCallback(
    (transactions: Transaction[], setSummary: Function) => {
      const receivable = transactions.reduce(
        (sum, t) => sum + (t.debit || 0),
        0
      );
      const paid = transactions.reduce((sum, t) => sum + (t.credit || 0), 0);
      const balance = paid - receivable;

      setSummary({ receivable, paid, balance });
    },
    []
  );

  const currentTransactions = useMemo(
    () => (activeTab === "kes" ? transactionsKES : transactionsUSD),
    [activeTab, transactionsKES, transactionsUSD]
  );

  const currentSummary = useMemo(
    () => (activeTab === "kes" ? summaryKES : summaryUSD),
    [activeTab, summaryKES, summaryUSD]
  );

  const currencySymbol = useMemo(
    () => (activeTab === "kes" ? "KES" : "USD"),
    [activeTab]
  );

  const loadClientData = async () => {
    if (!user || !clientId) return;

    try {
      setLoading(true);

      // Load all data in parallel
      const [clientResult, kesResult, usdResult] = await Promise.all([
        supabase
          .from("clients")
          .select(
            "id, client_name, client_code, email, phone, business_name, status"
          )
          .eq("id", clientId)
          .eq("user_id", user.id)
          .single(),
        supabase
          .from("client_transactions_kes")
          .select(
            "id, transaction_date, description, credit, debit, category, reference_number"
          )
          .eq("client_id", clientId)
          .eq("user_id", user.id)
          .order("transaction_date", { ascending: false }),
        supabase
          .from("client_transactions_usd")
          .select(
            "id, transaction_date, description, credit, debit, category, reference_number"
          )
          .eq("client_id", clientId)
          .eq("user_id", user.id)
          .order("transaction_date", { ascending: false }),
      ]);

      if (clientResult.error) throw clientResult.error;
      if (kesResult.error) throw kesResult.error;
      if (usdResult.error) throw usdResult.error;

      setClient(clientResult.data);
      setTransactionsKES(kesResult.data || []);
      setTransactionsUSD(usdResult.data || []);

      // Calculate summaries
      calculateSummary(kesResult.data || [], setSummaryKES);
      calculateSummary(usdResult.data || [], setSummaryUSD);
    } catch (error) {
      console.error("Error loading client data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTransaction = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const currency = formData.get("currency") as string;
    const transactionType = formData.get("transaction_type") as string;
    const amount = Number(formData.get("amount"));

    try {
      // Determine debit or credit based on transaction type
      const transactionData = {
        client_id: clientId,
        user_id: user?.id,
        debit: ["invoice", "charge", "expense"].includes(transactionType)
          ? amount
          : 0,
        credit: ["payment", "refund", "credit"].includes(transactionType)
          ? amount
          : 0,
        description: formData.get("description"),
        transaction_date: formData.get("transaction_date"),
        payment_method: null,
        reference_number: null,
        notes: null,
      };

      const table =
        currency === "kes"
          ? "client_transactions_kes"
          : "client_transactions_usd";
      const { data, error: insertError } = await supabase
        .from(table)
        .insert(transactionData)
        .select()
        .single();

      if (insertError) {
        console.error("Error adding transaction:", insertError);
        toast.error("Failed to add transaction. Please try again.");
        return;
      }

      // Add new transaction to state without full reload
      if (data) {
        if (currency === "kes") {
          const updatedTransactions = [data, ...transactionsKES];
          setTransactionsKES(updatedTransactions);
          calculateSummary(updatedTransactions, setSummaryKES);
        } else {
          const updatedTransactions = [data, ...transactionsUSD];
          setTransactionsUSD(updatedTransactions);
          calculateSummary(updatedTransactions, setSummaryUSD);
        }
      }

      setShowAddTransaction(false);
      toast.success("Transaction added successfully!");
    } catch (error) {
      console.error("Unexpected error:", error);
      toast.error("An unexpected error occurred. Please try again.");
    }
  };

  const deleteTransaction = async (
    transactionId: string,
    currency: "kes" | "usd"
  ) => {
    if (!confirm("Are you sure you want to delete this transaction?")) return;

    try {
      const table =
        currency === "kes"
          ? "client_transactions_kes"
          : "client_transactions_usd";
      const { error: deleteError } = await supabase
        .from(table)
        .delete()
        .eq("id", transactionId);

      if (deleteError) {
        console.error("Error deleting transaction:", deleteError);
        toast.error("Failed to delete transaction.");
        return;
      }

      // Remove transaction from state without full reload
      if (currency === "kes") {
        const updatedTransactions = transactionsKES.filter(
          (t) => t.id !== transactionId
        );
        setTransactionsKES(updatedTransactions);
        calculateSummary(updatedTransactions, setSummaryKES);
      } else {
        const updatedTransactions = transactionsUSD.filter(
          (t) => t.id !== transactionId
        );
        setTransactionsUSD(updatedTransactions);
        calculateSummary(updatedTransactions, setSummaryUSD);
      }
      toast.success("Transaction deleted successfully!");
    } catch (error) {
      console.error("Unexpected error:", error);
      toast.error("An unexpected error occurred.");
    }
  };

  // Handle inline row addition
  const handleInlineAdd = async () => {
    if (!newRow.description.trim()) {
      return; // Don't save if no description
    }

    const creditAmount = parseFloat(newRow.credit) || 0;
    const debitAmount = parseFloat(newRow.debit) || 0;

    if (creditAmount === 0 && debitAmount === 0) {
      return; // Don't save if both amounts are zero
    }

    setIsSavingInline(true);
    try {
      const transactionData = {
        client_id: clientId,
        user_id: user?.id,
        debit: debitAmount,
        credit: creditAmount,
        description: newRow.description.trim(),
        transaction_date: newRow.date,
        payment_method: null,
        reference_number: null,
        notes: null,
      };

      const table =
        activeTab === "kes"
          ? "client_transactions_kes"
          : "client_transactions_usd";
      const { data, error: insertError } = await supabase
        .from(table)
        .insert(transactionData)
        .select()
        .single();

      if (insertError) {
        console.error("Error adding transaction:", insertError);
        toast.error("Failed to add transaction. Please try again.");
        setIsSavingInline(false);
        return;
      }

      // Add new transaction to state
      if (data) {
        if (activeTab === "kes") {
          const updatedTransactions = [data, ...transactionsKES];
          setTransactionsKES(updatedTransactions);
          calculateSummary(updatedTransactions, setSummaryKES);
        } else {
          const updatedTransactions = [data, ...transactionsUSD];
          setTransactionsUSD(updatedTransactions);
          calculateSummary(updatedTransactions, setSummaryUSD);
        }
      }

      // Reset the form
      setNewRow({
        date: new Date().toISOString().split("T")[0],
        description: "",
        credit: "",
        debit: "",
      });
      setIsSavingInline(false);
      toast.success("Transaction added successfully!");
    } catch (error) {
      console.error("Unexpected error:", error);
      toast.error("An unexpected error occurred. Please try again.");
      setIsSavingInline(false);
    }
  };

  const handleInlineKeyDown = (e: React.KeyboardEvent, field: string) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleInlineAdd();
    } else if (e.key === "Tab" && field === "debit") {
      // When tabbing from last field, save the transaction
      if (!e.shiftKey) {
        e.preventDefault();
        handleInlineAdd();
      }
    }
  };

  const generatePDFReport = () => {
    if (!client) return;

    try {
      generateClientPDFReport({
        client: {
          client_name: client.client_name,
          client_code: client.client_code,
          email: client.email,
          phone: client.phone,
          business_name: client.business_name,
          address: client.address,
        },
        transactionsKES,
        transactionsUSD,
        summaryKES,
        summaryUSD,
        reportType: "full",
      });
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error(
        `Failed to generate PDF report: ${
          error instanceof Error ? error.message : "Unknown error"
        }. Please try again.`
      );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-500">Loading client details...</div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Client not found</p>
          <button
            onClick={onBack}
            className="px-6 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-zinc-900 pb-8">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6">
        {/* Back Button - Mobile Optimized */}
        <button
          onClick={onBack}
          className="group flex items-center gap-2 text-gray-400 hover:text-emerald-400 mb-4 sm:mb-6 transition-all duration-300 active:scale-95"
        >
          <div className="p-2 rounded-lg bg-white/10 backdrop-blur-sm shadow-sm group-hover:shadow-md group-hover:bg-emerald-500/20 transition-all">
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <span className="font-semibold text-sm sm:text-base">
            Back to Clients
          </span>
        </button>

        {/* Client Header - Ultra Premium */}
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-4 sm:p-6 mb-6">
          <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl sm:text-4xl font-black bg-gradient-to-r from-white to-emerald-200 bg-clip-text text-transparent">
                  {client.client_name}
                </h1>
                <span className="px-3 py-1 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-bold rounded-full">
                  {client.status.toUpperCase()}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-gray-500" />
                <p className="text-gray-400 font-mono text-sm font-semibold">
                  {client.client_code}
                </p>
              </div>
            </div>
            <button
              onClick={generatePDFReport}
              className="group flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:shadow-2xl hover:shadow-blue-500/50 transition-all font-semibold text-sm active:scale-95"
            >
              <Download className="w-5 h-5" />
              <span>Download Report</span>
            </button>
          </div>
        </div>

        {/* Client Info Grid - Compact */}
        <div className="mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {client.phone && (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-white/5 border border-white/10">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center flex-shrink-0">
                  <Phone className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-500">Phone</p>
                  <p className="text-sm font-bold text-white truncate">
                    {client.phone}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Currency Tabs */}
        <div className="flex gap-3 mb-6">
          <button
            onClick={() => setActiveTab("kes")}
            className={`flex-1 px-6 py-4 rounded-xl font-bold transition-all text-sm ${
              activeTab === "kes"
                ? "bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg"
                : "bg-white/5 text-gray-400 hover:bg-white/10 border border-white/10"
            }`}
          >
            <span className="hidden sm:inline">🇰🇪 Kenyan Shillings</span>
            <span className="sm:hidden">KES</span>
          </button>
          <button
            onClick={() => setActiveTab("usd")}
            className={`flex-1 px-6 py-4 rounded-xl font-bold transition-all text-sm ${
              activeTab === "usd"
                ? "bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg"
                : "bg-white/5 text-gray-400 hover:bg-white/10 border border-white/10"
            }`}
          >
            <span className="hidden sm:inline">🇺🇸 US Dollars</span>
            <span className="sm:hidden">USD</span>
          </button>
        </div>

        {/* Financial Summary */}
        <div className="mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Total OUT Card */}
            <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl p-5 text-white">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs bg-white/20 px-3 py-1 rounded-full font-bold uppercase">
                  OUT
                </span>
                <TrendingDown className="w-5 h-5" />
              </div>
              <p className="text-white/80 text-sm mb-1">Total OUT</p>
              <p className="text-2xl font-black">
                {formatCurrency(currentSummary.receivable, currencySymbol)}
              </p>
            </div>

            {/* Total IN Card */}
            <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl p-5 text-white">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs bg-white/20 px-3 py-1 rounded-full font-bold uppercase">
                  IN
                </span>
                <TrendingUp className="w-5 h-5" />
              </div>
              <p className="text-white/80 text-sm mb-1">Total IN</p>
              <p className="text-2xl font-black">
                {formatCurrency(currentSummary.paid, currencySymbol)}
              </p>
            </div>

            {/* Balance Card */}
            <div
              className={`rounded-xl p-5 text-white ${
                currentSummary.balance >= 0
                  ? "bg-gradient-to-br from-blue-500 to-indigo-600"
                  : "bg-gradient-to-br from-orange-500 to-amber-600"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs bg-white/20 px-3 py-1 rounded-full font-bold uppercase">
                  BALANCE
                </span>
                <DollarSign className="w-5 h-5" />
              </div>
              <p className="text-white/80 text-sm mb-1">Net Balance</p>
              <p className="text-2xl font-black">
                {formatCurrency(currentSummary.balance, currencySymbol)}
              </p>
            </div>
          </div>
        </div>

        {/* Transactions Section */}
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden">
          <div className="p-3 sm:p-6 bg-gradient-to-r from-white/5 to-transparent border-b border-white/10">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="text-lg sm:text-2xl font-bold text-white mb-1">
                  Transaction History
                </h2>
                <p className="text-xs sm:text-sm text-gray-400">
                  {currentTransactions.length} transaction
                  {currentTransactions.length !== 1 ? "s" : ""}
                </p>
              </div>
              <button
                onClick={() => setShowAddTransaction(true)}
                className="flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl hover:shadow-2xl hover:shadow-emerald-500/50 transition-all font-bold text-xs sm:text-sm active:scale-95 w-full sm:w-auto"
              >
                <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
                <span>Add Transaction</span>
              </button>
            </div>
          </div>

          {currentTransactions.length === 0 ? (
            <div className="text-center py-16 sm:py-20 px-4">
              <div className="inline-flex p-4 sm:p-6 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 rounded-full mb-4 sm:mb-6">
                <FileText className="w-12 h-12 sm:w-16 sm:h-16 text-emerald-400" />
              </div>
              <p className="text-gray-400 text-base sm:text-lg mb-6 font-medium">
                No transactions yet
              </p>
              <button
                onClick={() => setShowAddTransaction(true)}
                className="inline-flex items-center gap-2 px-6 sm:px-8 py-3 sm:py-4 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl sm:rounded-2xl hover:shadow-2xl hover:shadow-emerald-500/50 transition-all duration-300 font-bold text-sm sm:text-base active:scale-95"
              >
                <Plus className="w-5 h-5 sm:w-6 sm:h-6" />
                Add First Transaction
              </button>
            </div>
          ) : (
            <>
              {/* Mobile Card View */}
              <div className="md:hidden divide-y divide-white/10">
                {/* Mobile Inline Add Card - AT TOP */}
                <div className="p-4 bg-white/5 border-b-2 border-emerald-500/50 space-y-3 sticky top-0 z-20">
                  <div className="flex items-center gap-2 mb-2">
                    <Plus className="w-5 h-5 text-emerald-400" />
                    <p className="text-sm font-bold text-white">
                      Quick Add Transaction
                    </p>
                  </div>

                  <div className="space-y-2">
                    <input
                      type="date"
                      value={newRow.date}
                      onChange={(e) =>
                        setNewRow({ ...newRow, date: e.target.value })
                      }
                      className="w-full px-3 py-2.5 text-sm bg-white/10 text-white border-2 border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      disabled={isSavingInline}
                    />

                    <input
                      type="text"
                      placeholder="Description..."
                      value={newRow.description}
                      onChange={(e) =>
                        setNewRow({ ...newRow, description: e.target.value })
                      }
                      className="w-full px-3 py-2.5 text-sm bg-white/10 text-white border-2 border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 placeholder:text-gray-400"
                      disabled={isSavingInline}
                    />

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs font-semibold text-emerald-400 mb-1 block">
                          Money IN
                        </label>
                        <input
                          type="number"
                          placeholder="0.00"
                          step="0.01"
                          min="0"
                          value={newRow.credit}
                          onChange={(e) =>
                            setNewRow({
                              ...newRow,
                              credit: e.target.value,
                              debit: "",
                            })
                          }
                          className="w-full px-3 py-2.5 text-sm bg-emerald-500/10 text-white border-2 border-emerald-500/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder:text-gray-400"
                          disabled={isSavingInline}
                        />
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-red-400 mb-1 block">
                          Money OUT
                        </label>
                        <input
                          type="number"
                          placeholder="0.00"
                          step="0.01"
                          min="0"
                          value={newRow.debit}
                          onChange={(e) =>
                            setNewRow({
                              ...newRow,
                              debit: e.target.value,
                              credit: "",
                            })
                          }
                          className="w-full px-3 py-2.5 text-sm bg-red-500/10 text-white border-2 border-red-500/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 placeholder:text-gray-400"
                          disabled={isSavingInline}
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleInlineAdd}
                      disabled={isSavingInline || !newRow.description.trim()}
                      className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl font-bold hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                    >
                      {isSavingInline ? "Saving..." : "✓ Add Transaction"}
                    </button>
                  </div>
                </div>

                {currentTransactions.map((transaction, index) => {
                  // Calculate balance from the end (current balance at top)
                  const remainingTransactions =
                    currentTransactions.slice(index);
                  const runningBalance = remainingTransactions.reduce(
                    (sum, t) =>
                      sum + Number(t.credit || 0) - Number(t.debit || 0),
                    0
                  );

                  return (
                    <div
                      key={transaction.id}
                      className="p-4 hover:bg-white/5 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <p className="text-sm font-bold text-white mb-1">
                            {transaction.description}
                          </p>
                          <p className="text-xs text-gray-400 font-medium">
                            {new Date(
                              transaction.transaction_date
                            ).toLocaleDateString("en-GB", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })}
                          </p>
                        </div>
                        <button
                          onClick={() =>
                            deleteTransaction(transaction.id, activeTab)
                          }
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors active:scale-90"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div className="bg-emerald-50 rounded-lg p-2 border border-emerald-200">
                          <p className="text-xs text-emerald-600 font-semibold mb-1">
                            IN
                          </p>
                          {transaction.credit > 0 ? (
                            <p className="text-sm font-bold text-emerald-700">
                              +
                              {formatCurrency(
                                transaction.credit,
                                currencySymbol
                              )}
                            </p>
                          ) : (
                            <p className="text-sm text-gray-400">—</p>
                          )}
                        </div>

                        <div className="bg-red-50 rounded-lg p-2 border border-red-200">
                          <p className="text-xs text-red-600 font-semibold mb-1">
                            OUT
                          </p>
                          {transaction.debit > 0 ? (
                            <p className="text-sm font-bold text-red-700">
                              -
                              {formatCurrency(
                                transaction.debit,
                                currencySymbol
                              )}
                            </p>
                          ) : (
                            <p className="text-sm text-gray-400">—</p>
                          )}
                        </div>

                        <div
                          className={`rounded-lg p-2 border ${
                            runningBalance >= 0
                              ? "bg-blue-50 border-blue-200"
                              : "bg-orange-50 border-orange-200"
                          }`}
                        >
                          <p
                            className={`text-xs font-semibold mb-1 ${
                              runningBalance >= 0
                                ? "text-blue-600"
                                : "text-orange-600"
                            }`}
                          >
                            Balance
                          </p>
                          <p
                            className={`text-sm font-bold ${
                              runningBalance >= 0
                                ? "text-blue-700"
                                : "text-orange-700"
                            }`}
                          >
                            {runningBalance >= 0 ? "+" : ""}
                            {formatCurrency(runningBalance, currencySymbol)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="min-w-full">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-white/5 border-b-2 border-white/20">
                      <th className="w-32 px-4 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-4 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">
                        Reason
                      </th>
                      <th className="w-40 px-4 py-4 text-right text-xs font-bold text-emerald-400 uppercase tracking-wider">
                        IN
                      </th>
                      <th className="w-40 px-4 py-4 text-right text-xs font-bold text-red-400 uppercase tracking-wider">
                        OUT
                      </th>
                      <th className="w-40 px-4 py-4 text-right text-xs font-bold text-gray-400 uppercase tracking-wider">
                        Balance
                      </th>
                      <th className="w-20 px-4 py-4 text-center text-xs font-bold text-gray-400 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {/* Inline Add Row - Excel Style - AT TOP */}
                    <tr className="bg-white/5 border-b-2 border-emerald-500/50 sticky top-[57px] z-10">
                      <td className="px-4 py-3">
                        <input
                          type="date"
                          value={newRow.date}
                          onChange={(e) =>
                            setNewRow({ ...newRow, date: e.target.value })
                          }
                          className="w-full px-3 py-2 text-sm bg-white/10 text-white border-2 border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                          disabled={isSavingInline}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          placeholder="Enter description..."
                          value={newRow.description}
                          onChange={(e) =>
                            setNewRow({
                              ...newRow,
                              description: e.target.value,
                            })
                          }
                          onKeyDown={(e) =>
                            handleInlineKeyDown(e, "description")
                          }
                          className="w-full px-3 py-2 text-sm bg-white/10 text-white border-2 border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all placeholder:text-gray-400"
                          disabled={isSavingInline}
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <input
                          type="number"
                          placeholder="0.00"
                          step="0.01"
                          min="0"
                          value={newRow.credit}
                          onChange={(e) =>
                            setNewRow({
                              ...newRow,
                              credit: e.target.value,
                              debit: "",
                            })
                          }
                          onKeyDown={(e) => handleInlineKeyDown(e, "credit")}
                          className="w-full px-3 py-2 text-sm text-right bg-emerald-500/10 text-white border-2 border-emerald-500/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all placeholder:text-gray-400"
                          disabled={isSavingInline}
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <input
                          type="number"
                          placeholder="0.00"
                          step="0.01"
                          min="0"
                          value={newRow.debit}
                          onChange={(e) =>
                            setNewRow({
                              ...newRow,
                              debit: e.target.value,
                              credit: "",
                            })
                          }
                          onKeyDown={(e) => handleInlineKeyDown(e, "debit")}
                          className="w-full px-3 py-2 text-sm text-right border-2 border-red-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all placeholder:text-gray-400 bg-red-50/30"
                          disabled={isSavingInline}
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-xs font-medium text-gray-500 italic">
                          {isSavingInline ? "Saving..." : "Auto-save"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          onClick={handleInlineAdd}
                          disabled={
                            isSavingInline || !newRow.description.trim()
                          }
                          className="p-2.5 bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl transition-all duration-200 hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Save transaction"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>

                    {currentTransactions.map((transaction, index) => {
                      // Calculate balance from the end (current balance at top)
                      const remainingTransactions =
                        currentTransactions.slice(index);
                      const runningBalance = remainingTransactions.reduce(
                        (sum, t) =>
                          sum + Number(t.credit || 0) - Number(t.debit || 0),
                        0
                      );

                      return (
                        <tr
                          key={transaction.id}
                          className="hover:bg-white/5 transition-all duration-200"
                        >
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="text-sm font-semibold text-white">
                              {new Date(
                                transaction.transaction_date
                              ).toLocaleDateString("en-GB", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm font-medium text-white">
                              {transaction.description}
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-right">
                            {transaction.credit > 0 ? (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs font-bold border border-emerald-500/30 whitespace-nowrap">
                                +
                                {formatCurrency(
                                  transaction.credit,
                                  currencySymbol
                                )}
                              </span>
                            ) : (
                              <span className="text-gray-300 text-sm">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-right">
                            {transaction.debit > 0 ? (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-red-50 text-red-700 text-xs font-bold border border-red-200 whitespace-nowrap">
                                -
                                {formatCurrency(
                                  transaction.debit,
                                  currencySymbol
                                )}
                              </span>
                            ) : (
                              <span className="text-gray-300 text-sm">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-right">
                            <div
                              className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap ${
                                runningBalance >= 0
                                  ? "bg-emerald-100 text-emerald-700 border border-emerald-300"
                                  : "bg-red-100 text-red-700 border border-red-300"
                              }`}
                            >
                              {runningBalance >= 0 ? "+" : ""}
                              {formatCurrency(runningBalance, currencySymbol)}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() =>
                                deleteTransaction(transaction.id, activeTab)
                              }
                              className="p-2.5 text-red-400 hover:bg-red-500/10 rounded-xl transition-all duration-200 hover:scale-110"
                              title="Delete transaction"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Add Transaction Modal - Ultra Modern */}
        {showAddTransaction && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-3 sm:p-4 animate-fadeIn">
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl sm:rounded-3xl shadow-2xl max-w-2xl w-full max-h-[95vh] overflow-hidden transform animate-scaleIn">
              {/* Modal Header */}
              <div className="sticky top-0 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 px-4 sm:px-6 py-4 sm:py-5 flex items-center justify-between shadow-lg z-10">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
                    <Plus className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black text-white drop-shadow-lg">
                    Add Transaction
                  </h2>
                </div>
                <button
                  onClick={() => setShowAddTransaction(false)}
                  className="p-2 hover:bg-white/20 rounded-xl transition-all duration-200 active:scale-90"
                >
                  <X className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </button>
              </div>

              {/* Modal Body */}
              <form
                onSubmit={handleAddTransaction}
                className="p-4 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto max-h-[calc(95vh-80px)]"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                  <div className="group">
                    <label className="flex items-center gap-2 text-sm font-bold text-gray-400 mb-2">
                      <span className="text-emerald-400">💱</span>
                      Transaction Type *
                    </label>
                    <select
                      name="transaction_type"
                      className="w-full px-4 py-3 sm:py-3.5 bg-white/10 text-white border-2 border-white/20 rounded-xl sm:rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all duration-200 text-sm sm:text-base font-semibold hover:border-emerald-400"
                      required
                    >
                      <option value="payment" className="bg-gray-900">
                        💰 Money IN (Payment)
                      </option>
                      <option value="invoice" className="bg-gray-900">
                        📄 Money OUT (Invoice)
                      </option>
                    </select>
                  </div>

                  <div className="group">
                    <label className="flex items-center gap-2 text-sm font-bold text-gray-400 mb-2">
                      <span className="text-emerald-400">💵</span>
                      Amount *
                    </label>
                    <input
                      type="number"
                      name="amount"
                      step="0.01"
                      min="0"
                      required
                      className="w-full px-4 py-3 sm:py-3.5 bg-white/10 text-white border-2 border-white/20 rounded-xl sm:rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all duration-200 text-sm sm:text-base font-semibold hover:border-emerald-400 placeholder-gray-400"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className="group">
                  <label className="flex items-center gap-2 text-sm font-bold text-gray-400 mb-2">
                    <span className="text-emerald-400">🌍</span>
                    Currency *
                  </label>
                  <select
                    name="currency"
                    defaultValue={activeTab}
                    className="w-full px-4 py-3 sm:py-3.5 bg-white/10 text-white border-2 border-white/20 rounded-xl sm:rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all duration-200 text-sm sm:text-base font-semibold hover:border-emerald-400"
                    required
                  >
                    <option value="kes" className="bg-gray-900">
                      🇰🇪 Kenyan Shillings (KES)
                    </option>
                    <option value="usd" className="bg-gray-900">
                      🇺🇸 US Dollars (USD)
                    </option>
                  </select>
                </div>

                <div className="group">
                  <label className="flex items-center gap-2 text-sm font-bold text-gray-400 mb-2">
                    <span className="text-emerald-400">📝</span>
                    Reason *
                  </label>
                  <input
                    type="text"
                    name="description"
                    required
                    className="w-full px-4 py-3 sm:py-3.5 bg-white/10 text-white border-2 border-white/20 rounded-xl sm:rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all duration-200 text-sm sm:text-base font-semibold hover:border-emerald-400 placeholder-gray-400"
                    placeholder="e.g., Payment for web development services"
                  />
                </div>

                <div className="group">
                  <label className="flex items-center gap-2 text-sm font-bold text-gray-400 mb-2">
                    <span className="text-emerald-400">📅</span>
                    Date *
                  </label>
                  <input
                    type="date"
                    name="transaction_date"
                    defaultValue={new Date().toISOString().split("T")[0]}
                    required
                    className="w-full px-4 py-3 sm:py-3.5 bg-white/10 text-white border-2 border-white/20 rounded-xl sm:rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all duration-200 text-sm sm:text-base font-semibold hover:border-emerald-400"
                  />
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowAddTransaction(false)}
                    className="flex-1 px-6 py-3 sm:py-3.5 bg-white/10 border-2 border-white/20 rounded-xl sm:rounded-2xl text-gray-300 font-bold hover:bg-white/20 hover:border-white/30 transition-all duration-200 text-sm sm:text-base active:scale-95"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-6 py-3 sm:py-3.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 text-white rounded-xl sm:rounded-2xl font-black hover:shadow-2xl hover:shadow-emerald-500/50 transition-all duration-300 text-sm sm:text-base active:scale-95"
                  >
                    ✓ Add Transaction
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

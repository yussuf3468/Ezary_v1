import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import {
  Plus,
  Trash2,
  CreditCard,
  Banknote,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Users,
  DollarSign,
} from "lucide-react";
import Modal from "./Modal";
import {
  formatCurrency,
  parseCurrency,
  formatNumberInput,
} from "../lib/currency";

interface DebtRecord {
  id: string;
  creditor_name: string;
  amount: number;
  amount_paid: number;
  due_date: string | null;
  status: "unpaid" | "partially_paid" | "cleared";
  notes?: string;
}

interface LoanRecord {
  id: string;
  debtor_name: string;
  amount: number;
  amount_received: number;
  due_date: string | null;
  status: "unpaid" | "partially_paid" | "cleared";
  notes?: string;
}

type ActiveTab = "overview" | "debts" | "loans";

export default function Debts() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<ActiveTab>("overview");
  const [debts, setDebts] = useState<DebtRecord[]>([]);
  const [loans, setLoans] = useState<LoanRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Debt form states
  const [showDebtForm, setShowDebtForm] = useState(false);
  const [showDebtPaymentForm, setShowDebtPaymentForm] = useState<string | null>(
    null
  );
  const [debtPaymentAmount, setDebtPaymentAmount] = useState("");
  const [debtFormData, setDebtFormData] = useState({
    creditor_name: "",
    amount: "",
    due_date: "",
    notes: "",
  });

  // Loan form states
  const [showLoanForm, setShowLoanForm] = useState(false);
  const [showLoanPaymentForm, setShowLoanPaymentForm] = useState<string | null>(
    null
  );
  const [loanPaymentAmount, setLoanPaymentAmount] = useState("");
  const [loanFormData, setLoanFormData] = useState({
    debtor_name: "",
    amount: "",
    due_date: "",
    notes: "",
  });

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);

    try {
      const [debtsResult, loansResult] = await Promise.all([
        supabase
          .from("debts")
          .select("*")
          .eq("user_id", user.id)
          .order("due_date", { ascending: true }),
        supabase
          .from("loans")
          .select("*")
          .eq("user_id", user.id)
          .order("due_date", { ascending: true }),
      ]);

      if (debtsResult.error) throw debtsResult.error;
      if (loansResult.error) throw loansResult.error;

      setDebts(debtsResult.data || []);
      setLoans(loansResult.data || []);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Debt operations
  const handleDebtSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const insertData: any = {
        user_id: user.id,
        creditor_name: debtFormData.creditor_name,
        amount: parseCurrency(debtFormData.amount),
        amount_paid: 0,
        due_date: debtFormData.due_date || null,
        status: "unpaid",
      };

      // Only add notes if the column exists (it might not be in older schemas)
      if (debtFormData.notes) {
        insertData.notes = debtFormData.notes;
      }

      const { error } = await supabase.from("debts").insert(insertData);

      if (error) {
        console.error("Error adding debt:", error);
        alert(`Error adding debt: ${error.message}`);
        return;
      }

      setDebtFormData({
        creditor_name: "",
        amount: "",
        due_date: "",
        notes: "",
      });
      setShowDebtForm(false);
      loadData();
    } catch (error: any) {
      console.error("Error adding debt:", error);
      alert(`Error adding debt: ${error.message || "Unknown error"}`);
    }
  };

  const handleDebtPayment = async (debtId: string) => {
    if (!debtPaymentAmount || !user) return;

    const debt = debts.find((d) => d.id === debtId);
    if (!debt) return;

    const paymentValue = parseCurrency(debtPaymentAmount);
    const newAmountPaid = Number(debt.amount_paid) + paymentValue;
    const remaining = Number(debt.amount) - newAmountPaid;

    let newStatus: "unpaid" | "partially_paid" | "cleared" = "unpaid";
    if (remaining <= 0) {
      newStatus = "cleared";
    } else if (newAmountPaid > 0) {
      newStatus = "partially_paid";
    }

    try {
      const { error } = await supabase
        .from("debts")
        .update({
          amount_paid:
            newAmountPaid >= Number(debt.amount)
              ? Number(debt.amount)
              : newAmountPaid,
          status: newStatus,
        })
        .eq("id", debtId);

      if (error) throw error;

      setDebtPaymentAmount("");
      setShowDebtPaymentForm(null);
      loadData();
    } catch (error) {
      console.error("Error recording payment:", error);
    }
  };

  const handleDeleteDebt = async (id: string) => {
    if (!confirm("Are you sure you want to delete this debt?")) return;

    try {
      const { error } = await supabase.from("debts").delete().eq("id", id);
      if (error) throw error;
      loadData();
    } catch (error) {
      console.error("Error deleting debt:", error);
    }
  };

  // Loan operations
  const handleLoanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const insertData: any = {
        user_id: user.id,
        debtor_name: loanFormData.debtor_name,
        amount: parseCurrency(loanFormData.amount),
        amount_received: 0,
        due_date: loanFormData.due_date || null,
        status: "unpaid",
      };

      // Only add notes if the column exists (it might not be in older schemas)
      if (loanFormData.notes) {
        insertData.notes = loanFormData.notes;
      }

      const { error } = await supabase.from("loans").insert(insertData);

      if (error) {
        console.error("Error adding loan:", error);
        alert(`Error adding loan: ${error.message}`);
        return;
      }

      setLoanFormData({ debtor_name: "", amount: "", due_date: "", notes: "" });
      setShowLoanForm(false);
      loadData();
    } catch (error: any) {
      console.error("Error adding loan:", error);
      alert(`Error adding loan: ${error.message || "Unknown error"}`);
    }
  };

  const handleLoanPayment = async (loanId: string) => {
    if (!loanPaymentAmount || !user) return;

    const loan = loans.find((l) => l.id === loanId);
    if (!loan) return;

    const paymentValue = parseCurrency(loanPaymentAmount);
    const newAmountReceived = Number(loan.amount_received) + paymentValue;
    const remaining = Number(loan.amount) - newAmountReceived;

    let newStatus: "unpaid" | "partially_paid" | "cleared" = "unpaid";
    if (remaining <= 0) {
      newStatus = "cleared";
    } else if (newAmountReceived > 0) {
      newStatus = "partially_paid";
    }

    try {
      const { error } = await supabase
        .from("loans")
        .update({
          amount_received:
            newAmountReceived >= Number(loan.amount)
              ? Number(loan.amount)
              : newAmountReceived,
          status: newStatus,
        })
        .eq("id", loanId);

      if (error) throw error;

      setLoanPaymentAmount("");
      setShowLoanPaymentForm(null);
      loadData();
    } catch (error) {
      console.error("Error recording payment:", error);
    }
  };

  const handleDeleteLoan = async (id: string) => {
    if (!confirm("Are you sure you want to delete this loan?")) return;

    try {
      const { error } = await supabase.from("loans").delete().eq("id", id);
      if (error) throw error;
      loadData();
    } catch (error) {
      console.error("Error deleting loan:", error);
    }
  };

  // Calculate totals
  const totalDebt = debts.reduce((sum, d) => sum + Number(d.amount), 0);
  const totalDebtPaid = debts.reduce(
    (sum, d) => sum + Number(d.amount_paid),
    0
  );
  const totalDebtRemaining = totalDebt - totalDebtPaid;

  const totalLoaned = loans.reduce((sum, l) => sum + Number(l.amount), 0);
  const totalLoanReceived = loans.reduce(
    (sum, l) => sum + Number(l.amount_received),
    0
  );
  const totalLoanRemaining = totalLoaned - totalLoanReceived;

  const netPosition = totalLoanRemaining - totalDebtRemaining;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 pb-20 sm:pb-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-rose-500 to-pink-600 p-4 sm:p-6 rounded-xl text-white shadow-lg">
        <h2 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
          <CreditCard className="h-6 w-6 sm:h-8 sm:w-8" />
          Debts & Loans Manager
        </h2>
        <p className="text-rose-50 text-sm mt-1">
          Track what you owe and what's owed to you
        </p>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-md p-1 flex gap-1">
        <button
          onClick={() => setActiveTab("overview")}
          className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === "overview"
              ? "bg-gradient-to-r from-rose-500 to-pink-600 text-white"
              : "text-gray-700 hover:bg-gray-100"
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab("debts")}
          className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === "debts"
              ? "bg-gradient-to-r from-rose-500 to-pink-600 text-white"
              : "text-gray-700 hover:bg-gray-100"
          }`}
        >
          I Owe ({debts.filter((d) => d.status !== "cleared").length})
        </button>
        <button
          onClick={() => setActiveTab("loans")}
          className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === "loans"
              ? "bg-gradient-to-r from-rose-500 to-pink-600 text-white"
              : "text-gray-700 hover:bg-gray-100"
          }`}
        >
          Owed to Me ({loans.filter((l) => l.status !== "cleared").length})
        </button>
      </div>

      {/* Overview Tab */}
      {activeTab === "overview" && (
        <div className="space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total I Owe */}
            <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl p-4 text-white shadow-lg">
              <div className="flex items-center justify-between mb-2">
                <TrendingDown className="h-8 w-8 opacity-80" />
              </div>
              <p className="text-red-100 text-xs sm:text-sm">Total I Owe</p>
              <p className="text-xl sm:text-2xl font-bold mt-1">
                {formatCurrency(totalDebtRemaining)}
              </p>
              <p className="text-xs text-red-100 mt-1">
                of {formatCurrency(totalDebt)}
              </p>
            </div>

            {/* Owed to Me */}
            <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-4 text-white shadow-lg">
              <div className="flex items-center justify-between mb-2">
                <TrendingUp className="h-8 w-8 opacity-80" />
              </div>
              <p className="text-emerald-100 text-xs sm:text-sm">Owed to Me</p>
              <p className="text-xl sm:text-2xl font-bold mt-1">
                {formatCurrency(totalLoanRemaining)}
              </p>
              <p className="text-xs text-emerald-100 mt-1">
                of {formatCurrency(totalLoaned)}
              </p>
            </div>

            {/* Net Position */}
            <div
              className={`bg-gradient-to-br ${
                netPosition >= 0
                  ? "from-cyan-500 to-cyan-600"
                  : "from-amber-500 to-amber-600"
              } rounded-xl p-4 text-white shadow-lg`}
            >
              <div className="flex items-center justify-between mb-2">
                <DollarSign className="h-8 w-8 opacity-80" />
              </div>
              <p className="text-white/90 text-xs sm:text-sm">Net Position</p>
              <p className="text-xl sm:text-2xl font-bold mt-1">
                {formatCurrency(Math.abs(netPosition))}
              </p>
              <p className="text-xs text-white/80 mt-1">
                {netPosition >= 0 ? "In your favor" : "You owe more"}
              </p>
            </div>

            {/* Active Items */}
            <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-4 text-white shadow-lg">
              <div className="flex items-center justify-between mb-2">
                <Users className="h-8 w-8 opacity-80" />
              </div>
              <p className="text-purple-100 text-xs sm:text-sm">Active Items</p>
              <p className="text-xl sm:text-2xl font-bold mt-1">
                {debts.filter((d) => d.status !== "cleared").length +
                  loans.filter((l) => l.status !== "cleared").length}
              </p>
              <p className="text-xs text-purple-100 mt-1">
                {debts.filter((d) => d.status !== "cleared").length} debts,{" "}
                {loans.filter((l) => l.status !== "cleared").length} loans
              </p>
            </div>
          </div>

          {/* Quick Overview Lists */}
          <div className="grid md:grid-cols-2 gap-4">
            {/* Active Debts */}
            <div className="bg-white rounded-xl shadow-md p-4 sm:p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-red-600" />
                What I Owe (Active)
              </h3>
              <div className="space-y-2">
                {debts
                  .filter((d) => d.status !== "cleared")
                  .slice(0, 5)
                  .map((debt) => {
                    const remaining =
                      Number(debt.amount) - Number(debt.amount_paid);
                    return (
                      <div
                        key={debt.id}
                        className="flex justify-between items-center p-3 bg-red-50 rounded-lg"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate">
                            {debt.creditor_name}
                          </p>
                          <p className="text-xs text-gray-500">
                            Due:{" "}
                            {debt.due_date
                              ? new Date(debt.due_date).toLocaleDateString(
                                  "en-KE"
                                )
                              : "No date"}
                          </p>
                        </div>
                        <span className="text-sm font-bold text-red-600 ml-2">
                          {formatCurrency(remaining)}
                        </span>
                      </div>
                    );
                  })}
                {debts.filter((d) => d.status !== "cleared").length === 0 && (
                  <p className="text-gray-500 text-sm text-center py-4">
                    No active debts
                  </p>
                )}
                {debts.filter((d) => d.status !== "cleared").length > 5 && (
                  <button
                    onClick={() => setActiveTab("debts")}
                    className="w-full text-center text-sm text-rose-600 hover:text-rose-700 font-medium mt-2"
                  >
                    View all{" "}
                    {debts.filter((d) => d.status !== "cleared").length} debts →
                  </button>
                )}
              </div>
            </div>

            {/* Active Loans */}
            <div className="bg-white rounded-xl shadow-md p-4 sm:p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                <Banknote className="h-5 w-5 text-emerald-600" />
                Owed to Me (Active)
              </h3>
              <div className="space-y-2">
                {loans
                  .filter((l) => l.status !== "cleared")
                  .slice(0, 5)
                  .map((loan) => {
                    const remaining =
                      Number(loan.amount) - Number(loan.amount_received);
                    return (
                      <div
                        key={loan.id}
                        className="flex justify-between items-center p-3 bg-emerald-50 rounded-lg"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate">
                            {loan.debtor_name}
                          </p>
                          <p className="text-xs text-gray-500">
                            Due:{" "}
                            {loan.due_date
                              ? new Date(loan.due_date).toLocaleDateString(
                                  "en-KE"
                                )
                              : "No date"}
                          </p>
                        </div>
                        <span className="text-sm font-bold text-emerald-600 ml-2">
                          {formatCurrency(remaining)}
                        </span>
                      </div>
                    );
                  })}
                {loans.filter((l) => l.status !== "cleared").length === 0 && (
                  <p className="text-gray-500 text-sm text-center py-4">
                    No active loans
                  </p>
                )}
                {loans.filter((l) => l.status !== "cleared").length > 5 && (
                  <button
                    onClick={() => setActiveTab("loans")}
                    className="w-full text-center text-sm text-emerald-600 hover:text-emerald-700 font-medium mt-2"
                  >
                    View all{" "}
                    {loans.filter((l) => l.status !== "cleared").length} loans →
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Debts Tab */}
      {activeTab === "debts" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold text-gray-900">What I Owe</h3>
            <button
              onClick={() => setShowDebtForm(true)}
              className="flex items-center gap-2 bg-gradient-to-r from-rose-500 to-pink-600 text-white px-4 py-2 rounded-lg hover:from-rose-600 hover:to-pink-700 transition-colors font-semibold shadow-md"
            >
              <Plus className="h-4 w-4" />
              Add Debt
            </button>
          </div>

          {/* Mobile: Cards */}
          <div className="block sm:hidden space-y-3">
            {debts.map((debt) => {
              const remaining = Number(debt.amount) - Number(debt.amount_paid);
              const progress =
                (Number(debt.amount_paid) / Number(debt.amount)) * 100;
              return (
                <div
                  key={debt.id}
                  className="bg-white rounded-lg shadow-md p-4"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <h4 className="font-bold text-gray-900">
                        {debt.creditor_name}
                      </h4>
                      {debt.notes && (
                        <p className="text-xs text-gray-500 mt-1">
                          {debt.notes}
                        </p>
                      )}
                    </div>
                    <span
                      className={`text-xs font-medium px-2 py-1 rounded ${
                        debt.status === "cleared"
                          ? "bg-emerald-100 text-emerald-700"
                          : debt.status === "partially_paid"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {debt.status === "cleared"
                        ? "Cleared"
                        : debt.status === "partially_paid"
                        ? "Partial"
                        : "Unpaid"}
                    </span>
                  </div>

                  <div className="space-y-2 mb-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Total:</span>
                      <span className="font-semibold">
                        {formatCurrency(debt.amount)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Paid:</span>
                      <span className="font-semibold text-emerald-600">
                        {formatCurrency(debt.amount_paid)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Remaining:</span>
                      <span className="font-semibold text-red-600">
                        {formatCurrency(remaining)}
                      </span>
                    </div>
                    {debt.due_date && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Due:</span>
                        <span className="text-gray-900">
                          {new Date(debt.due_date).toLocaleDateString("en-KE")}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
                    <div
                      className="bg-gradient-to-r from-emerald-500 to-emerald-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>

                  <div className="flex gap-2">
                    {debt.status !== "cleared" && (
                      <button
                        onClick={() => setShowDebtPaymentForm(debt.id)}
                        className="flex-1 bg-emerald-500 text-white px-3 py-2 rounded-lg hover:bg-emerald-600 transition-colors text-sm font-medium"
                      >
                        Make Payment
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteDebt(debt.id)}
                      className="bg-red-500 text-white px-3 py-2 rounded-lg hover:bg-red-600 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
            {debts.length === 0 && (
              <p className="text-gray-500 text-center py-8">
                No debts recorded. Click "Add Debt" to start tracking what you
                owe.
              </p>
            )}
          </div>

          {/* Desktop: Table */}
          <div className="hidden sm:block bg-white rounded-xl shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">
                      Creditor
                    </th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700">
                      Total Amount
                    </th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700">
                      Paid
                    </th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700">
                      Remaining
                    </th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-700">
                      Due Date
                    </th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-700">
                      Status
                    </th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-700">
                      Progress
                    </th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-700">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {debts.map((debt) => {
                    const remaining =
                      Number(debt.amount) - Number(debt.amount_paid);
                    const progress =
                      (Number(debt.amount_paid) / Number(debt.amount)) * 100;
                    return (
                      <tr
                        key={debt.id}
                        className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                      >
                        <td className="py-3 px-4">
                          <div>
                            <p className="font-medium text-gray-900">
                              {debt.creditor_name}
                            </p>
                            {debt.notes && (
                              <p className="text-xs text-gray-500 mt-1">
                                {debt.notes}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="text-right py-3 px-4 font-semibold">
                          {formatCurrency(debt.amount)}
                        </td>
                        <td className="text-right py-3 px-4 text-emerald-600 font-semibold">
                          {formatCurrency(debt.amount_paid)}
                        </td>
                        <td className="text-right py-3 px-4 text-red-600 font-semibold">
                          {formatCurrency(remaining)}
                        </td>
                        <td className="text-center py-3 px-4 text-gray-600">
                          {debt.due_date
                            ? new Date(debt.due_date).toLocaleDateString(
                                "en-KE"
                              )
                            : "-"}
                        </td>
                        <td className="text-center py-3 px-4">
                          <span
                            className={`text-xs font-medium px-3 py-1 rounded-full ${
                              debt.status === "cleared"
                                ? "bg-emerald-100 text-emerald-700"
                                : debt.status === "partially_paid"
                                ? "bg-amber-100 text-amber-700"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {debt.status === "cleared"
                              ? "Cleared"
                              : debt.status === "partially_paid"
                              ? "Partial"
                              : "Unpaid"}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-gradient-to-r from-emerald-500 to-emerald-600 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-600 w-12 text-right">
                              {progress.toFixed(0)}%
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-center gap-2">
                            {debt.status !== "cleared" && (
                              <button
                                onClick={() => setShowDebtPaymentForm(debt.id)}
                                className="bg-emerald-500 text-white px-3 py-1 rounded-lg hover:bg-emerald-600 transition-colors text-sm"
                              >
                                Pay
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteDebt(debt.id)}
                              className="text-red-600 hover:text-red-700 transition-colors"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {debts.length === 0 && (
              <p className="text-gray-500 text-center py-8">
                No debts recorded. Click "Add Debt" to start tracking what you
                owe.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Loans Tab */}
      {activeTab === "loans" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold text-gray-900">Owed to Me</h3>
            <button
              onClick={() => setShowLoanForm(true)}
              className="flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white px-4 py-2 rounded-lg hover:from-emerald-600 hover:to-emerald-700 transition-colors font-semibold shadow-md"
            >
              <Plus className="h-4 w-4" />
              Add Loan
            </button>
          </div>

          {/* Mobile: Cards */}
          <div className="block sm:hidden space-y-3">
            {loans.map((loan) => {
              const remaining =
                Number(loan.amount) - Number(loan.amount_received);
              const progress =
                (Number(loan.amount_received) / Number(loan.amount)) * 100;
              return (
                <div
                  key={loan.id}
                  className="bg-white rounded-lg shadow-md p-4"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <h4 className="font-bold text-gray-900">
                        {loan.debtor_name}
                      </h4>
                      {loan.notes && (
                        <p className="text-xs text-gray-500 mt-1">
                          {loan.notes}
                        </p>
                      )}
                    </div>
                    <span
                      className={`text-xs font-medium px-2 py-1 rounded ${
                        loan.status === "cleared"
                          ? "bg-emerald-100 text-emerald-700"
                          : loan.status === "partially_paid"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {loan.status === "cleared"
                        ? "Cleared"
                        : loan.status === "partially_paid"
                        ? "Partial"
                        : "Unpaid"}
                    </span>
                  </div>

                  <div className="space-y-2 mb-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Total:</span>
                      <span className="font-semibold">
                        {formatCurrency(loan.amount)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Received:</span>
                      <span className="font-semibold text-emerald-600">
                        {formatCurrency(loan.amount_received)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Remaining:</span>
                      <span className="font-semibold text-amber-600">
                        {formatCurrency(remaining)}
                      </span>
                    </div>
                    {loan.due_date && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Due:</span>
                        <span className="text-gray-900">
                          {new Date(loan.due_date).toLocaleDateString("en-KE")}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
                    <div
                      className="bg-gradient-to-r from-emerald-500 to-emerald-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>

                  <div className="flex gap-2">
                    {loan.status !== "cleared" && (
                      <button
                        onClick={() => setShowLoanPaymentForm(loan.id)}
                        className="flex-1 bg-emerald-500 text-white px-3 py-2 rounded-lg hover:bg-emerald-600 transition-colors text-sm font-medium"
                      >
                        Record Payment
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteLoan(loan.id)}
                      className="bg-red-500 text-white px-3 py-2 rounded-lg hover:bg-red-600 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
            {loans.length === 0 && (
              <p className="text-gray-500 text-center py-8">
                No loans recorded. Click "Add Loan" to track money others owe
                you.
              </p>
            )}
          </div>

          {/* Desktop: Table */}
          <div className="hidden sm:block bg-white rounded-xl shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">
                      Debtor
                    </th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700">
                      Total Amount
                    </th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700">
                      Received
                    </th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700">
                      Remaining
                    </th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-700">
                      Due Date
                    </th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-700">
                      Status
                    </th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-700">
                      Progress
                    </th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-700">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loans.map((loan) => {
                    const remaining =
                      Number(loan.amount) - Number(loan.amount_received);
                    const progress =
                      (Number(loan.amount_received) / Number(loan.amount)) *
                      100;
                    return (
                      <tr
                        key={loan.id}
                        className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                      >
                        <td className="py-3 px-4">
                          <div>
                            <p className="font-medium text-gray-900">
                              {loan.debtor_name}
                            </p>
                            {loan.notes && (
                              <p className="text-xs text-gray-500 mt-1">
                                {loan.notes}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="text-right py-3 px-4 font-semibold">
                          {formatCurrency(loan.amount)}
                        </td>
                        <td className="text-right py-3 px-4 text-emerald-600 font-semibold">
                          {formatCurrency(loan.amount_received)}
                        </td>
                        <td className="text-right py-3 px-4 text-amber-600 font-semibold">
                          {formatCurrency(remaining)}
                        </td>
                        <td className="text-center py-3 px-4 text-gray-600">
                          {loan.due_date
                            ? new Date(loan.due_date).toLocaleDateString(
                                "en-KE"
                              )
                            : "-"}
                        </td>
                        <td className="text-center py-3 px-4">
                          <span
                            className={`text-xs font-medium px-3 py-1 rounded-full ${
                              loan.status === "cleared"
                                ? "bg-emerald-100 text-emerald-700"
                                : loan.status === "partially_paid"
                                ? "bg-amber-100 text-amber-700"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {loan.status === "cleared"
                              ? "Cleared"
                              : loan.status === "partially_paid"
                              ? "Partial"
                              : "Unpaid"}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-gradient-to-r from-emerald-500 to-emerald-600 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-600 w-12 text-right">
                              {progress.toFixed(0)}%
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-center gap-2">
                            {loan.status !== "cleared" && (
                              <button
                                onClick={() => setShowLoanPaymentForm(loan.id)}
                                className="bg-emerald-500 text-white px-3 py-1 rounded-lg hover:bg-emerald-600 transition-colors text-sm"
                              >
                                Receive
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteLoan(loan.id)}
                              className="text-red-600 hover:text-red-700 transition-colors"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {loans.length === 0 && (
              <p className="text-gray-500 text-center py-8">
                No loans recorded. Click "Add Loan" to track money others owe
                you.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Add Debt Modal */}
      <Modal
        isOpen={showDebtForm}
        onClose={() => setShowDebtForm(false)}
        title="Add New Debt"
      >
        <form onSubmit={handleDebtSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Creditor Name *
            </label>
            <input
              type="text"
              required
              value={debtFormData.creditor_name}
              onChange={(e) =>
                setDebtFormData({
                  ...debtFormData,
                  creditor_name: e.target.value,
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent"
              placeholder="e.g., Guy1, Shop1"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Amount *
            </label>
            <input
              type="text"
              required
              value={debtFormData.amount}
              onChange={(e) =>
                setDebtFormData({
                  ...debtFormData,
                  amount: formatNumberInput(e.target.value),
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent"
              placeholder="100,000.00"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Due Date (Optional)
            </label>
            <input
              type="date"
              value={debtFormData.due_date}
              onChange={(e) =>
                setDebtFormData({ ...debtFormData, due_date: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes (Optional)
            </label>
            <textarea
              value={debtFormData.notes}
              onChange={(e) =>
                setDebtFormData({ ...debtFormData, notes: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent"
              placeholder="Any additional details..."
              rows={3}
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowDebtForm(false)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 bg-gradient-to-r from-rose-500 to-pink-600 text-white px-4 py-2 rounded-lg hover:from-rose-600 hover:to-pink-700 transition-colors font-semibold"
            >
              Add Debt
            </button>
          </div>
        </form>
      </Modal>

      {/* Debt Payment Modal */}
      <Modal
        isOpen={showDebtPaymentForm !== null}
        onClose={() => {
          setShowDebtPaymentForm(null);
          setDebtPaymentAmount("");
        }}
        title="Record Debt Payment"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (showDebtPaymentForm) handleDebtPayment(showDebtPaymentForm);
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Payment Amount
            </label>
            <input
              type="text"
              required
              value={debtPaymentAmount}
              onChange={(e) =>
                setDebtPaymentAmount(formatNumberInput(e.target.value))
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              placeholder="10,000.00"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setShowDebtPaymentForm(null);
                setDebtPaymentAmount("");
              }}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 bg-emerald-500 text-white px-4 py-2 rounded-lg hover:bg-emerald-600 transition-colors font-semibold"
            >
              Record Payment
            </button>
          </div>
        </form>
      </Modal>

      {/* Add Loan Modal */}
      <Modal
        isOpen={showLoanForm}
        onClose={() => setShowLoanForm(false)}
        title="Add New Loan"
      >
        <form onSubmit={handleLoanSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Debtor Name *
            </label>
            <input
              type="text"
              required
              value={loanFormData.debtor_name}
              onChange={(e) =>
                setLoanFormData({
                  ...loanFormData,
                  debtor_name: e.target.value,
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              placeholder="e.g., Guy2, Guy3"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Amount *
            </label>
            <input
              type="text"
              required
              value={loanFormData.amount}
              onChange={(e) =>
                setLoanFormData({
                  ...loanFormData,
                  amount: formatNumberInput(e.target.value),
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              placeholder="67,000.00"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Due Date (Optional)
            </label>
            <input
              type="date"
              value={loanFormData.due_date}
              onChange={(e) =>
                setLoanFormData({ ...loanFormData, due_date: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes (Optional)
            </label>
            <textarea
              value={loanFormData.notes}
              onChange={(e) =>
                setLoanFormData({ ...loanFormData, notes: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              placeholder="Any additional details..."
              rows={3}
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowLoanForm(false)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white px-4 py-2 rounded-lg hover:from-emerald-600 hover:to-emerald-700 transition-colors font-semibold"
            >
              Add Loan
            </button>
          </div>
        </form>
      </Modal>

      {/* Loan Payment Modal */}
      <Modal
        isOpen={showLoanPaymentForm !== null}
        onClose={() => {
          setShowLoanPaymentForm(null);
          setLoanPaymentAmount("");
        }}
        title="Record Loan Payment Received"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (showLoanPaymentForm) handleLoanPayment(showLoanPaymentForm);
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Payment Amount Received
            </label>
            <input
              type="text"
              required
              value={loanPaymentAmount}
              onChange={(e) =>
                setLoanPaymentAmount(formatNumberInput(e.target.value))
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              placeholder="10,000.00"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setShowLoanPaymentForm(null);
                setLoanPaymentAmount("");
              }}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 bg-emerald-500 text-white px-4 py-2 rounded-lg hover:bg-emerald-600 transition-colors font-semibold"
            >
              Record Payment
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

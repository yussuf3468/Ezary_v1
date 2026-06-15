import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "react-toastify";
import {
  ArrowLeft,
  Phone,
  TrendingUp,
  TrendingDown,
  Wallet,
  Download,
  Plus,
  Trash2,
  Edit2,
  Lock,
  Highlighter,
  Ban,
} from "lucide-react";
import { formatCurrency } from "../lib/currency";
import { generateClientPDFReport } from "../lib/pdfGenerator";
import { getBusinessProfile } from "../lib/businessProfiles";
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Modal,
  Select,
  StatTile,
} from "./ui";

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
  highlight_color?: string | null;
}

// Excel-style fill palette — a broad, vivid spectrum that still stays legible
// under the dark ledger text, and renders identically in the PDF statement.
const HIGHLIGHT_COLORS: { name: string; hex: string }[] = [
  { name: "Red", hex: "#FCA5A5" },
  { name: "Orange", hex: "#FDBA74" },
  { name: "Amber", hex: "#FCD34D" },
  { name: "Yellow", hex: "#FDE047" },
  { name: "Lime", hex: "#BEF264" },
  { name: "Green", hex: "#86EFAC" },
  { name: "Teal", hex: "#5EEAD4" },
  { name: "Cyan", hex: "#67E8F9" },
  { name: "Sky", hex: "#7DD3FC" },
  { name: "Blue", hex: "#93C5FD" },
  { name: "Indigo", hex: "#A5B4FC" },
  { name: "Violet", hex: "#C4B5FD" },
  { name: "Purple", hex: "#D8B4FE" },
  { name: "Pink", hex: "#F9A8D4" },
  { name: "Slate", hex: "#CBD5E1" },
];

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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const dragging = useRef(false);
  const dragAnchor = useRef<number | null>(null);
  const [showStatementModal, setShowStatementModal] = useState(false);
  const [showAddTransaction, setShowAddTransaction] = useState(false);
  const [showEditTransaction, setShowEditTransaction] = useState(false);
  const [editingTransaction, setEditingTransaction] =
    useState<Transaction | null>(null);
  const [showEditClient, setShowEditClient] = useState(false);
  const [editClientData, setEditClientData] = useState({
    client_name: "",
    phone: "",
  });
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinAction, setPinAction] = useState<{
    type: "edit" | "delete";
    data: any;
  } | null>(null);
  const [pinInput, setPinInput] = useState("");
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

  const [newRow, setNewRow] = useState({
    date: new Date().toLocaleDateString("en-CA"),
    description: "",
    credit: "",
    debit: "",
  });
  const [isSavingInline, setIsSavingInline] = useState(false);
  const [isSubmittingTxn, setIsSubmittingTxn] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user && clientId) {
      loadClientData();
    }
  }, [user, clientId]);

  useEffect(() => {
    if (!loading && client) {
      setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
      }, 100);
    }
  }, [loading, activeTab, client]);

  // End drag-select on mouse release anywhere; Escape clears the selection
  useEffect(() => {
    const onUp = () => {
      dragging.current = false;
      dragAnchor.current = null;
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedIds(new Set());
    };
    window.addEventListener("mouseup", onUp);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  // Switching currency tabs clears the cross-tab selection
  useEffect(() => {
    setSelectedIds(new Set());
  }, [activeTab]);

  const calculateSummary = useCallback(
    (transactions: Transaction[], setSummary: Function) => {
      const receivable = transactions.reduce(
        (sum, t) => sum + (t.debit || 0),
        0,
      );
      const paid = transactions.reduce((sum, t) => sum + (t.credit || 0), 0);
      const balance = paid - receivable;
      setSummary({ receivable, paid, balance });
    },
    [],
  );

  const currentTransactions = useMemo(
    () => (activeTab === "kes" ? transactionsKES : transactionsUSD),
    [activeTab, transactionsKES, transactionsUSD],
  );

  const currentSummary = useMemo(
    () => (activeTab === "kes" ? summaryKES : summaryUSD),
    [activeTab, summaryKES, summaryUSD],
  );

  const currencySymbol = useMemo(
    () => (activeTab === "kes" ? "KES" : "USD"),
    [activeTab],
  );

  const loadClientData = async () => {
    if (!user || !clientId) return;
    try {
      setLoading(true);
      const [clientResult, kesResult, usdResult] = await Promise.all([
        supabase
          .from("clients")
          .select(
            "id, client_name, client_code, email, phone, business_name, address, status, notes, created_at, last_transaction_date",
          )
          .eq("id", clientId)
          .eq("user_id", user.id)
          .single(),
        supabase
          .from("client_transactions_kes")
          .select(
            "id, transaction_date, description, credit, debit, reference_number, payment_method, notes, highlight_color, created_at",
          )
          .eq("client_id", clientId)
          .eq("user_id", user.id)
          .order("transaction_date", { ascending: true })
          .order("created_at", { ascending: true }),
        supabase
          .from("client_transactions_usd")
          .select(
            "id, transaction_date, description, credit, debit, reference_number, payment_method, notes, highlight_color, created_at",
          )
          .eq("client_id", clientId)
          .eq("user_id", user.id)
          .order("transaction_date", { ascending: true })
          .order("created_at", { ascending: true }),
      ]);

      if (clientResult.error) throw clientResult.error;
      if (kesResult.error) throw kesResult.error;
      if (usdResult.error) throw usdResult.error;

      if (!clientResult.data) {
        toast.error("Client not found");
        onBack();
        return;
      }

      setClient(clientResult.data);
      setTransactionsKES(kesResult.data || []);
      setTransactionsUSD(usdResult.data || []);
      calculateSummary(kesResult.data || [], setSummaryKES);
      calculateSummary(usdResult.data || [], setSummaryUSD);
    } catch (error: any) {
      console.error("Error loading client data:", error);
      toast.error(`Failed to load client: ${error.message}`);
      onBack();
    } finally {
      setLoading(false);
    }
  };

  const handlePinProtectedAction = (action: "edit" | "delete", data: any) => {
    setPinAction({ type: action, data });
    setShowPinModal(true);
    setPinInput("");
  };

  const verifyPinAndExecute = async () => {
    const correctPin = "2580";
    if (pinInput !== correctPin) {
      toast.error("Incorrect PIN");
      setPinInput("");
      return;
    }
    setShowPinModal(false);
    setPinInput("");
    if (!pinAction) return;
    if (pinAction.type === "delete") {
      await executeDelete(pinAction.data.transactionId, pinAction.data.currency);
    } else if (pinAction.type === "edit") {
      setEditingTransaction(pinAction.data.transaction);
      setShowEditTransaction(true);
    }
    setPinAction(null);
  };

  const handleUpdateClientInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client) return;
    try {
      const { error } = await supabase
        .from("clients")
        .update({
          client_name: editClientData.client_name,
          phone: editClientData.phone,
        })
        .eq("id", clientId);
      if (error) throw error;
      setClient({
        ...client,
        client_name: editClientData.client_name,
        phone: editClientData.phone,
      });
      setShowEditClient(false);
      toast.success("Client information updated");
    } catch (error: any) {
      toast.error("Error updating client: " + error.message);
    }
  };

  const executeDelete = async (
    transactionId: string,
    currency: "kes" | "usd",
  ) => {
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
        toast.error("Failed to delete transaction");
        return;
      }

      if (currency === "kes") {
        const updated = transactionsKES.filter((t) => t.id !== transactionId);
        setTransactionsKES(updated);
        calculateSummary(updated, setSummaryKES);
      } else {
        const updated = transactionsUSD.filter((t) => t.id !== transactionId);
        setTransactionsUSD(updated);
        calculateSummary(updated, setSummaryUSD);
      }
      toast.success("Transaction deleted");
    } catch (error) {
      console.error("Unexpected error:", error);
      toast.error("An unexpected error occurred");
    }
  };

  const handleEditTransaction = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingTransaction) return;
    const formData = new FormData(e.currentTarget);
    const transactionType = formData.get("transaction_type") as string;
    const amount = Number(formData.get("amount"));
    try {
      const transactionData = {
        debit: ["invoice", "charge", "expense"].includes(transactionType)
          ? amount
          : 0,
        credit: ["payment", "refund", "credit"].includes(transactionType)
          ? amount
          : 0,
        description: formData.get("description"),
        transaction_date: formData.get("transaction_date"),
      };
      const table =
        activeTab === "kes"
          ? "client_transactions_kes"
          : "client_transactions_usd";
      const { error: updateError } = await supabase
        .from(table)
        .update(transactionData)
        .eq("id", editingTransaction.id);
      if (updateError) {
        console.error("Error updating transaction:", updateError);
        toast.error("Failed to update transaction");
        return;
      }
      await loadClientData();
      setShowEditTransaction(false);
      setEditingTransaction(null);
      toast.success("Transaction updated");
    } catch (error) {
      console.error("Unexpected error:", error);
      toast.error("An unexpected error occurred");
    }
  };

  const handleAddTransaction = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSubmittingTxn) return;
    const formData = new FormData(e.currentTarget);
    const currency = formData.get("currency") as string;
    const transactionType = formData.get("transaction_type") as string;
    const amount = Number(formData.get("amount"));
    setIsSubmittingTxn(true);
    try {
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
        toast.error("Failed to add transaction");
        return;
      }
      if (data) {
        if (currency === "kes") {
          const updated = [...transactionsKES, data];
          setTransactionsKES(updated);
          calculateSummary(updated, setSummaryKES);
        } else {
          const updated = [...transactionsUSD, data];
          setTransactionsUSD(updated);
          calculateSummary(updated, setSummaryUSD);
        }
      }
      setShowAddTransaction(false);
      toast.success("Transaction added");
    } catch (error) {
      console.error("Unexpected error:", error);
      toast.error("An unexpected error occurred");
    } finally {
      setIsSubmittingTxn(false);
    }
  };

  const handleInlineAdd = async () => {
    if (isSavingInline) return;
    if (!newRow.description.trim()) return;
    const creditAmount = parseFloat(newRow.credit) || 0;
    const debitAmount = parseFloat(newRow.debit) || 0;
    if (creditAmount === 0 && debitAmount === 0) return;

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
        toast.error("Failed to add transaction");
        setIsSavingInline(false);
        return;
      }
      if (data) {
        if (activeTab === "kes") {
          const updated = [...transactionsKES, data];
          setTransactionsKES(updated);
          calculateSummary(updated, setSummaryKES);
        } else {
          const updated = [...transactionsUSD, data];
          setTransactionsUSD(updated);
          calculateSummary(updated, setSummaryUSD);
        }
      }
      setNewRow({
        date: new Date().toLocaleDateString("en-CA"),
        description: "",
        credit: "",
        debit: "",
      });
      setIsSavingInline(false);
      toast.success("Transaction added");
      setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
      }, 100);
    } catch (error) {
      console.error("Unexpected error:", error);
      toast.error("An unexpected error occurred");
      setIsSavingInline(false);
    }
  };

  const handleInlineKeyDown = (e: React.KeyboardEvent, field: string) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleInlineAdd();
    } else if (e.key === "Tab" && field === "debit" && !e.shiftKey) {
      e.preventDefault();
      handleInlineAdd();
    }
  };

  // ── Excel-style row selection ────────────────────────────────────────────
  const rowMouseDown = (
    e: React.MouseEvent<HTMLDivElement>,
    index: number,
  ) => {
    // Don't start a drag when the click lands on an action button
    if ((e.target as HTMLElement).closest("button")) return;
    e.preventDefault(); // suppress native text selection while dragging
    dragging.current = true;
    dragAnchor.current = index;
    const id = currentTransactions[index].id;
    if (e.ctrlKey || e.metaKey) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
      });
    } else {
      setSelectedIds(new Set([id]));
    }
  };

  const rowMouseEnter = (index: number) => {
    if (!dragging.current || dragAnchor.current === null) return;
    const a = Math.min(dragAnchor.current, index);
    const b = Math.max(dragAnchor.current, index);
    setSelectedIds(
      new Set(currentTransactions.slice(a, b + 1).map((x) => x.id)),
    );
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const applyHighlightToSelected = async (color: string | null) => {
    if (selectedIds.size === 0) return;
    const ids = [...selectedIds];
    const table =
      activeTab === "kes"
        ? "client_transactions_kes"
        : "client_transactions_usd";

    // Optimistic update
    const apply = (list: Transaction[]) =>
      list.map((x) =>
        ids.includes(x.id) ? { ...x, highlight_color: color } : x,
      );
    if (activeTab === "kes") setTransactionsKES((prev) => apply(prev));
    else setTransactionsUSD((prev) => apply(prev));

    const { error } = await supabase
      .from(table)
      .update({ highlight_color: color })
      .in("id", ids);

    if (error) {
      console.error("Error saving highlight:", error);
      toast.error("Couldn't save highlight");
      loadClientData();
    }
  };

  const generatePDFReport = (
    reportType: "full" | "kes-only" | "usd-only" = "full",
  ) => {
    if (!client) return;
    setShowStatementModal(false);
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
        reportType,
        business: getBusinessProfile(user?.email),
      });
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error(
        `Failed to generate PDF report: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-9 w-24 skeleton rounded-md" />
        <div className="h-32 skeleton rounded-2xl" />
        <div className="h-12 skeleton rounded-xl" />
        <div className="h-96 skeleton rounded-2xl" />
      </div>
    );
  }

  if (!client) {
    return (
      <Card>
        <EmptyState
          title="Client not found"
          description="The client you're looking for doesn't exist or has been removed."
          action={
            <Button variant="primary" onClick={onBack}>
              Back to clients
            </Button>
          }
        />
      </Card>
    );
  }

  const tabs = [
    {
      id: "kes" as const,
      label: "KES",
      count: transactionsKES.length,
    },
    {
      id: "usd" as const,
      label: "USD",
      count: transactionsUSD.length,
    },
  ];

  return (
    <div>
      {/* Sticky client subheader — identity + currency tabs + primary actions */}
      <div className="sticky top-12 md:top-14 z-30 -mx-3 sm:-mx-5 md:-mx-6 lg:-mx-8 -mt-4 sm:-mt-5 md:-mt-6 mb-4 px-3 sm:px-5 md:px-6 lg:px-8 bg-white/85 backdrop-blur-md border-b border-ink-200/70">
        <div className="py-2.5 flex items-center gap-2 sm:gap-3">
          {/* Back */}
          <button
            onClick={onBack}
            className="shrink-0 h-8 w-8 rounded-md inline-flex items-center justify-center text-ink-500 hover:bg-ink-100 hover:text-ink-900 transition-colors focus-ring"
            title="Back to clients"
            aria-label="Back to clients"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          {/* Identity */}
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <Avatar
              name={client.client_name}
              size="sm"
              status={client.status as "active" | "inactive"}
            />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 min-w-0">
                <h1 className="text-sm sm:text-base font-semibold text-ink-900 tracking-tight truncate">
                  {client.client_name}
                </h1>
                <Badge
                  tone={client.status === "active" ? "positive" : "muted"}
                  dot
                  size="sm"
                  className="hidden sm:inline-flex shrink-0"
                >
                  {client.status}
                </Badge>
                <button
                  onClick={() => {
                    setEditClientData({
                      client_name: client.client_name,
                      phone: client.phone || "",
                    });
                    setShowEditClient(true);
                  }}
                  className="shrink-0 p-1 rounded-md text-ink-400 hover:bg-ink-100 hover:text-ink-700 transition-colors focus-ring"
                  title="Edit client info"
                  aria-label="Edit client info"
                >
                  <Edit2 className="w-3 h-3" />
                </button>
              </div>
              <div className="hidden sm:flex items-center gap-2 text-[11px] text-ink-500 mt-0.5">
                <span className="font-mono">{client.client_code}</span>
                {client.phone && (
                  <>
                    <span className="text-ink-300">·</span>
                    <span className="inline-flex items-center gap-1">
                      <Phone className="w-3 h-3" />
                      {client.phone}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Currency switcher */}
          <div
            role="tablist"
            aria-label="Currency"
            className="inline-flex items-center bg-ink-100 rounded-lg p-0.5 shrink-0"
          >
            {tabs.map((t) => {
              const active = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  role="tab"
                  aria-selected={active}
                  onClick={() => setActiveTab(t.id)}
                  className={[
                    "h-8 px-3 inline-flex items-center gap-1.5 rounded-md text-xs font-semibold",
                    "transition-all duration-150 focus-ring",
                    active
                      ? "bg-brand-600 text-white shadow-sm"
                      : "text-ink-500 hover:text-ink-800",
                  ].join(" ")}
                >
                  {t.label}
                  <span
                    className={[
                      "tabular-nums text-[10px] px-1.5 py-0.5 rounded-full",
                      active
                        ? "bg-white/25 text-white"
                        : "bg-ink-200 text-ink-500",
                    ].join(" ")}
                  >
                    {t.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Primary actions */}
          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              variant="primary"
              size="sm"
              leadingIcon={<Plus className="w-4 h-4" />}
              onClick={() => setShowAddTransaction(true)}
              className="hidden sm:inline-flex"
            >
              Add transaction
            </Button>
            <button
              onClick={() => setShowAddTransaction(true)}
              className="sm:hidden h-8 w-8 rounded-md bg-brand-600 text-white hover:bg-brand-700 inline-flex items-center justify-center transition-colors press focus-ring"
              title="Add transaction"
              aria-label="Add transaction"
            >
              <Plus className="w-4 h-4" />
            </button>

            <button
              onClick={() => setShowStatementModal(true)}
              className="h-8 w-8 sm:w-auto sm:px-3 rounded-md border border-ink-200 bg-white text-ink-700 hover:bg-ink-50 hover:text-ink-900 inline-flex items-center justify-center gap-1.5 transition-colors press focus-ring"
              title="Download statement"
              aria-label="Download statement"
            >
              <Download className="w-4 h-4" />
              <span className="hidden md:inline text-sm font-medium">
                Statement
              </span>
            </button>
          </div>
        </div>

        {/* Mobile-only secondary row: status + code/phone */}
        <div className="sm:hidden pb-2 -mt-1 flex items-center gap-2 text-[11px] text-ink-500">
          <Badge
            tone={client.status === "active" ? "positive" : "muted"}
            dot
            size="sm"
          >
            {client.status}
          </Badge>
          <span className="font-mono">{client.client_code}</span>
          {client.phone && (
            <>
              <span className="text-ink-300">·</span>
              <span className="inline-flex items-center gap-1 truncate">
                <Phone className="w-3 h-3" />
                {client.phone}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Transaction ledger */}
      <Card className="overflow-hidden">
        <div className="px-4 sm:px-5 py-3 border-b border-ink-100 bg-ink-50/50 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-ink-900 tracking-tight">
              Transaction history
            </h2>
            <p className="text-xs text-ink-500 mt-0.5">
              {currentTransactions.length}{" "}
              {currentTransactions.length === 1 ? "entry" : "entries"} ·{" "}
              {currencySymbol}
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-3 text-[11px] text-ink-500">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-positive-500" /> In
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-negative-500" /> Out
            </span>
          </div>
        </div>

        {currentTransactions.length === 0 ? (
          <EmptyState
            title="No transactions yet"
            description="Use the quick-add row below or open the full form to record the first one."
          />
        ) : (
          <>
            {/* Desktop ledger */}
            <div className="hidden md:block">
              <div className="grid grid-cols-12 px-4 py-2.5 bg-ink-50 border-b border-ink-100 text-[11px] uppercase tracking-wide text-ink-500 font-semibold">
                <div className="col-span-2">Date</div>
                <div className="col-span-4">Description</div>
                <div className="col-span-2 text-right">In</div>
                <div className="col-span-2 text-right">Out</div>
                <div className="col-span-1 text-right">Balance</div>
                <div className="col-span-1 text-right" />
              </div>
              <div className="divide-y divide-black/[0.07]">
                {currentTransactions.map((t, index) => {
                  const runningBalance = currentTransactions
                    .slice(0, index + 1)
                    .reduce(
                      (sum, x) =>
                        sum + Number(x.credit || 0) - Number(x.debit || 0),
                      0,
                    );
                  const isSelected = selectedIds.has(t.id);
                  return (
                    <div
                      key={t.id}
                      onMouseDown={(e) => rowMouseDown(e, index)}
                      onMouseEnter={() => rowMouseEnter(index)}
                      style={
                        t.highlight_color
                          ? { backgroundColor: t.highlight_color }
                          : undefined
                      }
                      className={[
                        "grid grid-cols-12 items-center px-4 py-2.5 group transition-colors select-none cursor-default relative",
                        t.highlight_color
                          ? ""
                          : isSelected
                            ? "bg-brand-50/60"
                            : "hover:bg-brand-50/20",
                        isSelected
                          ? "outline outline-2 -outline-offset-2 outline-brand-500 z-10"
                          : "",
                        t.credit > 0
                          ? "shadow-[inset_3px_0_0_#10b981]"
                          : t.debit > 0
                            ? "shadow-[inset_3px_0_0_#ef4444]"
                            : "",
                      ].join(" ")}
                    >
                      <div className="col-span-2 text-xs text-ink-600 tabular-nums">
                        {new Date(t.transaction_date).toLocaleDateString(
                          "en-GB",
                          {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          },
                        )}
                      </div>
                      <div className="col-span-4 text-sm text-ink-900 truncate pr-2">
                        {t.description}
                      </div>
                      <div className="col-span-2 text-sm text-right tabular-nums">
                        {t.credit > 0 ? (
                          <span className="text-positive-700 font-medium">
                            +{formatCurrency(t.credit, currencySymbol)}
                          </span>
                        ) : (
                          <span className="text-ink-300">—</span>
                        )}
                      </div>
                      <div className="col-span-2 text-sm text-right tabular-nums">
                        {t.debit > 0 ? (
                          <span className="text-negative-700 font-medium">
                            −{formatCurrency(t.debit, currencySymbol)}
                          </span>
                        ) : (
                          <span className="text-ink-300">—</span>
                        )}
                      </div>
                      <div className="col-span-1 text-sm text-right tabular-nums font-medium">
                        <span
                          className={[
                            "inline-block px-1.5 py-0.5 rounded-md text-xs",
                            runningBalance >= 0
                              ? "text-positive-700 bg-positive-50"
                              : "text-negative-700 bg-negative-50",
                          ].join(" ")}
                        >
                          {runningBalance >= 0 ? "" : "−"}
                          {formatCurrency(
                            Math.abs(runningBalance),
                            currencySymbol,
                          )}
                        </span>
                      </div>
                      <div
                        className={[
                          "col-span-1 flex items-center justify-end gap-0.5 transition-opacity",
                          t.highlight_color || isSelected
                            ? "opacity-100"
                            : "opacity-0 group-hover:opacity-100",
                        ].join(" ")}
                      >
                        <button
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSelect(t.id);
                          }}
                          className={[
                            "p-1 rounded-md focus-ring transition-colors",
                            isSelected
                              ? "text-brand-700 bg-brand-100"
                              : t.highlight_color
                                ? "text-ink-700 hover:bg-black/5"
                                : "text-ink-400 hover:bg-ink-100 hover:text-ink-700",
                          ].join(" ")}
                          title={isSelected ? "Deselect row" : "Select row"}
                          aria-label={isSelected ? "Deselect row" : "Select row"}
                        >
                          <Highlighter className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() =>
                            handlePinProtectedAction("edit", {
                              transaction: t,
                              currency: activeTab,
                            })
                          }
                          className="p-1 rounded-md text-ink-400 hover:bg-ink-100 hover:text-ink-700 focus-ring"
                          title="Edit"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() =>
                            handlePinProtectedAction("delete", {
                              transactionId: t.id,
                              currency: activeTab,
                            })
                          }
                          className="p-1 rounded-md text-ink-400 hover:bg-negative-50 hover:text-negative-600 focus-ring"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}

                {/* Inline add — eye-catching */}
                <div className="border-t-4 border-brand-500 bg-gradient-to-r from-brand-50 via-brand-100/70 to-brand-50 ">
                  <div className="px-4 pt-2.5 pb-1.5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-brand-600 text-white rounded-md text-[10px] font-bold uppercase tracking-wider shadow-sm">
                        <Plus className="w-3 h-3" /> Quick add
                      </span>
                      <span className="text-[11px] text-brand-700 font-medium">
                        Add a new {currencySymbol} transaction
                      </span>
                    </div>
                    <span className="text-[10px] text-brand-700/80 font-medium">
                      {isSavingInline ? "Saving…" : "Press Enter ↵ to save"}
                    </span>
                  </div>
                  <div className="grid grid-cols-12 items-center px-4 pb-3 gap-x-2">
                    <div className="col-span-2">
                      <input
                        type="date"
                        value={newRow.date}
                        onChange={(e) =>
                          setNewRow({ ...newRow, date: e.target.value })
                        }
                        className="w-full h-9 px-2 text-xs bg-white text-ink-900 border-2 border-brand-200 rounded-md focus:outline-none focus:border-brand-500 focus:shadow-focus [color-scheme:light] tabular-nums"
                        disabled={isSavingInline}
                      />
                    </div>
                    <div className="col-span-4">
                      <input
                        type="text"
                        placeholder="Describe the transaction…"
                        value={newRow.description}
                        onChange={(e) =>
                          setNewRow({ ...newRow, description: e.target.value })
                        }
                        onKeyDown={(e) =>
                          handleInlineKeyDown(e, "description")
                        }
                        className="w-full h-9 px-2.5 text-sm bg-white text-ink-900 border-2 border-brand-200 rounded-md focus:outline-none focus:border-brand-500 focus:shadow-focus placeholder:text-ink-400"
                        disabled={isSavingInline}
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number"
                        placeholder="In +"
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
                        className="w-full h-9 px-2 text-xs text-right bg-white text-positive-700 border-2 border-positive-100 rounded-md focus:outline-none focus:border-positive-500 focus:shadow-focus placeholder:text-positive-500/60 tabular-nums font-semibold"
                        disabled={isSavingInline}
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number"
                        placeholder="Out −"
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
                        className="w-full h-9 px-2 text-xs text-right bg-white text-negative-700 border-2 border-negative-100 rounded-md focus:outline-none focus:border-negative-500 focus:shadow-focus-danger placeholder:text-negative-500/60 tabular-nums font-semibold"
                        disabled={isSavingInline}
                      />
                    </div>
                    <div className="col-span-2 flex justify-end">
                      <button
                        type="button"
                        onClick={handleInlineAdd}
                        disabled={isSavingInline || !newRow.description.trim()}
                        className="h-9 px-3 rounded-md inline-flex items-center justify-center gap-1.5 bg-brand-600 text-white text-xs font-semibold hover:bg-brand-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed focus-ring shadow-md hover:shadow-lg hover:-translate-y-0.5"
                        title="Save transaction"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        {isSavingInline ? "Saving…" : "Add entry"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-black/[0.07]">
              {currentTransactions.map((t, index) => {
                const runningBalance = currentTransactions
                  .slice(0, index + 1)
                  .reduce(
                    (sum, x) =>
                      sum + Number(x.credit || 0) - Number(x.debit || 0),
                    0,
                  );
                const isSelected = selectedIds.has(t.id);
                return (
                  <div
                    key={t.id}
                    style={
                      t.highlight_color
                        ? { backgroundColor: t.highlight_color }
                        : undefined
                    }
                    className={[
                      "px-4 py-3 relative",
                      !t.highlight_color && isSelected ? "bg-brand-50/60" : "",
                      isSelected
                        ? "outline outline-2 -outline-offset-2 outline-brand-500 z-10"
                        : "",
                      t.credit > 0
                        ? "shadow-[inset_3px_0_0_#10b981]"
                        : t.debit > 0
                          ? "shadow-[inset_3px_0_0_#ef4444]"
                          : "",
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] text-ink-500 tabular-nums">
                          {new Date(t.transaction_date).toLocaleDateString(
                            "en-GB",
                            {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            },
                          )}
                        </div>
                        <div className="text-sm text-ink-900 font-medium mt-0.5">
                          {t.description}
                        </div>
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          onClick={() => toggleSelect(t.id)}
                          className={[
                            "p-1.5 rounded-md transition-colors",
                            isSelected
                              ? "text-brand-700 bg-brand-100"
                              : t.highlight_color
                                ? "text-ink-700 hover:bg-black/5"
                                : "text-ink-400 hover:bg-ink-100 hover:text-ink-700",
                          ].join(" ")}
                          title={isSelected ? "Deselect row" : "Select row"}
                          aria-label={isSelected ? "Deselect row" : "Select row"}
                        >
                          <Highlighter className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() =>
                            handlePinProtectedAction("edit", {
                              transaction: t,
                              currency: activeTab,
                            })
                          }
                          className="p-1.5 rounded-md text-ink-400 hover:bg-ink-100 hover:text-ink-700"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() =>
                            handlePinProtectedAction("delete", {
                              transactionId: t.id,
                              currency: activeTab,
                            })
                          }
                          className="p-1.5 rounded-md text-ink-400 hover:bg-negative-50 hover:text-negative-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-sm tabular-nums">
                      <div className="flex items-center gap-3">
                        {t.credit > 0 && (
                          <span className="text-positive-700 font-medium">
                            +{formatCurrency(t.credit, currencySymbol)}
                          </span>
                        )}
                        {t.debit > 0 && (
                          <span className="text-negative-700 font-medium">
                            −{formatCurrency(t.debit, currencySymbol)}
                          </span>
                        )}
                      </div>
                      <span
                        className={[
                          "text-xs font-medium px-1.5 py-0.5 rounded-md",
                          runningBalance >= 0
                            ? "text-positive-800 bg-positive-50"
                            : "text-negative-700 bg-negative-50",
                        ].join(" ")}
                      >
                        {runningBalance >= 0 ? "" : "−"}
                        {formatCurrency(
                          Math.abs(runningBalance),
                          currencySymbol,
                        )}
                      </span>
                    </div>
                  </div>
                );
              })}

              {/* Mobile inline add — eye-catching */}
              <div className="p-3 bg-gradient-to-br from-brand-50 via-brand-100/70 to-brand-50 border-t-4 border-brand-500 shadow-[inset_6px_0_0_#0d9488,0_-4px_12px_-4px_rgba(13,148,136,0.18)] space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-brand-600 text-white rounded-md text-[10px] font-bold uppercase tracking-wider shadow-sm">
                    <Plus className="w-3 h-3" /> Quick add
                  </span>
                  <span className="text-[10px] text-brand-700/80 font-medium">
                    New {currencySymbol} entry
                  </span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={newRow.date}
                    onChange={(e) =>
                      setNewRow({ ...newRow, date: e.target.value })
                    }
                    className="w-32 h-9 px-2 text-xs bg-white border-2 border-brand-200 rounded-md focus:outline-none focus:border-brand-500 [color-scheme:light] tabular-nums"
                    disabled={isSavingInline}
                  />
                  <input
                    type="text"
                    placeholder="Describe…"
                    value={newRow.description}
                    onChange={(e) =>
                      setNewRow({ ...newRow, description: e.target.value })
                    }
                    className="flex-1 h-9 px-2.5 text-xs bg-white border-2 border-brand-200 rounded-md focus:outline-none focus:border-brand-500 placeholder:text-ink-400"
                    disabled={isSavingInline}
                  />
                </div>
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <label className="block text-[10px] uppercase font-bold text-positive-700 mb-1">
                      In +
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
                      className="w-full h-9 px-2 text-xs text-right bg-white border-2 border-positive-100 rounded-md focus:outline-none focus:border-positive-500 text-positive-700 tabular-nums font-semibold"
                      disabled={isSavingInline}
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-[10px] uppercase font-bold text-negative-700 mb-1">
                      Out −
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
                      className="w-full h-9 px-2 text-xs text-right bg-white border-2 border-negative-100 rounded-md focus:outline-none focus:border-negative-500 text-negative-700 tabular-nums font-semibold"
                      disabled={isSavingInline}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleInlineAdd}
                    disabled={isSavingInline || !newRow.description.trim()}
                    className="h-9 px-3 rounded-md inline-flex items-center justify-center gap-1.5 bg-brand-600 text-white text-xs font-semibold hover:bg-brand-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed focus-ring shadow-md"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {isSavingInline ? "Saving…" : "Save"}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </Card>

      {/* Summary KPIs — ledger totals */}
      <div className="mt-3 sm:mt-4 grid grid-cols-3 gap-2 sm:gap-3">
        <StatTile
          label="Received"
          value={formatCurrency(currentSummary.paid, currencySymbol)}
          icon={<TrendingUp className="w-4 h-4" />}
          tone="positive"
        />
        <StatTile
          label="Receivable"
          value={formatCurrency(currentSummary.receivable, currencySymbol)}
          icon={<TrendingDown className="w-4 h-4" />}
          tone="negative"
        />
        <StatTile
          label={currentSummary.balance >= 0 ? "Credit balance" : "Outstanding"}
          value={formatCurrency(
            Math.abs(currentSummary.balance),
            currencySymbol,
          )}
          icon={<Wallet className="w-4 h-4" />}
          tone={currentSummary.balance >= 0 ? "info" : "negative"}
        />
      </div>

      <div ref={bottomRef} className="scroll-mb-20 md:scroll-mb-4" />

      {/* Floating highlight toolbar — appears when rows are selected */}
      {selectedIds.size > 0 && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-4 z-50 animate-slide-up w-[calc(100%-1.5rem)] max-w-md">
          <div className="rounded-2xl border border-ink-200 bg-white shadow-xl p-2.5 flex items-center gap-2.5">
            <span className="shrink-0 inline-flex items-center gap-1.5 pl-1.5 pr-2.5 py-1 rounded-lg bg-brand-50 text-brand-700 text-xs font-semibold">
              <Highlighter className="w-3.5 h-3.5" />
              {selectedIds.size}
            </span>

            <div className="flex items-center gap-1 flex-1 min-w-0 overflow-x-auto no-scrollbar">
              {HIGHLIGHT_COLORS.map((c) => (
                <button
                  key={c.hex}
                  onClick={() => applyHighlightToSelected(c.hex)}
                  title={c.name}
                  aria-label={`Fill ${c.name}`}
                  className="shrink-0 h-7 w-7 rounded-md border border-ink-200 transition-transform hover:scale-110 focus-ring"
                  style={{ backgroundColor: c.hex }}
                />
              ))}
              <button
                onClick={() => applyHighlightToSelected(null)}
                title="No fill"
                aria-label="No fill"
                className="shrink-0 h-7 w-7 rounded-md border border-ink-200 inline-flex items-center justify-center text-ink-500 hover:bg-ink-50 focus-ring"
              >
                <Ban className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              onClick={() => setSelectedIds(new Set())}
              className="shrink-0 h-7 px-2.5 rounded-lg text-xs font-medium text-ink-600 hover:bg-ink-100 focus-ring"
            >
              Done
            </button>
          </div>
          <p className="mt-1.5 text-center text-[10px] text-ink-400">
            Drag across rows or tap the highlighter to select · Esc to cancel
          </p>
        </div>
      )}

      {/* Statement scope picker */}
      <Modal
        isOpen={showStatementModal}
        onClose={() => setShowStatementModal(false)}
        title="Download statement"
        description="Choose which currency to include in the PDF."
        size="sm"
        footer={
          <Button
            variant="ghost"
            onClick={() => setShowStatementModal(false)}
          >
            Cancel
          </Button>
        }
      >
        <div className="space-y-2">
          {(
            [
              {
                type: "full" as const,
                label: "Both currencies",
                sub: `${transactionsKES.length} KES · ${transactionsUSD.length} USD entries`,
                badge: "KES + USD",
                disabled:
                  transactionsKES.length === 0 &&
                  transactionsUSD.length === 0,
              },
              {
                type: "kes-only" as const,
                label: "KES only",
                sub: `${transactionsKES.length} ${
                  transactionsKES.length === 1 ? "entry" : "entries"
                }`,
                badge: "KES",
                disabled: transactionsKES.length === 0,
              },
              {
                type: "usd-only" as const,
                label: "USD only",
                sub: `${transactionsUSD.length} ${
                  transactionsUSD.length === 1 ? "entry" : "entries"
                }`,
                badge: "USD",
                disabled: transactionsUSD.length === 0,
              },
            ] as const
          ).map((opt) => (
            <button
              key={opt.type}
              onClick={() => generatePDFReport(opt.type)}
              disabled={opt.disabled}
              className="w-full flex items-center justify-between gap-3 p-3 rounded-xl border-2 border-ink-200 bg-white text-left transition-all hover:border-brand-400 hover:bg-brand-50/40 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-ink-200 disabled:hover:bg-white focus-ring group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="shrink-0 w-9 h-9 rounded-lg bg-brand-50 text-brand-700 inline-flex items-center justify-center group-hover:bg-brand-600 group-hover:text-white transition-colors">
                  <Download className="w-4 h-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink-900">
                    {opt.label}
                  </p>
                  <p className="text-xs text-ink-500">{opt.sub}</p>
                </div>
              </div>
              <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-md bg-ink-100 text-ink-600">
                {opt.badge}
              </span>
            </button>
          ))}
        </div>
      </Modal>

      {/* Add Transaction Modal */}
      <Modal
        isOpen={showAddTransaction}
        onClose={() => setShowAddTransaction(false)}
        title="Add transaction"
        description="Record an inbound payment or outbound charge."
        size="md"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setShowAddTransaction(false)}
            >
              Cancel
            </Button>
            <Button variant="primary" type="submit" form="add-txn-form" loading={isSubmittingTxn}>
              Add transaction
            </Button>
          </>
        }
      >
        <form
          id="add-txn-form"
          onSubmit={handleAddTransaction}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Type"
              name="transaction_type"
              required
              defaultValue="payment"
            >
              <option value="payment">Money in — Payment</option>
              <option value="invoice">Money out — Invoice / Charge</option>
            </Select>
            <Input
              label="Amount"
              name="amount"
              type="number"
              step="0.01"
              min="0"
              required
              placeholder="0.00"
            />
          </div>
          <Select
            label="Currency"
            name="currency"
            defaultValue={activeTab}
            required
          >
            <option value="kes">KES — Kenyan Shillings</option>
            <option value="usd">USD — US Dollars</option>
          </Select>
          <Input
            label="Description"
            name="description"
            required
            placeholder="e.g. Payment for web development"
          />
          <Input
            label="Date"
            name="transaction_date"
            type="date"
            defaultValue={new Date().toLocaleDateString("en-CA")}
            required
          />
        </form>
      </Modal>

      {/* Edit Transaction Modal */}
      <Modal
        isOpen={showEditTransaction && !!editingTransaction}
        onClose={() => {
          setShowEditTransaction(false);
          setEditingTransaction(null);
        }}
        title="Edit transaction"
        size="md"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setShowEditTransaction(false);
                setEditingTransaction(null);
              }}
            >
              Cancel
            </Button>
            <Button variant="primary" type="submit" form="edit-txn-form">
              Update transaction
            </Button>
          </>
        }
      >
        {editingTransaction && (
          <form
            id="edit-txn-form"
            onSubmit={handleEditTransaction}
            autoComplete="off"
            className="space-y-4"
          >
            <Select
              label="Type"
              name="transaction_type"
              defaultValue={
                editingTransaction.credit > 0 ? "payment" : "invoice"
              }
              required
            >
              <option value="payment">Money in — Payment</option>
              <option value="invoice">Money out — Invoice / Charge</option>
            </Select>
            <Input
              label={`Amount (${currencySymbol})`}
              name="amount"
              type="number"
              step="0.01"
              min="0"
              defaultValue={
                editingTransaction.credit > 0
                  ? editingTransaction.credit
                  : editingTransaction.debit
              }
              required
            />
            <Input
              label="Description"
              name="description"
              defaultValue={editingTransaction.description}
              required
            />
            <Input
              label="Date"
              name="transaction_date"
              type="date"
              defaultValue={editingTransaction.transaction_date}
              required
            />
          </form>
        )}
      </Modal>

      {/* PIN Modal */}
      <Modal
        isOpen={showPinModal}
        onClose={() => {
          setShowPinModal(false);
          setPinAction(null);
          setPinInput("");
        }}
        title="Enter PIN"
        description={
          pinAction?.type === "edit"
            ? "Enter your PIN to edit this transaction"
            : "Enter your PIN to delete this transaction"
        }
        tone="warning"
        size="sm"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setShowPinModal(false);
                setPinAction(null);
                setPinInput("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              leadingIcon={<Lock className="w-3.5 h-3.5" />}
              onClick={verifyPinAndExecute}
            >
              Verify
            </Button>
          </>
        }
      >
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={pinInput}
          onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ""))}
          onKeyDown={(e) => {
            if (e.key === "Enter") verifyPinAndExecute();
          }}
          placeholder="••••"
          maxLength={4}
          autoFocus
          autoComplete="one-time-code"
          data-lpignore="true"
          data-form-type="other"
          className="w-full h-12 px-4 bg-white text-ink-900 text-center text-xl tracking-[0.5em] border border-ink-200 rounded-lg focus:outline-none focus:border-brand-500 focus:shadow-focus font-semibold tabular-nums [text-security:disc]"
        />
      </Modal>

      {/* Edit Client Modal */}
      <Modal
        isOpen={showEditClient}
        onClose={() => setShowEditClient(false)}
        title="Edit client"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowEditClient(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" form="edit-client-form">
              Save changes
            </Button>
          </>
        }
      >
        <form
          id="edit-client-form"
          onSubmit={handleUpdateClientInfo}
          className="space-y-4"
        >
          <Input
            label="Client name"
            value={editClientData.client_name}
            onChange={(e) =>
              setEditClientData({
                ...editClientData,
                client_name: e.target.value,
              })
            }
            required
            placeholder="Enter client name"
          />
          <Input
            label="Phone number"
            type="tel"
            value={editClientData.phone}
            onChange={(e) =>
              setEditClientData({ ...editClientData, phone: e.target.value })
            }
            required
            placeholder="Enter phone number"
          />
        </form>
      </Modal>
    </div>
  );
}

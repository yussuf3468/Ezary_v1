import { useEffect, useState, useMemo } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "react-toastify";
import {
  Search,
  Plus,
  Users,
  X,
  ArrowUpDown,
  Phone,
  Trash2,
  Ban,
  CheckCircle,
  ChevronRight,
  LayoutGrid,
  List,
  AlertTriangle,
  Calendar,
  DollarSign,
  Eye,
} from "lucide-react";
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Modal,
  PageHeader,
  Select,
} from "./ui";

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
  updated_at: string | null;
}

interface ClientBalance {
  client_id: string;
  balance: number;
  transaction_count: number;
  kes_balance: number;
  usd_balance: number;
  kes_count: number;
  usd_count: number;
}

interface ClientListProps {
  onSelectClient: (clientId: string) => void;
}

type SortField = "name" | "date" | "balance" | "transactions";
type SortOrder = "asc" | "desc";
type ViewMode = "rows" | "grid";

const compactNumber = (n: number) => {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (abs >= 10_000) return (n / 1_000).toFixed(1) + "K";
  return n.toLocaleString();
};

export default function ClientList({ onSelectClient }: ClientListProps) {
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [balances, setBalances] = useState<Map<string, ClientBalance>>(new Map());
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">(
    "all",
  );
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [showAddModal, setShowAddModal] = useState(false);
  const [addName, setAddName] = useState("");
  const [addPhone, setAddPhone] = useState("");
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [stats, setStats] = useState({ total: 0, active: 0, inactive: 0 });

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
        .select(
          "id, client_name, client_code, email, phone, business_name, status, last_transaction_date, created_at, updated_at",
        )
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });

      if (error) throw error;

      setClients(data || []);
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
      const { data: kesData, error: kesError } = await supabase
        .from("client_transactions_kes")
        .select("client_id, credit, debit")
        .eq("user_id", user.id);
      if (kesError) throw kesError;

      const { data: usdData, error: usdError } = await supabase
        .from("client_transactions_usd")
        .select("client_id, credit, debit")
        .eq("user_id", user.id);
      if (usdError) throw usdError;

      const balanceMap = new Map<string, ClientBalance>();
      kesData?.forEach((txn) => {
        const existing = balanceMap.get(txn.client_id) || {
          client_id: txn.client_id,
          balance: 0,
          transaction_count: 0,
          kes_balance: 0,
          usd_balance: 0,
          kes_count: 0,
          usd_count: 0,
        };
        const amount = (txn.credit || 0) - (txn.debit || 0);
        existing.kes_balance += amount;
        existing.balance += amount;
        existing.kes_count += 1;
        existing.transaction_count += 1;
        balanceMap.set(txn.client_id, existing);
      });
      usdData?.forEach((txn) => {
        const existing = balanceMap.get(txn.client_id) || {
          client_id: txn.client_id,
          balance: 0,
          transaction_count: 0,
          kes_balance: 0,
          usd_balance: 0,
          kes_count: 0,
          usd_count: 0,
        };
        const amount = (txn.credit || 0) - (txn.debit || 0);
        existing.usd_balance += amount;
        existing.balance += amount * 150;
        existing.usd_count += 1;
        existing.transaction_count += 1;
        balanceMap.set(txn.client_id, existing);
      });
      setBalances(balanceMap);

    } catch (error) {
      console.error("Error loading balances:", error);
    }
  };

  const filteredClients = useMemo(() => {
    let filtered = [...clients];
    if (statusFilter !== "all") {
      filtered = filtered.filter((c) => c.status === statusFilter);
    }
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.client_name.toLowerCase().includes(term) ||
          c.client_code.toLowerCase().includes(term) ||
          c.email?.toLowerCase().includes(term) ||
          c.phone?.includes(term) ||
          c.business_name?.toLowerCase().includes(term),
      );
    }
    filtered.sort((a, b) => {
      let compareValue = 0;
      switch (sortField) {
        case "name":
          compareValue = a.client_name.localeCompare(b.client_name);
          break;
        case "date": {
          const aTime = Math.max(
            a.updated_at ? new Date(a.updated_at).getTime() : 0,
            a.last_transaction_date
              ? new Date(a.last_transaction_date).getTime()
              : 0,
            new Date(a.created_at).getTime(),
          );
          const bTime = Math.max(
            b.updated_at ? new Date(b.updated_at).getTime() : 0,
            b.last_transaction_date
              ? new Date(b.last_transaction_date).getTime()
              : 0,
            new Date(b.created_at).getTime(),
          );
          compareValue = aTime - bTime;
          break;
        }
        case "balance": {
          const balanceA = balances.get(a.id)?.balance || 0;
          const balanceB = balances.get(b.id)?.balance || 0;
          compareValue = balanceA - balanceB;
          break;
        }
        case "transactions": {
          const txnA = balances.get(a.id)?.transaction_count || 0;
          const txnB = balances.get(b.id)?.transaction_count || 0;
          compareValue = txnA - txnB;
          break;
        }
      }
      return sortOrder === "asc" ? compareValue : -compareValue;
    });
    return filtered;
  }, [clients, searchTerm, statusFilter, sortField, sortOrder, balances]);

  const duplicateMatches = useMemo(() => {
    const name = addName.trim().toLowerCase();
    const phone = addPhone.trim();
    if (name.length < 2 && !phone) return [];
    return clients.filter((c) => {
      const nameMatch =
        name.length >= 2 &&
        (c.client_name.toLowerCase().includes(name) ||
          name.includes(c.client_name.toLowerCase()));
      const phoneMatch = phone.length >= 6 && c.phone === phone;
      return nameMatch || phoneMatch;
    });
  }, [clients, addName, addPhone]);

  const handleAddClient = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;
    const form = e.currentTarget;
    const formData = new FormData(form);
    try {
      setSubmitting(true);
      const clientName = (formData.get("client_name") as string).trim();
      const phone = (formData.get("phone") as string)?.trim() || null;

      const { data: duplicates, error: dupError } = await supabase
        .from("clients")
        .select("client_name, phone")
        .eq("user_id", user?.id)
        .or(
          `client_name.ilike.${clientName}${phone ? `,phone.eq.${phone}` : ""}`,
        );

      if (dupError) {
        console.error("Error checking duplicates:", dupError);
      } else if (duplicates && duplicates.length > 0) {
        const match = duplicates[0];
        const reason =
          match.client_name.toLowerCase() === clientName.toLowerCase()
            ? `name "${match.client_name}"`
            : `phone number ${match.phone}`;
        toast.error(`Client already exists with the same ${reason}.`);
        return;
      }

      const { data: existingClients, error: queryError } = await supabase
        .from("clients")
        .select("client_code")
        .eq("user_id", user?.id)
        .order("created_at", { ascending: false })
        .limit(1);

      if (queryError) {
        console.error("Error querying clients:", queryError);
        toast.error("Failed to generate client code. Please try again.");
        return;
      }

      let clientCode = "CLT-0001";
      if (existingClients && existingClients.length > 0) {
        const lastCode = existingClients[0].client_code;
        const match = lastCode.match(/CLT-(\d+)/);
        if (match) {
          const nextNum = parseInt(match[1]) + 1;
          clientCode = `CLT-${nextNum.toString().padStart(4, "0")}`;
        }
      }

      const { data: newClient, error: insertError } = await supabase
        .from("clients")
        .insert({
          user_id: user?.id,
          client_name: clientName,
          email: formData.get("email") || null,
          phone: phone,
          business_name: formData.get("business_name") || null,
          address: formData.get("address") || null,
          client_code: clientCode,
          status: "active",
        })
        .select()
        .single();

      if (insertError) {
        console.error("Error adding client:", insertError);
        toast.error("Failed to add client. Please try again.");
        return;
      }

      const initialBalanceStr = formData.get("initial_balance") as string;
      const initialBalance = initialBalanceStr ? parseFloat(initialBalanceStr) : 0;
      const initialCurrency = formData.get("initial_currency") as string;

      if (!isNaN(initialBalance) && initialBalance > 0 && newClient) {
        const transactionTable =
          initialCurrency === "USD"
            ? "client_transactions_usd"
            : "client_transactions_kes";

        const { error: transactionError } = await supabase
          .from(transactionTable)
          .insert({
            client_id: newClient.id,
            user_id: user?.id,
            transaction_date: new Date().toISOString().split("T")[0],
            description: "Opening Balance",
            credit: initialBalance,
            debit: 0,
          });

        if (transactionError) {
          console.error("Error creating opening balance:", transactionError);
          toast.warning(
            "Client added but opening balance failed. Add it manually.",
          );
        }
      }

      form.reset();
      setAddName("");
      setAddPhone("");
      setShowAddModal(false);
      try {
        await Promise.all([loadClients(), loadBalances()]);
        toast.success(`Client ${clientCode} added`);
      } catch (reloadError) {
        console.error("Error reloading after client creation:", reloadError);
        toast.success(`Client ${clientCode} added. Refresh to see updates.`);
      }
    } catch (error) {
      console.error("Unexpected error:", error);
      toast.error("An unexpected error occurred. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteClient = async () => {
    if (!clientToDelete) return;
    try {
      const { error: kesError } = await supabase
        .from("client_transactions_kes")
        .delete()
        .eq("client_id", clientToDelete.id)
        .eq("user_id", user?.id);
      if (kesError) throw kesError;

      const { error: usdError } = await supabase
        .from("client_transactions_usd")
        .delete()
        .eq("client_id", clientToDelete.id)
        .eq("user_id", user?.id);
      if (usdError) throw usdError;

      const { error: clientError } = await supabase
        .from("clients")
        .delete()
        .eq("id", clientToDelete.id)
        .eq("user_id", user?.id);
      if (clientError) throw clientError;

      toast.success(`Client ${clientToDelete.client_code} deleted`);
      setClientToDelete(null);
      await Promise.all([loadClients(), loadBalances()]);
    } catch (error: any) {
      console.error("Error deleting client:", error);
      toast.error(`Failed to delete client: ${error.message}`);
    }
  };

  const handleToggleStatus = async (client: Client) => {
    const newStatus = client.status === "active" ? "inactive" : "active";
    try {
      const { error } = await supabase
        .from("clients")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", client.id)
        .eq("user_id", user?.id);
      if (error) throw error;
      toast.success(`Marked ${newStatus}`);
      await loadClients();
    } catch (error: any) {
      console.error("Error updating client status:", error);
      toast.error(`Failed to update status: ${error.message}`);
    }
  };

  if (loading) {
    return <ClientListSkeleton />;
  }

  const StatusChip = ({
    value,
    label,
    count,
  }: {
    value: typeof statusFilter;
    label: string;
    count: number;
  }) => {
    const active = statusFilter === value;
    return (
      <button
        onClick={() => setStatusFilter(value)}
        className={[
          "inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-xs font-medium",
          "transition-colors duration-150 focus-ring",
          active
            ? "bg-ink-900 text-white"
            : "bg-white text-ink-600 border border-ink-200 hover:border-ink-300 hover:text-ink-900",
        ].join(" ")}
      >
        <span>{label}</span>
        <span
          className={[
            "tabular-nums text-[10px] px-1.5 py-0.5 rounded-full",
            active ? "bg-white/15" : "bg-ink-100 text-ink-500",
          ].join(" ")}
        >
          {count}
        </span>
      </button>
    );
  };

  return (
    <div>
      <PageHeader
        icon={<Users className="w-4 h-4" />}
        title="Clients"
        description={`${stats.total} ${stats.total === 1 ? "client" : "clients"} in your workspace`}
        actions={
          <Button
            variant="primary"
            size="md"
            leadingIcon={<Plus className="w-4 h-4" />}
            onClick={() => setShowAddModal(true)}
          >
            Add client
          </Button>
        }
      />


      {/* Toolbar */}
      <Card className="mb-4">
        <div className="p-3 sm:p-3.5 flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row gap-2.5">
            <Input
              placeholder="Search by name, code, phone, email…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              leadingIcon={<Search className="w-4 h-4" />}
              trailingIcon={
                searchTerm ? (
                  <button
                    onClick={() => setSearchTerm("")}
                    className="text-ink-400 hover:text-ink-700 transition-colors"
                    aria-label="Clear search"
                  >
                    <X className="w-4 h-4" />
                  </button>
                ) : undefined
              }
            />
            <div className="flex items-center gap-2">
              <Select
                value={`${sortField}-${sortOrder}`}
                onChange={(e) => {
                  const [field, order] = e.target.value.split("-");
                  setSortField(field as SortField);
                  setSortOrder(order as SortOrder);
                }}
                leadingIcon={<ArrowUpDown className="w-4 h-4" />}
                className="min-w-[12rem]"
              >
                <option value="date-desc">Recently modified</option>
                <option value="date-asc">Oldest first</option>
                <option value="name-asc">Name (A → Z)</option>
                <option value="name-desc">Name (Z → A)</option>
                <option value="balance-desc">Highest balance</option>
                <option value="balance-asc">Lowest balance</option>
                <option value="transactions-desc">Most transactions</option>
                <option value="transactions-asc">Fewest transactions</option>
              </Select>
              {/* View toggle, desktop */}
              <div className="hidden sm:inline-flex items-center bg-ink-100 rounded-md p-0.5">
                <button
                  onClick={() => setViewMode("rows")}
                  className={[
                    "h-7 w-7 rounded inline-flex items-center justify-center",
                    "transition-colors duration-150",
                    viewMode === "rows"
                      ? "bg-white text-ink-900 shadow-xs"
                      : "text-ink-500 hover:text-ink-700",
                  ].join(" ")}
                  title="List view"
                  aria-label="List view"
                >
                  <List className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setViewMode("grid")}
                  className={[
                    "h-7 w-7 rounded inline-flex items-center justify-center",
                    "transition-colors duration-150",
                    viewMode === "grid"
                      ? "bg-white text-ink-900 shadow-xs"
                      : "text-ink-500 hover:text-ink-700",
                  ].join(" ")}
                  title="Grid view"
                  aria-label="Grid view"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <StatusChip value="all" label="All" count={stats.total} />
              <StatusChip value="active" label="Active" count={stats.active} />
              <StatusChip value="inactive" label="Inactive" count={stats.inactive} />
            </div>
            <div className="text-xs text-ink-500 tabular-nums shrink-0">
              {filteredClients.length} of {clients.length}
            </div>
          </div>
        </div>
      </Card>

      {/* List */}
      {filteredClients.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Users className="w-5 h-5" />}
            title={
              searchTerm || statusFilter !== "all"
                ? "No clients match your filters"
                : "No clients yet"
            }
            description={
              searchTerm || statusFilter !== "all"
                ? "Try a different search term or clear the active filters."
                : "Start building your client database by adding your first client."
            }
            action={
              !searchTerm && statusFilter === "all" ? (
                <Button
                  variant="primary"
                  leadingIcon={<Plus className="w-4 h-4" />}
                  onClick={() => setShowAddModal(true)}
                >
                  Add your first client
                </Button>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearchTerm("");
                    setStatusFilter("all");
                  }}
                >
                  Clear filters
                </Button>
              )
            }
          />
        </Card>
      ) : viewMode === "rows" ? (
        <ClientRows
          clients={filteredClients}
          balances={balances}
          onSelect={onSelectClient}
          onToggleStatus={handleToggleStatus}
          onDelete={(c) => setClientToDelete(c)}
        />
      ) : (
        <ClientGrid
          clients={filteredClients}
          balances={balances}
          onSelect={onSelectClient}
          onToggleStatus={handleToggleStatus}
          onDelete={(c) => setClientToDelete(c)}
        />
      )}

      {/* Add Client Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => { setShowAddModal(false); setAddName(""); setAddPhone(""); }}
        title="Add new client"
        description="Create a client and optionally seed an opening balance."
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => { setShowAddModal(false); setAddName(""); setAddPhone(""); }}>
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              form="add-client-form"
              loading={submitting}
            >
              Add client
            </Button>
          </>
        }
      >
        <form
          id="add-client-form"
          onSubmit={handleAddClient}
          className="space-y-4"
        >
          <Input
            label="Client name"
            name="client_name"
            required
            placeholder="John Doe"
            autoFocus
            value={addName}
            onChange={(e) => setAddName(e.target.value)}
          />

          {/* Duplicate warning */}
          {duplicateMatches.length > 0 && (
            <div className="rounded-lg border border-warning-100 bg-warning-50 p-3 space-y-2">
              <div className="flex items-center gap-2 text-warning-600">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span className="text-xs font-medium">
                  {duplicateMatches.length === 1
                    ? "A similar client already exists"
                    : `${duplicateMatches.length} similar clients already exist`}
                </span>
              </div>
              <div className="space-y-1.5">
                {duplicateMatches.slice(0, 3).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => { setShowAddModal(false); setAddName(""); setAddPhone(""); onSelectClient(c.id); }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md bg-white border border-warning-100 hover:border-warning-200 hover:bg-warning-50/60 transition-colors text-left"
                  >
                    <Avatar name={c.client_name} size="sm" status={c.status as "active" | "inactive"} />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium text-ink-900 truncate">{c.client_name}</div>
                      <div className="text-[10px] text-ink-500 font-mono">{c.client_code}{c.phone ? ` · ${c.phone}` : ""}</div>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-ink-400 shrink-0" />
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-warning-600/80">You can still add a new client if this is a different person.</p>
            </div>
          )}

          <Input
            label="Phone"
            name="phone"
            type="tel"
            placeholder="+254 700 000000"
            value={addPhone}
            onChange={(e) => setAddPhone(e.target.value)}
          />
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <Input
                label="Initial balance"
                name="initial_balance"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                hint="Optional opening credit"
              />
            </div>
            <Select label="Currency" name="initial_currency" defaultValue="KES">
              <option value="KES">KES</option>
              <option value="USD">USD</option>
            </Select>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!clientToDelete}
        onClose={() => setClientToDelete(null)}
        title="Delete client"
        tone="danger"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setClientToDelete(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDeleteClient}>
              Delete client
            </Button>
          </>
        }
      >
        {clientToDelete && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-negative-50 border border-negative-100">
              <Avatar name={clientToDelete.client_name} size="md" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink-900 truncate">
                  {clientToDelete.client_name}
                </p>
                <p className="text-xs text-ink-500 font-mono">
                  {clientToDelete.client_code}
                </p>
              </div>
            </div>
            <p className="text-sm text-ink-600">
              This permanently deletes the client and all their KES and USD
              transactions. This action can't be undone.
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────

function ClientRows({
  clients,
  balances,
  onSelect,
  onToggleStatus,
  onDelete,
}: {
  clients: Client[];
  balances: Map<string, ClientBalance>;
  onSelect: (id: string) => void;
  onToggleStatus: (c: Client) => void;
  onDelete: (c: Client) => void;
}) {
  return (
    <Card>
      {/* Desktop table */}
      <div className="hidden md:block">
        <div className="grid grid-cols-12 px-4 py-2.5 text-[11px] font-medium uppercase tracking-wide text-ink-500 border-b border-ink-100">
          <div className="col-span-4">Client</div>
          <div className="col-span-2">Phone</div>
          <div className="col-span-2 text-right">KES balance</div>
          <div className="col-span-2 text-right">USD balance</div>
          <div className="col-span-1 text-right">Txns</div>
          <div className="col-span-1 text-right">Actions</div>
        </div>
        <div className="divide-y divide-ink-100">
          {clients.map((client) => {
            const b = balances.get(client.id);
            const kes = b?.kes_balance || 0;
            const usd = b?.usd_balance || 0;
            const txns = b?.transaction_count || 0;
            return (
              <div
                key={client.id}
                onClick={() => onSelect(client.id)}
                className="group grid grid-cols-12 items-center px-4 py-3 hover:bg-ink-50/60 transition-colors cursor-pointer"
              >
                <div className="col-span-4 flex items-center gap-3 min-w-0">
                  <Avatar
                    name={client.client_name}
                    size="sm"
                    status={client.status as "active" | "inactive"}
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-ink-900 truncate group-hover:text-brand-700 transition-colors">
                      {client.client_name}
                    </div>
                    <div className="text-[11px] text-ink-500 font-mono truncate">
                      {client.client_code}
                    </div>
                  </div>
                </div>
                <div className="col-span-2 text-sm text-ink-700 truncate">
                  {client.phone || (
                    <span className="text-ink-400">—</span>
                  )}
                </div>
                <div
                  className={[
                    "col-span-2 text-sm text-right tabular-nums font-medium",
                    kes > 0
                      ? "text-positive-700"
                      : kes < 0
                        ? "text-negative-700"
                        : "text-ink-400",
                  ].join(" ")}
                >
                  {kes !== 0 ? kes.toLocaleString() : "—"}
                </div>
                <div
                  className={[
                    "col-span-2 text-sm text-right tabular-nums font-medium",
                    usd > 0
                      ? "text-positive-700"
                      : usd < 0
                        ? "text-negative-700"
                        : "text-ink-400",
                  ].join(" ")}
                >
                  {usd !== 0 ? `$${usd.toLocaleString()}` : "—"}
                </div>
                <div className="col-span-1 text-sm text-right text-ink-600 tabular-nums">
                  {txns}
                </div>
                <div className="col-span-1 flex items-center justify-end gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleStatus(client);
                    }}
                    className={[
                      "p-1.5 rounded-md opacity-0 group-hover:opacity-100",
                      "text-ink-400 hover:bg-ink-100 hover:text-ink-700",
                      "transition-all duration-150 focus-ring",
                    ].join(" ")}
                    title={
                      client.status === "active"
                        ? "Mark inactive"
                        : "Mark active"
                    }
                  >
                    {client.status === "active" ? (
                      <Ban className="w-3.5 h-3.5" />
                    ) : (
                      <CheckCircle className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(client);
                    }}
                    className="p-1.5 rounded-md opacity-0 group-hover:opacity-100 text-ink-400 hover:bg-negative-50 hover:text-negative-600 transition-all duration-150 focus-ring"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <ChevronRight className="w-4 h-4 text-ink-300 group-hover:text-ink-500 transition-colors ml-1" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Mobile list */}
      <div className="md:hidden divide-y divide-ink-100">
        {clients.map((client) => {
          const b = balances.get(client.id);
          const kes = b?.kes_balance || 0;
          const usd = b?.usd_balance || 0;
          const primaryAmount = kes !== 0 ? kes : usd;
          const primaryCurrency = kes !== 0 || usd === 0 ? "KES" : "USD";
          const isPositive = primaryAmount > 0;
          const isNegative = primaryAmount < 0;
          return (
            <button
              key={client.id}
              onClick={() => onSelect(client.id)}
              className="w-full text-left flex items-center gap-3 px-3 py-3 hover:bg-ink-50 transition-colors press"
            >
              <Avatar
                name={client.client_name}
                size="md"
                status={client.status as "active" | "inactive"}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="text-sm font-medium text-ink-900 truncate">
                    {client.client_name}
                  </div>
                  {client.status === "inactive" && (
                    <Badge tone="muted" size="sm">
                      Inactive
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-ink-500 mt-0.5">
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
              <div className="text-right shrink-0">
                <div
                  className={[
                    "text-sm font-semibold tabular-nums",
                    isPositive
                      ? "text-positive-700"
                      : isNegative
                        ? "text-negative-700"
                        : "text-ink-400",
                  ].join(" ")}
                >
                  {primaryAmount === 0
                    ? "—"
                    : `${primaryCurrency === "USD" ? "$" : ""}${primaryAmount.toLocaleString()}`}
                </div>
                <div className="text-[10px] text-ink-500 mt-0.5">
                  {primaryCurrency}
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-ink-300 ml-1 shrink-0" />
            </button>
          );
        })}
      </div>
    </Card>
  );
}

// Per-client avatar palette — keeps each client visually distinct
const AVATAR_BGS = [
  "bg-brand-600",
  "bg-blue-500",
  "bg-amber-500",
  "bg-emerald-500",
  "bg-rose-500",
  "bg-violet-500",
  "bg-cyan-500",
  "bg-pink-500",
];

function hashName(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return h % AVATAR_BGS.length;
}

const formatActivityDate = (iso: string | null) => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

function ClientGrid({
  clients,
  balances,
  onSelect,
  onToggleStatus,
  onDelete,
}: {
  clients: Client[];
  balances: Map<string, ClientBalance>;
  onSelect: (id: string) => void;
  onToggleStatus: (c: Client) => void;
  onDelete: (c: Client) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      {clients.map((client) => {
        const b = balances.get(client.id);
        const kes = b?.kes_balance || 0;
        const usd = b?.usd_balance || 0;
        const isInactive = client.status === "inactive";
        const initials = client.client_name
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((s) => s.charAt(0).toUpperCase())
          .join("") || "?";
        const avatarBg = isInactive
          ? "bg-ink-400"
          : AVATAR_BGS[hashName(client.client_name)];
        const lastActivity = formatActivityDate(
          client.last_transaction_date || client.updated_at || client.created_at,
        );

        const kesColor =
          kes < 0 ? "text-negative-600" : kes > 0 ? "text-positive-700" : "text-ink-400";
        const usdColor =
          usd < 0 ? "text-negative-600" : usd > 0 ? "text-positive-700" : "text-info-700";

        return (
          <div
            key={client.id}
            role="button"
            tabIndex={0}
            onClick={() => onSelect(client.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(client.id);
              }
            }}
            className={[
              "group relative cursor-pointer bg-white rounded-2xl border-2 border-brand-100",
              "shadow-xs transition-all duration-200 ease-out",
              "hover:shadow-lg hover:-translate-y-0.5 hover:border-brand-300",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-1",
              isInactive ? "opacity-75" : "",
            ].join(" ")}
          >
            {/* Body */}
            <div className="p-4 space-y-3">
              {/* Avatar + name + code */}
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={[
                    "w-11 h-11 rounded-xl flex items-center justify-center shrink-0",
                    "text-white text-base font-bold shadow-sm",
                    avatarBg,
                  ].join(" ")}
                  aria-hidden
                >
                  {initials}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-base font-bold text-ink-900 truncate leading-tight">
                    {client.client_name}
                  </div>
                  <div className="text-[11px] text-ink-400 font-mono truncate mt-0.5">
                    {client.client_code}
                  </div>
                </div>
                {isInactive && (
                  <Badge tone="muted" size="sm">
                    Off
                  </Badge>
                )}
              </div>

              {/* Phone */}
              {client.phone && (
                <div className="flex items-center gap-1.5 text-xs text-ink-500">
                  <Phone className="w-3.5 h-3.5 text-ink-400 shrink-0" />
                  <span className="truncate">{client.phone}</span>
                </div>
              )}

              {/* KES + USD balance boxes */}
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-negative-50 px-2.5 py-2">
                  <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide font-semibold text-ink-500">
                    <DollarSign className="w-3 h-3 text-negative-600" />
                    <span>Balance</span>
                  </div>
                  <div
                    className={[
                      "mt-0.5 text-sm font-bold tabular-nums truncate",
                      kesColor,
                    ].join(" ")}
                    title={`KES ${kes.toLocaleString()}`}
                  >
                    {kes === 0 ? "KES —" : `KES ${kes.toLocaleString()}`}
                  </div>
                </div>
                <div className="rounded-lg bg-info-50 px-2.5 py-2">
                  <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide font-semibold text-ink-500">
                    <DollarSign className="w-3 h-3 text-info-600" />
                    <span>USD</span>
                  </div>
                  <div
                    className={[
                      "mt-0.5 text-sm font-bold tabular-nums truncate",
                      usdColor,
                    ].join(" ")}
                    title={`$${usd.toLocaleString()}`}
                  >
                    {usd === 0
                      ? "$ —"
                      : usd < 0
                        ? `-$${Math.abs(usd).toLocaleString()}`
                        : `$${usd.toLocaleString()}`}
                  </div>
                </div>
              </div>

              {/* Last activity */}
              {lastActivity && (
                <div className="flex items-center gap-1.5 text-[11px] text-ink-500">
                  <Calendar className="w-3 h-3 text-ink-400 shrink-0" />
                  <span>{lastActivity}</span>
                </div>
              )}
            </div>

            {/* Action row — whole card is clickable; these are explicit secondary actions */}
            <div className="px-4 pb-3 pt-2.5 border-t border-ink-100 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-brand-700 group-hover:text-brand-800 transition-colors">
                <Eye className="w-3.5 h-3.5" />
                <span>Tap to view</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleStatus(client);
                  }}
                  className="w-8 h-8 rounded-lg bg-warning-50 text-warning-600 hover:bg-warning-100 transition-colors focus-ring press inline-flex items-center justify-center"
                  title={client.status === "active" ? "Mark inactive" : "Mark active"}
                  aria-label={
                    client.status === "active" ? "Mark inactive" : "Mark active"
                  }
                >
                  {client.status === "active" ? (
                    <Ban className="w-3.5 h-3.5" />
                  ) : (
                    <CheckCircle className="w-3.5 h-3.5" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(client);
                  }}
                  className="w-8 h-8 rounded-lg bg-negative-50 text-negative-600 hover:bg-negative-100 transition-colors focus-ring press inline-flex items-center justify-center"
                  title="Delete"
                  aria-label="Delete client"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ClientListSkeleton() {
  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div className="h-7 w-40 skeleton rounded-md" />
        <div className="h-9 w-28 skeleton rounded-lg" />
      </div>
      <div className="h-12 skeleton rounded-xl mb-4" />
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-14 skeleton rounded-xl" />
        ))}
      </div>
    </div>
  );
}

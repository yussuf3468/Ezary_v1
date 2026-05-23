import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "react-toastify";
import {
  FileText,
  TrendingUp,
  BarChart3,
  DollarSign,
  Users,
  Activity,
  CreditCard,
  Calendar,
  Download,
  FileSpreadsheet,
  Printer,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  PageHeader,
  StatTile,
} from "./ui";

interface ClientStats {
  totalClients: number;
  activeClients: number;
  inactiveClients: number;
  totalBalanceKES: number;
  totalBalanceUSD: number;
  totalTransactions: number;
}

interface TopClient {
  client_id: string;
  client_name: string;
  client_code: string;
  total_balance_kes: number;
  total_balance_usd: number;
  transaction_count: number;
}

interface MonthlyTrend {
  month: string;
  transactions_kes: number;
  transactions_usd: number;
  balance_kes: number;
  balance_usd: number;
}

type ReportPeriod = "current" | "last3" | "last6" | "year" | "custom";
type Currency = "KES" | "USD" | "BOTH";

const PERIOD_OPTIONS: { id: ReportPeriod; label: string; short: string }[] = [
  { id: "current", label: "This month", short: "This Mo" },
  { id: "last3", label: "Last 3 months", short: "3 Mo" },
  { id: "last6", label: "Last 6 months", short: "6 Mo" },
  { id: "year", label: "This year", short: "Year" },
  { id: "custom", label: "Custom", short: "Custom" },
];

const CURRENCY_OPTIONS: { id: Currency; label: string }[] = [
  { id: "BOTH", label: "Both" },
  { id: "KES", label: "KES" },
  { id: "USD", label: "USD" },
];

// Avatar palette (same as ClientList)
const AVATAR_BGS = [
  "bg-rose-500",
  "bg-amber-500",
  "bg-emerald-500",
  "bg-sky-500",
  "bg-violet-500",
  "bg-fuchsia-500",
  "bg-cyan-500",
  "bg-orange-500",
  "bg-teal-500",
  "bg-indigo-500",
];

function hashName(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatMonth(yyyyMm: string) {
  const d = new Date(yyyyMm + "-01");
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export default function Reports() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [clientStats, setClientStats] = useState<ClientStats>({
    totalClients: 0,
    activeClients: 0,
    inactiveClients: 0,
    totalBalanceKES: 0,
    totalBalanceUSD: 0,
    totalTransactions: 0,
  });
  const [topClients, setTopClients] = useState<TopClient[]>([]);
  const [monthlyTrends, setMonthlyTrends] = useState<MonthlyTrend[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<ReportPeriod>("last6");
  const [selectedCurrency, setSelectedCurrency] = useState<Currency>("BOTH");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");

  useEffect(() => {
    if (user) {
      loadReports();
    }
  }, [user, selectedPeriod, selectedCurrency, customStartDate, customEndDate]);

  const getDateRange = useMemo(() => {
    const today = new Date();
    let startDate = "";
    let endDate = today.toLocaleDateString("en-CA");

    switch (selectedPeriod) {
      case "current":
        startDate = `${today.getFullYear()}-${String(
          today.getMonth() + 1,
        ).padStart(2, "0")}-01`;
        break;
      case "last3": {
        const d = new Date();
        d.setMonth(d.getMonth() - 3);
        startDate = d.toLocaleDateString("en-CA");
        break;
      }
      case "last6": {
        const d = new Date();
        d.setMonth(d.getMonth() - 6);
        startDate = d.toLocaleDateString("en-CA");
        break;
      }
      case "year":
        startDate = `${new Date().getFullYear()}-01-01`;
        break;
      case "custom":
        startDate = customStartDate;
        endDate = customEndDate;
        break;
    }

    return { startDate, endDate };
  }, [selectedPeriod, customStartDate, customEndDate]);

  const loadReports = useCallback(async () => {
    if (!user) return;
    if (selectedPeriod === "custom" && (!customStartDate || !customEndDate))
      return;

    setLoading(true);
    try {
      const { startDate, endDate } = getDateRange;

      const { data: clients, error: clientsError } = await supabase
        .from("clients")
        .select("id, status")
        .eq("user_id", user.id);

      if (clientsError) throw clientsError;

      const activeClients =
        clients?.filter((c) => c.status === "active").length || 0;
      const totalClients = clients?.length || 0;

      const { data: kesTransactions, error: kesError } = await supabase
        .from("client_transactions_kes")
        .select(
          `id, client_id, debit, credit, transaction_date, clients!inner(user_id, client_name, client_code)`,
        )
        .eq("clients.user_id", user.id)
        .gte("transaction_date", startDate)
        .lte("transaction_date", endDate);

      if (kesError) throw kesError;

      const { data: usdTransactions, error: usdError } = await supabase
        .from("client_transactions_usd")
        .select(
          `id, client_id, debit, credit, transaction_date, clients!inner(user_id, client_name, client_code)`,
        )
        .eq("clients.user_id", user.id)
        .gte("transaction_date", startDate)
        .lte("transaction_date", endDate);

      if (usdError) throw usdError;

      const totalKES =
        kesTransactions?.reduce(
          (sum, t) => sum + (t.credit || 0) - (t.debit || 0),
          0,
        ) || 0;

      const totalUSD =
        usdTransactions?.reduce(
          (sum, t) => sum + (t.credit || 0) - (t.debit || 0),
          0,
        ) || 0;

      setClientStats({
        totalClients,
        activeClients,
        inactiveClients: totalClients - activeClients,
        totalBalanceKES: totalKES,
        totalBalanceUSD: totalUSD,
        totalTransactions:
          (kesTransactions?.length || 0) + (usdTransactions?.length || 0),
      });

      const clientMap = new Map<string, TopClient>();

      kesTransactions?.forEach((t) => {
        const key = t.client_id;
        if (!clientMap.has(key)) {
          const cd = Array.isArray(t.clients) ? t.clients[0] : t.clients;
          clientMap.set(key, {
            client_id: t.client_id,
            client_name: cd?.client_name || "",
            client_code: cd?.client_code || "",
            total_balance_kes: 0,
            total_balance_usd: 0,
            transaction_count: 0,
          });
        }
        const c = clientMap.get(key)!;
        c.total_balance_kes += (t.credit || 0) - (t.debit || 0);
        c.transaction_count += 1;
      });

      usdTransactions?.forEach((t) => {
        const key = t.client_id;
        if (!clientMap.has(key)) {
          const cd = Array.isArray(t.clients) ? t.clients[0] : t.clients;
          clientMap.set(key, {
            client_id: t.client_id,
            client_name: cd?.client_name || "",
            client_code: cd?.client_code || "",
            total_balance_kes: 0,
            total_balance_usd: 0,
            transaction_count: 0,
          });
        }
        const c = clientMap.get(key)!;
        c.total_balance_usd += (t.credit || 0) - (t.debit || 0);
        c.transaction_count += 1;
      });

      const topClientsList = Array.from(clientMap.values())
        .sort((a, b) => {
          const aTotal = a.total_balance_kes + a.total_balance_usd * 130;
          const bTotal = b.total_balance_kes + b.total_balance_usd * 130;
          return bTotal - aTotal;
        })
        .slice(0, 10);

      setTopClients(topClientsList);

      const monthlyMap = new Map<string, MonthlyTrend>();

      kesTransactions?.forEach((t) => {
        const month = t.transaction_date.substring(0, 7);
        if (!monthlyMap.has(month)) {
          monthlyMap.set(month, {
            month,
            transactions_kes: 0,
            transactions_usd: 0,
            balance_kes: 0,
            balance_usd: 0,
          });
        }
        const trend = monthlyMap.get(month)!;
        trend.transactions_kes += 1;
        trend.balance_kes += (t.credit || 0) - (t.debit || 0);
      });

      usdTransactions?.forEach((t) => {
        const month = t.transaction_date.substring(0, 7);
        if (!monthlyMap.has(month)) {
          monthlyMap.set(month, {
            month,
            transactions_kes: 0,
            transactions_usd: 0,
            balance_kes: 0,
            balance_usd: 0,
          });
        }
        const trend = monthlyMap.get(month)!;
        trend.transactions_usd += 1;
        trend.balance_usd += (t.credit || 0) - (t.debit || 0);
      });

      const trends = Array.from(monthlyMap.values()).sort((a, b) =>
        a.month.localeCompare(b.month),
      );

      setMonthlyTrends(trends);
    } catch (error) {
      console.error("Error loading reports:", error);
    } finally {
      setLoading(false);
    }
  }, [user, getDateRange, selectedPeriod, customStartDate, customEndDate]);

  const exportToPDF = async () => {
    try {
      toast.info("Generating PDF report…");

      const jsPDF = (await import("jspdf")).default;
      const autoTable = (await import("jspdf-autotable")).default;

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      let yPosition = 15;

      doc.setFillColor(13, 148, 136);
      doc.rect(0, 0, pageWidth, 40, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(20);
      doc.setFont("helvetica", "bold");
      doc.text("Ezary CMS — Financial Report", pageWidth / 2, 20, {
        align: "center",
      });

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      const periodText =
        selectedPeriod === "custom"
          ? `${customStartDate} to ${customEndDate}`
          : PERIOD_OPTIONS.find((p) => p.id === selectedPeriod)?.label;
      doc.text(`Period: ${periodText}`, pageWidth / 2, 30, { align: "center" });

      yPosition = 50;

      doc.setTextColor(0, 0, 0);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Summary Statistics", 14, yPosition);
      yPosition += 8;

      const summaryData = [
        ["Metric", "Value"],
        ["Total Clients", clientStats.totalClients.toString()],
        ["Active Clients", clientStats.activeClients.toString()],
        ["Total Transactions", clientStats.totalTransactions.toString()],
        ["Balance (KES)", `KES ${clientStats.totalBalanceKES.toLocaleString()}`],
        ["Balance (USD)", `USD ${clientStats.totalBalanceUSD.toLocaleString()}`],
      ];

      autoTable(doc, {
        startY: yPosition,
        head: [summaryData[0]],
        body: summaryData.slice(1),
        theme: "grid",
        headStyles: {
          fillColor: [13, 148, 136],
          textColor: 255,
          fontStyle: "bold",
        },
        alternateRowStyles: { fillColor: [240, 253, 250] },
        margin: { left: 14, right: 14 },
      });

      yPosition = (doc as any).lastAutoTable.finalY + 15;

      if (topClients.length > 0) {
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("Top Clients", 14, yPosition);
        yPosition += 8;

        const topClientsData = topClients.map((c) => [
          c.client_name,
          c.client_code,
          `KES ${c.total_balance_kes.toLocaleString()}`,
          `USD ${c.total_balance_usd.toLocaleString()}`,
          c.transaction_count.toString(),
        ]);

        autoTable(doc, {
          startY: yPosition,
          head: [
            [
              "Client Name",
              "Code",
              "Balance (KES)",
              "Balance (USD)",
              "Transactions",
            ],
          ],
          body: topClientsData,
          theme: "striped",
          headStyles: {
            fillColor: [13, 148, 136],
            textColor: 255,
            fontStyle: "bold",
          },
          alternateRowStyles: { fillColor: [240, 253, 250] },
          margin: { left: 14, right: 14 },
        });
      }

      const pageCount = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(128, 128, 128);
        doc.text(
          `Generated ${new Date().toLocaleDateString()} · Page ${i} of ${pageCount}`,
          pageWidth / 2,
          doc.internal.pageSize.getHeight() - 10,
          { align: "center" },
        );
      }

      const filename = `Ezary_Financial_Report_${new Date()
        .toLocaleDateString("en-CA")}.pdf`;
      doc.save(filename);
      toast.success(`Exported ${filename}`);
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error(
        `Failed to generate PDF: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );
    }
  };

  const exportToExcel = () => {
    try {
      let csv = "Ezary CMS - Financial Report\n";
      csv += `Generated: ${new Date().toLocaleString()}\n\n`;

      csv += "SUMMARY STATISTICS\n";
      csv += `Total Clients,${clientStats.totalClients}\n`;
      csv += `Active Clients,${clientStats.activeClients}\n`;
      csv += `Inactive Clients,${clientStats.inactiveClients}\n`;
      csv += `Total Transactions,${clientStats.totalTransactions}\n`;
      csv += `Total Balance (KES),${clientStats.totalBalanceKES}\n`;
      csv += `Total Balance (USD),${clientStats.totalBalanceUSD}\n\n`;

      if (topClients.length > 0) {
        csv += "TOP CLIENTS\n";
        csv +=
          "Client Name,Client Code,Balance (KES),Balance (USD),Transaction Count\n";
        topClients.forEach((c) => {
          csv += `"${c.client_name}",${c.client_code},${c.total_balance_kes},${c.total_balance_usd},${c.transaction_count}\n`;
        });
        csv += "\n";
      }

      if (monthlyTrends.length > 0) {
        csv += "MONTHLY TRENDS\n";
        csv +=
          "Month,Transactions (KES),Transactions (USD),Balance (KES),Balance (USD)\n";
        monthlyTrends.forEach((t) => {
          csv += `${t.month},${t.transactions_kes},${t.transactions_usd},${t.balance_kes},${t.balance_usd}\n`;
        });
      }

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute(
        "download",
        `Ezary_Report_${new Date().toLocaleDateString("en-CA")}.csv`,
      );
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Exported CSV file");
    } catch (error) {
      console.error("Error exporting to CSV:", error);
      toast.error(
        `Failed to export CSV: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );
    }
  };

  const printReport = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-10 w-48 skeleton rounded-md" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 skeleton rounded-xl" />
          ))}
        </div>
        <div className="h-32 skeleton rounded-2xl" />
        <div className="h-96 skeleton rounded-2xl" />
      </div>
    );
  }

  const showKES = selectedCurrency === "BOTH" || selectedCurrency === "KES";
  const showUSD = selectedCurrency === "BOTH" || selectedCurrency === "USD";

  return (
    <div className="space-y-4">
      {/* Page header */}
      <PageHeader
        title="Analytics & reports"
        description="Insights across clients, balances and transaction activity."
        icon={<BarChart3 className="w-4 h-4" />}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              leadingIcon={<Printer className="w-4 h-4" />}
              onClick={printReport}
            >
              <span className="hidden sm:inline">Print</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              leadingIcon={<FileSpreadsheet className="w-4 h-4" />}
              onClick={exportToExcel}
            >
              <span className="hidden sm:inline">CSV</span>
            </Button>
            <Button
              variant="primary"
              size="sm"
              leadingIcon={<Download className="w-4 h-4" />}
              onClick={exportToPDF}
            >
              <span className="hidden sm:inline">Export PDF</span>
              <span className="sm:hidden">PDF</span>
            </Button>
          </>
        }
      />

      {/* Filters */}
      <Card className="p-3 sm:p-4">
        <div className="flex flex-col gap-3">
          {/* Period segmented control */}
          <div>
            <p className="text-[10px] uppercase tracking-wide font-semibold text-ink-500 mb-1.5">
              Period
            </p>
            <div className="inline-flex flex-wrap items-center bg-ink-100 rounded-lg p-0.5 gap-0.5">
              {PERIOD_OPTIONS.map((p) => {
                const active = selectedPeriod === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPeriod(p.id)}
                    className={[
                      "h-8 px-3 inline-flex items-center rounded-md text-xs transition-colors focus-ring",
                      active
                        ? "bg-white text-brand-700 shadow-xs font-semibold"
                        : "text-ink-500 hover:text-ink-700 font-medium",
                    ].join(" ")}
                  >
                    <span className="hidden sm:inline">{p.label}</span>
                    <span className="sm:hidden">{p.short}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom date range */}
          {selectedPeriod === "custom" && (
            <div className="grid grid-cols-2 gap-3 max-w-md">
              <Input
                label="Start date"
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                leadingIcon={<Calendar className="w-4 h-4" />}
              />
              <Input
                label="End date"
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                leadingIcon={<Calendar className="w-4 h-4" />}
              />
            </div>
          )}

          {/* Currency segmented control */}
          <div>
            <p className="text-[10px] uppercase tracking-wide font-semibold text-ink-500 mb-1.5">
              Currency view
            </p>
            <div className="inline-flex items-center bg-ink-100 rounded-lg p-0.5 gap-0.5">
              {CURRENCY_OPTIONS.map((c) => {
                const active = selectedCurrency === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCurrency(c.id)}
                    className={[
                      "h-8 px-3 inline-flex items-center rounded-md text-xs transition-colors focus-ring",
                      active
                        ? "bg-white text-brand-700 shadow-xs font-semibold"
                        : "text-ink-500 hover:text-ink-700 font-medium",
                    ].join(" ")}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </Card>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        <StatTile
          label="Total clients"
          value={clientStats.totalClients}
          hint={`${clientStats.activeClients} active · ${clientStats.inactiveClients} inactive`}
          icon={<Users className="w-4 h-4" />}
          tone="brand"
        />
        {showKES && (
          <StatTile
            label="Net balance (KES)"
            value={`KES ${clientStats.totalBalanceKES.toLocaleString()}`}
            icon={<CreditCard className="w-4 h-4" />}
            tone={clientStats.totalBalanceKES >= 0 ? "positive" : "negative"}
          />
        )}
        {showUSD && (
          <StatTile
            label="Net balance (USD)"
            value={`$${clientStats.totalBalanceUSD.toLocaleString()}`}
            icon={<DollarSign className="w-4 h-4" />}
            tone={clientStats.totalBalanceUSD >= 0 ? "positive" : "negative"}
          />
        )}
        <StatTile
          label="Transactions"
          value={clientStats.totalTransactions}
          hint="In selected period"
          icon={<Activity className="w-4 h-4" />}
          tone="info"
        />
      </div>

      {/* Top clients */}
      {topClients.length > 0 && (
        <Card className="overflow-hidden">
          <div className="px-4 sm:px-5 py-3 border-b border-ink-100 bg-ink-50/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-md bg-brand-50 text-brand-600 inline-flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-ink-900 tracking-tight">
                  Top clients by balance
                </h3>
                <p className="text-[11px] text-ink-500">
                  Ranked across the selected period
                </p>
              </div>
            </div>
            <Badge tone="brand" size="sm">
              Top {topClients.length}
            </Badge>
          </div>
          <div className="divide-y divide-ink-100">
            {topClients.map((client, index) => {
              const bg = AVATAR_BGS[hashName(client.client_name) % AVATAR_BGS.length];
              return (
                <div
                  key={client.client_id}
                  className="flex items-center gap-3 px-4 sm:px-5 py-3 hover:bg-ink-50/50 transition-colors"
                >
                  {/* Rank pill */}
                  <span
                    className={[
                      "shrink-0 w-7 h-7 rounded-md inline-flex items-center justify-center text-[11px] font-bold tabular-nums",
                      index === 0
                        ? "bg-amber-100 text-amber-700 ring-1 ring-amber-200"
                        : index === 1
                          ? "bg-ink-100 text-ink-700 ring-1 ring-ink-200"
                          : index === 2
                            ? "bg-orange-100 text-orange-700 ring-1 ring-orange-200"
                            : "bg-brand-50 text-brand-700 ring-1 ring-brand-100",
                    ].join(" ")}
                  >
                    {index + 1}
                  </span>
                  {/* Avatar */}
                  <div
                    className={[
                      "shrink-0 w-9 h-9 rounded-xl text-white font-bold text-xs flex items-center justify-center shadow-sm",
                      bg,
                    ].join(" ")}
                  >
                    {getInitials(client.client_name)}
                  </div>
                  {/* Identity */}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink-900 truncate">
                      {client.client_name}
                    </p>
                    <p className="text-[11px] text-ink-500 font-mono truncate">
                      {client.client_code || "—"}
                    </p>
                  </div>
                  {/* Balances */}
                  <div className="shrink-0 text-right">
                    {showKES && client.total_balance_kes !== 0 && (
                      <p className="text-sm font-semibold text-positive-700 tabular-nums">
                        KES {client.total_balance_kes.toLocaleString()}
                      </p>
                    )}
                    {showUSD && client.total_balance_usd !== 0 && (
                      <p className="text-sm font-semibold text-info-600 tabular-nums">
                        ${client.total_balance_usd.toLocaleString()}
                      </p>
                    )}
                    <p className="text-[10px] text-ink-500 mt-0.5">
                      {client.transaction_count}{" "}
                      {client.transaction_count === 1 ? "txn" : "txns"}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Monthly trends */}
      {monthlyTrends.length > 0 && (
        <Card className="overflow-hidden">
          <div className="px-4 sm:px-5 py-3 border-b border-ink-100 bg-ink-50/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-md bg-info-50 text-info-600 inline-flex items-center justify-center">
                <BarChart3 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-ink-900 tracking-tight">
                  Monthly transaction trends
                </h3>
                <p className="text-[11px] text-ink-500">
                  Volume and net flow per month
                </p>
              </div>
            </div>
            <Badge tone="info" size="sm">
              {monthlyTrends.length}{" "}
              {monthlyTrends.length === 1 ? "month" : "months"}
            </Badge>
          </div>

          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-ink-50 border-b border-ink-100 text-[11px] uppercase tracking-wide text-ink-500 font-semibold">
                  <th className="text-left py-2.5 px-4">Month</th>
                  {showKES && (
                    <>
                      <th className="text-right py-2.5 px-4">KES txns</th>
                      <th className="text-right py-2.5 px-4">KES net</th>
                    </>
                  )}
                  {showUSD && (
                    <>
                      <th className="text-right py-2.5 px-4">USD txns</th>
                      <th className="text-right py-2.5 px-4">USD net</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {monthlyTrends.map((t) => (
                  <tr
                    key={t.month}
                    className="hover:bg-brand-50/20 transition-colors"
                  >
                    <td className="py-2.5 px-4 font-medium text-ink-900">
                      {formatMonth(t.month)}
                    </td>
                    {showKES && (
                      <>
                        <td className="text-right py-2.5 px-4 text-ink-600 tabular-nums">
                          {t.transactions_kes}
                        </td>
                        <td
                          className={[
                            "text-right py-2.5 px-4 font-semibold tabular-nums",
                            t.balance_kes >= 0
                              ? "text-positive-700"
                              : "text-negative-700",
                          ].join(" ")}
                        >
                          {t.balance_kes >= 0 ? "" : "−"}
                          KES {Math.abs(t.balance_kes).toLocaleString()}
                        </td>
                      </>
                    )}
                    {showUSD && (
                      <>
                        <td className="text-right py-2.5 px-4 text-ink-600 tabular-nums">
                          {t.transactions_usd}
                        </td>
                        <td
                          className={[
                            "text-right py-2.5 px-4 font-semibold tabular-nums",
                            t.balance_usd >= 0
                              ? "text-positive-700"
                              : "text-negative-700",
                          ].join(" ")}
                        >
                          {t.balance_usd >= 0 ? "" : "−"}$
                          {Math.abs(t.balance_usd).toLocaleString()}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden divide-y divide-ink-100">
            {monthlyTrends.map((t) => (
              <div key={t.month} className="px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-ink-900">
                    {formatMonth(t.month)}
                  </p>
                  <p className="text-[11px] text-ink-500 tabular-nums">
                    {t.transactions_kes + t.transactions_usd} txns
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {showKES && (
                    <div className="rounded-lg bg-ink-50 p-2">
                      <p className="text-[10px] uppercase tracking-wide font-semibold text-ink-500">
                        KES
                      </p>
                      <p
                        className={[
                          "mt-0.5 text-sm font-bold tabular-nums truncate",
                          t.balance_kes >= 0
                            ? "text-positive-700"
                            : "text-negative-700",
                        ].join(" ")}
                      >
                        {t.balance_kes >= 0 ? "" : "−"}KES{" "}
                        {Math.abs(t.balance_kes).toLocaleString()}
                      </p>
                      <p className="text-[10px] text-ink-500 mt-0.5">
                        {t.transactions_kes} txns
                      </p>
                    </div>
                  )}
                  {showUSD && (
                    <div className="rounded-lg bg-ink-50 p-2">
                      <p className="text-[10px] uppercase tracking-wide font-semibold text-ink-500">
                        USD
                      </p>
                      <p
                        className={[
                          "mt-0.5 text-sm font-bold tabular-nums truncate",
                          t.balance_usd >= 0
                            ? "text-positive-700"
                            : "text-negative-700",
                        ].join(" ")}
                      >
                        {t.balance_usd >= 0 ? "" : "−"}$
                        {Math.abs(t.balance_usd).toLocaleString()}
                      </p>
                      <p className="text-[10px] text-ink-500 mt-0.5">
                        {t.transactions_usd} txns
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Empty state */}
      {clientStats.totalClients === 0 && (
        <Card>
          <EmptyState
            icon={<FileText className="w-6 h-6" />}
            title="No data yet"
            description="Start by adding clients and transactions, then come back here to see analytics and trends."
          />
        </Card>
      )}
    </div>
  );
}

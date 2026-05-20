// PDF statement generation. Aim: a polished fintech statement a client can read in 10 seconds.
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatCurrency } from "./currency";

interface Client {
  client_name: string;
  client_code: string;
  email: string | null;
  phone: string | null;
  business_name: string | null;
  address: string | null;
}

interface Transaction {
  transaction_date: string;
  description: string;
  debit: number;
  credit: number;
  payment_method: string | null;
  reference_number: string | null;
  notes: string | null;
}

interface ReportOptions {
  client: Client;
  transactionsKES: Transaction[];
  transactionsUSD: Transaction[];
  summaryKES: { receivable: number; paid: number; balance: number };
  summaryUSD: { receivable: number; paid: number; balance: number };
  reportType: "full" | "summary" | "kes-only" | "usd-only";
  business?: { name?: string | null; phone?: string | null; email?: string | null };
}

// Design tokens — mirror the in-app teal-on-slate palette.
const TEAL: [number, number, number] = [13, 148, 136];
const TEAL_DARK: [number, number, number] = [15, 118, 110];
const TEAL_50: [number, number, number] = [240, 253, 250];
const TEAL_100: [number, number, number] = [204, 251, 241];
const INK_900: [number, number, number] = [15, 23, 42];
const INK_700: [number, number, number] = [51, 65, 85];
const INK_500: [number, number, number] = [100, 116, 139];
const INK_400: [number, number, number] = [148, 163, 184];
const INK_300: [number, number, number] = [203, 213, 225];
const INK_200: [number, number, number] = [226, 232, 240];
const INK_100: [number, number, number] = [241, 245, 249];
const INK_50: [number, number, number] = [248, 250, 252];
const POSITIVE: [number, number, number] = [4, 120, 87];
const POSITIVE_50: [number, number, number] = [236, 253, 245];
const NEGATIVE: [number, number, number] = [185, 28, 28];
const NEGATIVE_50: [number, number, number] = [254, 242, 242];
const WHITE: [number, number, number] = [255, 255, 255];

const MARGIN = 14;

const txt = (doc: jsPDF, rgb: [number, number, number]) => doc.setTextColor(rgb[0], rgb[1], rgb[2]);
const fill = (doc: jsPDF, rgb: [number, number, number]) => doc.setFillColor(rgb[0], rgb[1], rgb[2]);
const draw = (doc: jsPDF, rgb: [number, number, number]) => doc.setDrawColor(rgb[0], rgb[1], rgb[2]);

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

const fmtLongDate = (d: Date) =>
  d.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });

// Just the number portion (formatCurrency adds currency prefix; column header carries the unit).
const fmtAmount = (n: number, currency: "KES" | "USD") =>
  formatCurrency(Math.abs(n), currency).replace(/[^0-9.,-]/g, "");

const fmtSigned = (n: number, currency: "KES" | "USD") =>
  (n < 0 ? "-" : "") + fmtAmount(n, currency);

const hairline = (doc: jsPDF, y: number, pageWidth: number, color: [number, number, number] = INK_200) => {
  draw(doc, color);
  doc.setLineWidth(0.15);
  doc.line(MARGIN, y, pageWidth - MARGIN, y);
};

// Period = earliest..latest transaction date across both currencies, or "—" if no transactions.
const computePeriod = (k: Transaction[], u: Transaction[]) => {
  const all = [...k, ...u].map((t) => new Date(t.transaction_date).getTime()).filter((n) => !Number.isNaN(n));
  if (all.length === 0) return null;
  return { from: new Date(Math.min(...all)), to: new Date(Math.max(...all)) };
};

// --- HEADER -----------------------------------------------------------------

const drawHeader = (
  doc: jsPDF,
  client: Client,
  pageWidth: number,
  period: { from: Date; to: Date } | null,
  business: ReportOptions["business"],
) => {
  // Teal accent strip
  fill(doc, TEAL);
  doc.rect(0, 0, pageWidth, 3, "F");

  // Soft teal band behind brand block (very faint)
  fill(doc, TEAL_50);
  doc.rect(0, 3, pageWidth, 26, "F");

  // Brand block (left)
  txt(doc, TEAL_DARK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(business?.name || "Ezary", MARGIN, 14);

  txt(doc, INK_500);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  const bizMeta: string[] = [];
  if (business?.phone) bizMeta.push(business.phone);
  if (business?.email) bizMeta.push(business.email);
  if (bizMeta.length === 0) bizMeta.push("Client account statement");
  doc.text(bizMeta.join("   ·   "), MARGIN, 19);

  // Statement label (right)
  txt(doc, INK_500);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("STATEMENT OF ACCOUNT", pageWidth - MARGIN, 14, { align: "right" });

  txt(doc, INK_900);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(fmtLongDate(new Date()), pageWidth - MARGIN, 19, { align: "right" });

  if (period) {
    txt(doc, INK_500);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(
      `Period: ${fmtDate(period.from.toISOString())} — ${fmtDate(period.to.toISOString())}`,
      pageWidth - MARGIN,
      24,
      { align: "right" },
    );
  }

  // From / To blocks
  let y = 38;
  const colW = (pageWidth - MARGIN * 2 - 8) / 2;

  // FROM block
  txt(doc, INK_500);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("FROM", MARGIN, y);

  txt(doc, INK_900);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(business?.name || "Ezary", MARGIN, y + 5);

  txt(doc, INK_500);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  let lineY = y + 10;
  if (business?.phone) {
    doc.text(business.phone, MARGIN, lineY);
    lineY += 4;
  }
  if (business?.email) {
    doc.text(business.email, MARGIN, lineY);
    lineY += 4;
  }

  // TO block (right column)
  const toX = MARGIN + colW + 8;
  txt(doc, INK_500);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("BILLED TO", toX, y);

  txt(doc, INK_900);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(client.client_name, toX, y + 5);

  txt(doc, INK_500);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  let toLineY = y + 10;
  doc.text(`Account · ${client.client_code}`, toX, toLineY);
  toLineY += 4;
  if (client.business_name) {
    doc.text(client.business_name, toX, toLineY);
    toLineY += 4;
  }
  if (client.phone) {
    doc.text(client.phone, toX, toLineY);
    toLineY += 4;
  }
  if (client.email) {
    doc.text(client.email, toX, toLineY);
    toLineY += 4;
  }
  if (client.address) {
    const addressLines = doc.splitTextToSize(client.address, colW);
    doc.text(addressLines, toX, toLineY);
    toLineY += addressLines.length * 4;
  }

  return Math.max(lineY, toLineY) + 6;
};

// --- HERO BALANCE CARD -------------------------------------------------------

const drawHeroBalance = (
  doc: jsPDF,
  y: number,
  pageWidth: number,
  currency: "KES" | "USD",
  summary: { paid: number; receivable: number; balance: number },
): number => {
  const cardW = pageWidth - MARGIN * 2;
  const cardH = 22;

  const bal = summary.balance;
  const isCredit = bal > 0;
  const isSettled = bal === 0;

  // Card body
  fill(doc, WHITE);
  doc.roundedRect(MARGIN, y, cardW, cardH, 1.5, 1.5, "F");
  draw(doc, INK_200);
  doc.setLineWidth(0.3);
  doc.roundedRect(MARGIN, y, cardW, cardH, 1.5, 1.5, "S");

  // Left accent bar
  const accent = isSettled ? INK_300 : isCredit ? POSITIVE : NEGATIVE;
  fill(doc, accent);
  doc.rect(MARGIN, y, 1.2, cardH, "F");

  // Status label + currency on the same top row
  const label = isSettled ? "ACCOUNT SETTLED" : isCredit ? "CREDIT BALANCE" : "OUTSTANDING BALANCE";
  txt(doc, INK_500);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text(`${label}  ·  ${currency}`, MARGIN + 5, y + 5.5);

  // Big balance number
  const balColor = isSettled ? INK_900 : isCredit ? POSITIVE : NEGATIVE;
  txt(doc, balColor);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(`${currency} ${fmtAmount(bal, currency)}`, MARGIN + 5, y + 13.5);

  // Plain-English explanation
  txt(doc, INK_500);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  const explain = isSettled
    ? "Fully settled."
    : isCredit
      ? "Client has credit. You owe this amount."
      : "Client owes you this amount.";
  doc.text(explain, MARGIN + 5, y + 18.5);

  // Right-side inline stats — Received / Billed stacked compactly
  const statsX = pageWidth - MARGIN - 4;

  txt(doc, INK_500);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.text("RECEIVED", statsX - 26, y + 7, { align: "left" });
  txt(doc, POSITIVE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(fmtAmount(summary.paid, currency), statsX, y + 7, { align: "right" });

  txt(doc, INK_500);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.text("BILLED", statsX - 26, y + 13, { align: "left" });
  txt(doc, NEGATIVE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(fmtAmount(summary.receivable, currency), statsX, y + 13, { align: "right" });

  return y + cardH + 4;
};

// --- TRANSACTION TABLE -------------------------------------------------------

const drawTransactionTable = (
  doc: jsPDF,
  startY: number,
  pageWidth: number,
  pageHeight: number,
  currency: "KES" | "USD",
  transactions: Transaction[],
): number => {
  let y = startY;

  if (y > pageHeight - 50) {
    doc.addPage();
    y = 18;
  }

  // Section header — small caps with tiny colored dot
  fill(doc, currency === "KES" ? TEAL : [59, 130, 246]); // teal vs blue
  doc.circle(MARGIN + 1.2, y + 1.6, 1.2, "F");
  txt(doc, INK_900);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(`${currency} transactions`, MARGIN + 5, y + 3);

  txt(doc, INK_400);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`${transactions.length} ${transactions.length === 1 ? "entry" : "entries"}`, pageWidth - MARGIN, y + 3, {
    align: "right",
  });

  y += 7;

  if (transactions.length === 0) {
    fill(doc, INK_50);
    doc.roundedRect(MARGIN, y, pageWidth - MARGIN * 2, 14, 2, 2, "F");
    txt(doc, INK_400);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.text(`No ${currency} transactions in this statement.`, pageWidth / 2, y + 9, { align: "center" });
    return y + 18;
  }

  // Oldest first → running balance flows forward naturally.
  const ordered = [...transactions].sort(
    (a, b) => new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime(),
  );

  let running = 0;
  const rows = ordered.map((t) => {
    const inAmt = t.credit || 0;
    const outAmt = t.debit || 0;
    running += inAmt - outAmt;
    return [
      fmtDate(t.transaction_date),
      t.description || "—",
      inAmt > 0 ? fmtAmount(inAmt, currency) : "",
      outAmt > 0 ? fmtAmount(outAmt, currency) : "",
      fmtSigned(running, currency),
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [["Date", "Description", "Money in", "Money out", "Balance"]],
    body: rows,
    theme: "plain",
    styles: {
      font: "helvetica",
      fontSize: 8.5,
      cellPadding: { top: 2.8, right: 3.5, bottom: 2.8, left: 3.5 },
      textColor: INK_700,
      lineColor: INK_100,
      lineWidth: 0,
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: INK_50,
      textColor: INK_500,
      fontStyle: "bold",
      fontSize: 7.5,
      cellPadding: { top: 3.5, right: 3.5, bottom: 3.5, left: 3.5 },
      lineColor: INK_200,
      lineWidth: { top: 0.3, right: 0, bottom: 0.3, left: 0 },
    },
    bodyStyles: {
      lineWidth: { top: 0, right: 0, bottom: 0.15, left: 0 },
      lineColor: INK_100,
    },
    alternateRowStyles: { fillColor: WHITE },
    columnStyles: {
      0: { cellWidth: 22, textColor: INK_500 },
      1: { cellWidth: "auto", textColor: INK_900 },
      2: { cellWidth: 24, halign: "right", textColor: POSITIVE, fontStyle: "bold" },
      3: { cellWidth: 24, halign: "right", textColor: NEGATIVE, fontStyle: "bold" },
      4: { cellWidth: 28, halign: "right", textColor: INK_900, fontStyle: "bold", fillColor: INK_50 },
    },
    margin: { left: MARGIN, right: MARGIN },
    showHead: "everyPage",
    rowPageBreak: "avoid",
    didDrawPage: () => {
      // Re-draw header on page break? autoTable already handles head repetition.
    },
  });

  const finalY = (doc as any).lastAutoTable.finalY;

  // Closing total row underneath
  fill(doc, INK_50);
  doc.rect(MARGIN, finalY, pageWidth - MARGIN * 2, 8, "F");
  txt(doc, INK_700);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text("Closing balance", MARGIN + 3.5, finalY + 5.2);

  const finalBal = running;
  txt(doc, finalBal < 0 ? NEGATIVE : finalBal > 0 ? POSITIVE : INK_900);
  doc.setFontSize(10);
  doc.text(`${currency} ${fmtSigned(finalBal, currency)}`, pageWidth - MARGIN - 3.5, finalY + 5.2, {
    align: "right",
  });

  txt(doc, INK_400);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(7.5);
  doc.text(
    "Transactions listed oldest to newest. Balance updates after each entry.",
    MARGIN,
    finalY + 13,
  );

  return finalY + 18;
};

// --- FOOTER ------------------------------------------------------------------

const drawFooter = (doc: jsPDF, client: Client, pageWidth: number, pageHeight: number) => {
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);

    // Hairline + thin teal hairline beneath
    draw(doc, INK_200);
    doc.setLineWidth(0.2);
    doc.line(MARGIN, pageHeight - 13, pageWidth - MARGIN, pageHeight - 13);

    draw(doc, TEAL);
    doc.setLineWidth(0.4);
    doc.line(MARGIN, pageHeight - 12.7, MARGIN + 18, pageHeight - 12.7);

    txt(doc, INK_400);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text(client.client_name, MARGIN, pageHeight - 8);
    doc.text(`Page ${i} of ${total}`, pageWidth / 2, pageHeight - 8, { align: "center" });
    doc.text(client.client_code, pageWidth - MARGIN, pageHeight - 8, { align: "right" });

    txt(doc, INK_300);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(6.5);
    doc.text("Questions about this statement? Reply to the sender or contact your account manager.", pageWidth / 2, pageHeight - 4, {
      align: "center",
    });
  }
};

// --- PUBLIC API --------------------------------------------------------------

export const generateClientPDFReport = (options: ReportOptions) => {
  try {
    const { client, transactionsKES, transactionsUSD, summaryKES, summaryUSD, reportType, business } = options;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    const period = computePeriod(transactionsKES, transactionsUSD);

    let y = drawHeader(doc, client, pageWidth, period, business);

    const showKES = reportType !== "usd-only";
    const showUSD = reportType !== "kes-only";

    // Hero balance card(s) — one per currency. If a currency has no activity AND no balance, skip it.
    if (showKES) {
      const hasKES = transactionsKES.length > 0 || summaryKES.balance !== 0;
      if (hasKES || (!showUSD)) {
        y = drawHeroBalance(doc, y, pageWidth, "KES", summaryKES);
      }
    }
    if (showUSD) {
      const hasUSD = transactionsUSD.length > 0 || summaryUSD.balance !== 0;
      if (hasUSD) {
        y = drawHeroBalance(doc, y, pageWidth, "USD", summaryUSD);
      }
    }

    // Spacer + soft divider between summary and transaction tables
    hairline(doc, y - 2, pageWidth);
    y += 6;

    if (reportType !== "summary") {
      if (showKES && (transactionsKES.length > 0 || !showUSD)) {
        y = drawTransactionTable(doc, y, pageWidth, pageHeight, "KES", transactionsKES);
      }
      if (showUSD && transactionsUSD.length > 0) {
        y = drawTransactionTable(doc, y, pageWidth, pageHeight, "USD", transactionsUSD);
      }
    }

    drawFooter(doc, client, pageWidth, pageHeight);

    const fileName = `Statement_${client.client_code}_${new Date().toISOString().split("T")[0]}.pdf`;
    doc.save(fileName);
  } catch (error) {
    console.error("PDF Generation Error:", error);
    throw new Error(
      `PDF generation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
};

// --- ALL-CLIENTS OVERVIEW ----------------------------------------------------

export const generateAllClientsSummaryPDF = (
  clients: Array<{
    client_name: string;
    client_code: string;
    balanceKES: number;
    balanceUSD: number;
    status: string;
  }>,
) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Top accent
  fill(doc, TEAL);
  doc.rect(0, 0, pageWidth, 3, "F");
  fill(doc, TEAL_50);
  doc.rect(0, 3, pageWidth, 26, "F");

  txt(doc, TEAL_DARK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("Ezary", MARGIN, 14);

  txt(doc, INK_500);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`${clients.length} ${clients.length === 1 ? "client" : "clients"}  ·  all currencies`, MARGIN, 19);

  txt(doc, INK_500);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("CLIENT OVERVIEW", pageWidth - MARGIN, 14, { align: "right" });

  txt(doc, INK_900);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(fmtLongDate(new Date()), pageWidth - MARGIN, 19, { align: "right" });

  // Totals hero
  const totalKES = clients.reduce((s, c) => s + c.balanceKES, 0);
  const totalUSD = clients.reduce((s, c) => s + c.balanceUSD, 0);

  let y = 38;

  const drawTotalCard = (
    x: number,
    cardW: number,
    label: string,
    amount: number,
    currency: "KES" | "USD",
  ) => {
    const cardH = 22;
    fill(doc, WHITE);
    doc.roundedRect(x, y, cardW, cardH, 2, 2, "F");
    draw(doc, INK_200);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, y, cardW, cardH, 2, 2, "S");

    const accent = amount === 0 ? INK_300 : amount > 0 ? POSITIVE : NEGATIVE;
    fill(doc, accent);
    doc.rect(x, y, 1.5, cardH, "F");

    txt(doc, INK_500);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.text(label, x + 6, y + 7);

    txt(doc, accent === INK_300 ? INK_900 : accent);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(`${currency} ${fmtSigned(amount, currency)}`, x + 6, y + 16);
  };

  const cardW = (pageWidth - MARGIN * 2 - 6) / 2;
  drawTotalCard(MARGIN, cardW, "NET KES ACROSS ALL CLIENTS", totalKES, "KES");
  drawTotalCard(MARGIN + cardW + 6, cardW, "NET USD ACROSS ALL CLIENTS", totalUSD, "USD");

  y += 28;

  hairline(doc, y, pageWidth);
  y += 5;

  // Per-client table
  const tableData = clients.map((c) => [
    c.client_code,
    c.client_name,
    fmtSigned(c.balanceKES, "KES"),
    fmtSigned(c.balanceUSD, "USD"),
    c.status.charAt(0).toUpperCase() + c.status.slice(1),
  ]);

  autoTable(doc, {
    startY: y,
    head: [["Code", "Client", "KES balance", "USD balance", "Status"]],
    body: tableData,
    theme: "plain",
    styles: {
      font: "helvetica",
      fontSize: 9,
      cellPadding: { top: 2.8, right: 3.5, bottom: 2.8, left: 3.5 },
      textColor: INK_700,
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: INK_50,
      textColor: INK_500,
      fontStyle: "bold",
      fontSize: 7.5,
      cellPadding: { top: 3.5, right: 3.5, bottom: 3.5, left: 3.5 },
      lineColor: INK_200,
      lineWidth: { top: 0.3, right: 0, bottom: 0.3, left: 0 },
    },
    bodyStyles: {
      lineWidth: { top: 0, right: 0, bottom: 0.15, left: 0 },
      lineColor: INK_100,
    },
    columnStyles: {
      0: { cellWidth: 24, textColor: INK_500, fontStyle: "bold" },
      1: { cellWidth: "auto", textColor: INK_900 },
      2: { cellWidth: 32, halign: "right", fontStyle: "bold" },
      3: { cellWidth: 32, halign: "right", fontStyle: "bold" },
      4: { cellWidth: 22, halign: "center", textColor: INK_500 },
    },
    margin: { left: MARGIN, right: MARGIN },
    showHead: "everyPage",
    rowPageBreak: "avoid",
    didParseCell: (data) => {
      if (data.section !== "body") return;
      if (data.column.index === 2 || data.column.index === 3) {
        const raw = String(data.cell.raw ?? "");
        if (raw === "0" || raw === "0.00") data.cell.styles.textColor = INK_900;
        else data.cell.styles.textColor = raw.startsWith("-") ? NEGATIVE : POSITIVE;
      }
    },
  });

  // Footer per page
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);

    draw(doc, INK_200);
    doc.setLineWidth(0.2);
    doc.line(MARGIN, pageHeight - 13, pageWidth - MARGIN, pageHeight - 13);

    draw(doc, TEAL);
    doc.setLineWidth(0.4);
    doc.line(MARGIN, pageHeight - 12.7, MARGIN + 18, pageHeight - 12.7);

    txt(doc, INK_400);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text("Client overview", MARGIN, pageHeight - 8);
    doc.text(`Page ${i} of ${total}`, pageWidth / 2, pageHeight - 8, { align: "center" });
    doc.text(fmtLongDate(new Date()), pageWidth - MARGIN, pageHeight - 8, { align: "right" });
  }

  doc.save(`All_Clients_Summary_${new Date().toISOString().split("T")[0]}.pdf`);
};

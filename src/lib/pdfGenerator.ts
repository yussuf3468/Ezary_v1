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
  highlight_color?: string | null;
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

// Palette
const TEAL: [number, number, number]     = [13, 148, 136];
const INK_900: [number, number, number]  = [15, 23, 42];
const INK_600: [number, number, number]  = [71, 85, 105];
const INK_400: [number, number, number]  = [148, 163, 184];
const INK_100: [number, number, number]  = [241, 245, 249];
const INK_50: [number, number, number]   = [248, 250, 252];
const GREEN: [number, number, number]    = [4, 120, 87];
const RED: [number, number, number]      = [185, 28, 28];

const M = 16; // page margin mm

const hexToRgb = (hex: string): [number, number, number] | null => {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return null;
  const int = parseInt(m[1], 16);
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
};

const t = (doc: jsPDF, c: [number,number,number]) => doc.setTextColor(c[0], c[1], c[2]);
const f = (doc: jsPDF, c: [number,number,number]) => doc.setFillColor(c[0], c[1], c[2]);
const d = (doc: jsPDF, c: [number,number,number]) => doc.setDrawColor(c[0], c[1], c[2]);

const rule = (doc: jsPDF, y: number, pw: number, weight = 0.3, color = INK_400) => {
  d(doc, color);
  doc.setLineWidth(weight);
  doc.line(M, y, pw - M, y);
};

const localDate = (date = new Date()) =>
  date.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

const num = (n: number, cur: "KES" | "USD") =>
  formatCurrency(Math.abs(n), cur).replace(/[^0-9.,-]/g, "");

const signed = (n: number, cur: "KES" | "USD") => (n < 0 ? "(" + num(n, cur) + ")" : num(n, cur));

const period = (kes: Transaction[], usd: Transaction[]) => {
  const ts = [...kes, ...usd]
    .map(tx => new Date(tx.transaction_date).getTime())
    .filter(n => !isNaN(n));
  if (!ts.length) return null;
  return {
    from: new Date(Math.min(...ts)),
    to:   new Date(Math.max(...ts)),
  };
};

// ─── HEADER ──────────────────────────────────────────────────────────────────

function drawPageHeader(
  doc: jsPDF,
  client: Client,
  pw: number,
  p: { from: Date; to: Date } | null,
  biz: ReportOptions["business"],
): number {
  let y = 18;

  // Business name — teal, large
  t(doc, TEAL);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(biz?.name || "Ezary", M, y);

  // Tagline under business name
  t(doc, INK_400);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("Account Statement", M, y + 5);

  // Right side — statement label + date
  t(doc, INK_400);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text("STATEMENT OF ACCOUNT", pw - M, y - 2, { align: "right" });

  t(doc, INK_900);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(localDate(), pw - M, y + 4, { align: "right" });

  if (p) {
    t(doc, INK_400);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(
      `${shortDate(p.from.toISOString())}  –  ${shortDate(p.to.toISOString())}`,
      pw - M, y + 9, { align: "right" },
    );
  }

  y += 14;
  rule(doc, y, pw, 0.6, INK_900);
  y += 8;

  // ── Client block ──
  // Label col
  t(doc, INK_400);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text("PREPARED FOR", M, y);

  // Value col
  t(doc, INK_900);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(client.client_name, M + 36, y + 0.5);

  t(doc, INK_600);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  let cy = y + 5.5;
  const meta: string[] = [`Account: ${client.client_code}`];
  if (client.business_name) meta.push(client.business_name);
  if (client.phone)         meta.push(client.phone);
  if (client.email)         meta.push(client.email);
  if (client.address)       meta.push(client.address);
  meta.forEach(line => {
    doc.text(line, M + 36, cy);
    cy += 4;
  });

  y = Math.max(y + 10, cy) + 4;
  rule(doc, y, pw);
  return y + 7;
}

// ─── SUMMARY TABLE ────────────────────────────────────────────────────────────

function drawSummary(
  doc: jsPDF,
  y: number,
  pw: number,
  ph: number,
  showKES: boolean,
  showUSD: boolean,
  sKES: ReportOptions["summaryKES"],
  sUSD: ReportOptions["summaryUSD"],
): number {
  // Keep the whole summary block together — break to a new page if it won't fit
  if (y > ph - 60) {
    doc.addPage();
    y = 18;
  }

  // Section label
  t(doc, INK_400);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text("ACCOUNT SUMMARY", M, y);
  y += 4;

  // Build columns dynamically
  const head: string[][] = [[""]];
  if (showKES) head[0].push("KES");
  if (showUSD) head[0].push("USD");

  const buildRow = (
    label: string,
    kesVal: number,
    usdVal: number,
    isBal = false,
  ): string[] => {
    const row: string[] = [label];
    if (showKES) {
      const v = isBal ? signed(kesVal, "KES") : num(kesVal, "KES");
      row.push(v);
    }
    if (showUSD) {
      const v = isBal ? signed(usdVal, "USD") : num(usdVal, "USD");
      row.push(v);
    }
    return row;
  };

  const body = [
    buildRow("Money received", sKES.paid,       sUSD.paid),
    buildRow("Money billed",   sKES.receivable,  sUSD.receivable),
    buildRow("Balance",        sKES.balance,     sUSD.balance, true),
  ];

  // Col count determines widths
  const cols = 1 + (showKES ? 1 : 0) + (showUSD ? 1 : 0);
  const numColW = 36;
  const labelColW = pw - M * 2 - numColW * (cols - 1);

  const colStyles: Record<number, object> = {
    0: { cellWidth: labelColW, textColor: INK_600 },
  };
  for (let i = 1; i < cols; i++) {
    colStyles[i] = { cellWidth: numColW, halign: "right", fontStyle: "bold", textColor: INK_900 };
  }

  autoTable(doc, {
    startY: y,
    head,
    body,
    theme: "plain",
    styles: {
      font: "helvetica",
      fontSize: 9,
      cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 },
      lineColor: INK_100,
      lineWidth: 0,
    },
    headStyles: {
      fillColor: INK_50,
      textColor: INK_400,
      fontStyle: "bold",
      fontSize: 7.5,
      cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 },
      lineWidth: { top: 0.3, bottom: 0.3, left: 0, right: 0 },
      lineColor: INK_100,
    },
    bodyStyles: {
      lineWidth: { top: 0, bottom: 0.2, left: 0, right: 0 },
      lineColor: INK_100,
    },
    columnStyles: colStyles,
    margin: { left: M, right: M },
    didParseCell(data) {
      if (data.section !== "body") return;
      const row = data.row.index;
      const col = data.column.index;
      // Balance row — color by sign and make bigger
      if (row === 2) {
        data.cell.styles.fontSize = 10;
        data.cell.styles.fontStyle = "bold";
        if (col > 0) {
          const bal = col === 1 && showKES ? sKES.balance : sUSD.balance;
          data.cell.styles.textColor = bal === 0 ? INK_900 : bal > 0 ? GREEN : RED;
        } else {
          data.cell.styles.textColor = INK_900;
        }
      }
      // Received row — green numbers
      if (row === 0 && col > 0) data.cell.styles.textColor = GREEN;
      // Billed row — red numbers
      if (row === 1 && col > 0) data.cell.styles.textColor = RED;
    },
  });

  const afterY = (doc as any).lastAutoTable.finalY;

  // Balance status line
  const balKES = sKES.balance;
  const balUSD = sUSD.balance;
  const allSettled =
    (!showKES || balKES === 0) && (!showUSD || balUSD === 0);
  const anyNeg =
    (showKES && balKES < 0) || (showUSD && balUSD < 0);

  t(doc, anyNeg ? RED : allSettled ? INK_400 : GREEN);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  const statusText = allSettled
    ? "Account fully settled — no balance outstanding."
    : anyNeg
      ? "Outstanding balance — payment required."
      : "Client has credit — no payment needed.";
  doc.text(statusText, M + 3, afterY + 5);

  rule(doc, afterY + 9, pw);
  return afterY + 15;
}

// ─── TRANSACTION TABLE ────────────────────────────────────────────────────────

function drawLedger(
  doc: jsPDF,
  y: number,
  pw: number,
  ph: number,
  currency: "KES" | "USD",
  txns: Transaction[],
): number {
  if (y > ph - 55) { doc.addPage(); y = 18; }

  // Section heading
  t(doc, INK_900);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(`${currency} Transactions`, M, y);

  t(doc, INK_400);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(
    txns.length === 0 ? "No entries" : `${txns.length} ${txns.length === 1 ? "entry" : "entries"}`,
    pw - M, y, { align: "right" },
  );

  y += 5;
  rule(doc, y, pw, 0.2, INK_400);
  y += 3;

  if (txns.length === 0) {
    t(doc, INK_400);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.text(`No ${currency} transactions recorded.`, M, y + 6);
    return y + 16;
  }

  // Sort oldest → newest so balance grows forward
  const rows = [...txns]
    .sort((a, b) => new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime());

  let running = 0;
  const tableRows = rows.map(tx => {
    const inAmt  = tx.credit || 0;
    const outAmt = tx.debit  || 0;
    running += inAmt - outAmt;
    return [
      shortDate(tx.transaction_date),
      tx.description || "—",
      inAmt  > 0 ? num(inAmt,  currency) : "",
      outAmt > 0 ? num(outAmt, currency) : "",
      signed(running, currency),
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [["Date", "Description", "Money In", "Money Out", "Balance"]],
    body: tableRows,
    theme: "plain",
    styles: {
      font: "helvetica",
      fontSize: 8.5,
      cellPadding: { top: 2.8, bottom: 2.8, left: 3, right: 3 },
      textColor: INK_600,
      lineColor: INK_100,
      lineWidth: 0,
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: INK_50,
      textColor: INK_400,
      fontStyle: "bold",
      fontSize: 7.5,
      cellPadding: { top: 3, bottom: 3, left: 3, right: 3 },
      lineWidth: { top: 0.3, bottom: 0.3, left: 0, right: 0 },
      lineColor: INK_100,
    },
    bodyStyles: {
      lineWidth: { top: 0, bottom: 0.15, left: 0, right: 0 },
      lineColor: INK_100,
    },
    alternateRowStyles: { fillColor: INK_50 },
    columnStyles: {
      0: { cellWidth: 23,        textColor: INK_400 },
      1: { cellWidth: "auto",    textColor: INK_900 },
      2: { cellWidth: 26, halign: "right", fontStyle: "bold", textColor: GREEN },
      3: { cellWidth: 26, halign: "right", fontStyle: "bold", textColor: RED },
      4: { cellWidth: 30, halign: "right", fontStyle: "bold", textColor: INK_900 },
    },
    margin: { left: M, right: M },
    showHead: "everyPage",
    rowPageBreak: "avoid",
    didParseCell(data) {
      if (data.section !== "body") return;
      // Excel-style row fill — overrides zebra striping for flagged rows
      const hl = rows[data.row.index]?.highlight_color;
      if (hl) {
        const rgb = hexToRgb(hl);
        if (rgb) data.cell.styles.fillColor = rgb;
      }
      // Make balance column slightly tinted when negative
      if (data.column.index === 4) {
        const val = String(data.cell.raw ?? "");
        if (val.startsWith("(")) data.cell.styles.textColor = RED;
      }
    },
  });

  const endY = (doc as any).lastAutoTable.finalY;

  // Closing balance bar
  f(doc, INK_50);
  doc.rect(M, endY, pw - M * 2, 8, "F");
  t(doc, INK_600);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("Closing balance", M + 3, endY + 5.2);
  t(doc, running < 0 ? RED : running > 0 ? GREEN : INK_900);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.text(signed(running, currency), pw - M - 3, endY + 5.2, { align: "right" });

  return endY + 14;
}

// ─── FOOTER (every page) ─────────────────────────────────────────────────────

function drawFooters(doc: jsPDF, client: Client, pw: number, ph: number) {
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    rule(doc, ph - 14, pw, 0.3, INK_400);
    t(doc, INK_400);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(client.client_name, M, ph - 9);
    doc.text(`Page ${i} of ${total}`, pw / 2, ph - 9, { align: "center" });
    doc.text(client.client_code, pw - M, ph - 9, { align: "right" });
  }
}

// ─── PUBLIC API ───────────────────────────────────────────────────────────────

export const generateClientPDFReport = async (options: ReportOptions) => {
  const { client, transactionsKES, transactionsUSD, summaryKES, summaryUSD, reportType, business } = options;

  const doc = new jsPDF();
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();

  const p = period(transactionsKES, transactionsUSD);
  let y = drawPageHeader(doc, client, pw, p, business);

  const showKES = reportType !== "usd-only";
  const showUSD = reportType !== "kes-only";

  // Transaction ledgers first…
  if (reportType !== "summary") {
    if (showKES) y = drawLedger(doc, y, pw, ph, "KES", transactionsKES);
    if (showUSD) y = drawLedger(doc, y, pw, ph, "USD", transactionsUSD);
  }

  // …then the account summary as a closing block at the bottom
  y = drawSummary(doc, y, pw, ph, showKES, showUSD, summaryKES, summaryUSD);

  drawFooters(doc, client, pw, ph);

  // Name the file after the client so downloads and the mobile share sheet
  // show a real name instead of "blob".
  const safeName =
    (client.client_name || client.client_code || "Statement")
      .replace(/[^\w\s-]+/g, "")
      .trim()
      .replace(/\s+/g, "_") || "Statement";
  const fileName = `${safeName}_Statement_${new Date().toLocaleDateString("en-CA")}.pdf`;

  // On mobile, share an actual named File so the recipient gets the client name.
  const nav = typeof navigator !== "undefined" ? navigator : undefined;
  const isMobile =
    !!nav &&
    (/Android|iPhone|iPad|iPod/i.test(nav.userAgent) ||
      (nav.maxTouchPoints ?? 0) > 1);

  if (isMobile && nav?.canShare) {
    try {
      const file = new File([doc.output("blob")], fileName, {
        type: "application/pdf",
      });
      if (nav.canShare({ files: [file] })) {
        await nav.share({
          files: [file],
          title: fileName,
          text: `Statement for ${client.client_name}`,
        });
        return;
      }
    } catch (err: any) {
      if (err?.name === "AbortError") return; // user dismissed the share sheet
      // any other failure → fall through to a normal download
    }
  }

  doc.save(fileName);
};

// ─── ALL-CLIENTS OVERVIEW ─────────────────────────────────────────────────────

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
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();

  let y = 18;

  // Header
  t(doc, TEAL);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Ezary", M, y);

  t(doc, INK_400);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("Client Overview Report", M, y + 5);

  t(doc, INK_400);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text("ALL CLIENTS", pw - M, y - 2, { align: "right" });

  t(doc, INK_900);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(localDate(), pw - M, y + 4, { align: "right" });

  t(doc, INK_400);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`${clients.length} clients`, pw - M, y + 9, { align: "right" });

  y += 14;
  rule(doc, y, pw, 0.6, INK_900);
  y += 8;

  // Net totals
  const netKES = clients.reduce((s, c) => s + c.balanceKES, 0);
  const netUSD = clients.reduce((s, c) => s + c.balanceUSD, 0);

  t(doc, INK_400);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text("NET BALANCE — ALL CLIENTS", M, y);
  y += 5;

  // KES total
  t(doc, INK_600);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("KES", M, y);
  t(doc, netKES < 0 ? RED : netKES > 0 ? GREEN : INK_900);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(signed(netKES, "KES"), M + 16, y + 0.5);

  // USD total (right half)
  const midX = pw / 2;
  t(doc, INK_600);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("USD", midX, y);
  t(doc, netUSD < 0 ? RED : netUSD > 0 ? GREEN : INK_900);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(signed(netUSD, "USD"), midX + 16, y + 0.5);

  y += 8;
  rule(doc, y, pw);
  y += 6;

  // Per-client table
  const tableData = clients.map(c => [
    c.client_code,
    c.client_name,
    signed(c.balanceKES, "KES"),
    signed(c.balanceUSD, "USD"),
    c.status.charAt(0).toUpperCase() + c.status.slice(1),
  ]);

  autoTable(doc, {
    startY: y,
    head: [["Code", "Client Name", "KES Balance", "USD Balance", "Status"]],
    body: tableData,
    theme: "plain",
    styles: {
      font: "helvetica",
      fontSize: 9,
      cellPadding: { top: 2.8, bottom: 2.8, left: 3, right: 3 },
      textColor: INK_600,
      lineColor: INK_100,
      lineWidth: 0,
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: INK_50,
      textColor: INK_400,
      fontStyle: "bold",
      fontSize: 7.5,
      cellPadding: { top: 3, bottom: 3, left: 3, right: 3 },
      lineWidth: { top: 0.3, bottom: 0.3, left: 0, right: 0 },
      lineColor: INK_100,
    },
    bodyStyles: {
      lineWidth: { top: 0, bottom: 0.15, left: 0, right: 0 },
      lineColor: INK_100,
    },
    alternateRowStyles: { fillColor: INK_50 },
    columnStyles: {
      0: { cellWidth: 24, fontStyle: "bold", textColor: INK_400 },
      1: { cellWidth: "auto", textColor: INK_900 },
      2: { cellWidth: 32, halign: "right", fontStyle: "bold" },
      3: { cellWidth: 32, halign: "right", fontStyle: "bold" },
      4: { cellWidth: 22, halign: "center", textColor: INK_400 },
    },
    margin: { left: M, right: M },
    showHead: "everyPage",
    rowPageBreak: "avoid",
    didParseCell(data) {
      if (data.section !== "body") return;
      if (data.column.index === 2 || data.column.index === 3) {
        const v = String(data.cell.raw ?? "");
        data.cell.styles.textColor = v.startsWith("(") ? RED : v === "0.00" ? INK_900 : GREEN;
      }
    },
  });

  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    rule(doc, ph - 14, pw, 0.3, INK_400);
    t(doc, INK_400);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text("Client Overview", M, ph - 9);
    doc.text(`Page ${i} of ${total}`, pw / 2, ph - 9, { align: "center" });
    doc.text(localDate(), pw - M, ph - 9, { align: "right" });
  }

  doc.save(`All_Clients_Summary_${new Date().toLocaleDateString("en-CA")}.pdf`);
};

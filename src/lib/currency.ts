// Currency formatting utility for KES
export const formatCurrency = (amount: number | string): string => {
  const numAmount = typeof amount === "string" ? parseFloat(amount) : amount;

  if (isNaN(numAmount)) return "KES 0.00";

  return `KES ${numAmount.toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

// Parse currency input (remove commas and convert to number)
export const parseCurrency = (value: string): number => {
  return parseFloat(value.replace(/,/g, "")) || 0;
};

// Format number input with commas as user types
export const formatNumberInput = (value: string): string => {
  // Remove non-numeric characters except decimal point
  const cleaned = value.replace(/[^\d.]/g, "");

  // Split into integer and decimal parts
  const parts = cleaned.split(".");

  // Format integer part with commas
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  // Limit decimal places to 2
  if (parts[1]) {
    parts[1] = parts[1].slice(0, 2);
  }

  return parts.join(".");
};

// Compact number format for charts/cards (e.g., 1.2M, 45K)
export const formatCompact = (amount: number): string => {
  if (amount >= 1000000) {
    return `KES ${(amount / 1000000).toFixed(1)}M`;
  } else if (amount >= 1000) {
    return `KES ${(amount / 1000).toFixed(1)}K`;
  }
  return formatCurrency(amount);
};

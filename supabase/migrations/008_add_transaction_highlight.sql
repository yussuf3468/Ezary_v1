-- Add highlight_color to transaction tables
-- Lets users color-fill ledger rows (Excel-style) for emphasis.
-- Stores a hex string (e.g. '#FEF3C7') or NULL for no fill.

ALTER TABLE client_transactions_kes
  ADD COLUMN IF NOT EXISTS highlight_color TEXT;

ALTER TABLE client_transactions_usd
  ADD COLUMN IF NOT EXISTS highlight_color TEXT;

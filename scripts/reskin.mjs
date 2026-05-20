// One-shot codemod to align Debts.tsx and Reports.tsx with the new design system.
// Run with: node scripts/reskin.mjs
// Safe to delete after migration.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const FILES = [
  "src/components/Debts.tsx",
  "src/components/Reports.tsx",
];

const REPLACEMENTS = [
  // Gradients → solid tokens
  [/bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600/g, "bg-brand-600"],
  [/bg-gradient-to-r from-emerald-600 to-teal-600/g, "bg-brand-600"],
  [/bg-gradient-to-br from-emerald-500 to-teal-600/g, "bg-brand-600"],
  [/bg-gradient-to-br from-emerald-500 via-teal-500 to-emerald-600/g, "bg-brand-600"],
  [/bg-gradient-to-r from-emerald-500 to-teal-600/g, "bg-brand-600"],
  [/bg-gradient-to-r from-emerald-500 via-teal-600 to-emerald-500/g, "bg-brand-600"],
  [/bg-gradient-to-br from-emerald-500 via-teal-600 to-green-700/g, "bg-brand-600"],
  [/bg-gradient-to-br from-emerald-500\/20 to-teal-500\/20/g, "bg-brand-50"],
  [/bg-gradient-to-r from-red-600 to-red-700/g, "bg-negative-600"],
  [/bg-gradient-to-br from-red-500 via-red-600 to-rose-700/g, "bg-negative-600"],
  [/bg-gradient-to-br from-red-500 to-rose-600/g, "bg-negative-600"],
  [/bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600/g, "bg-info-600"],
  [/bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600/g, "bg-info-600"],
  [/bg-gradient-to-br from-blue-500 via-indigo-600 to-blue-700/g, "bg-info-600"],
  [/bg-gradient-to-br from-blue-500 to-cyan-600/g, "bg-info-600"],
  [/bg-gradient-to-br from-purple-500 via-pink-500 to-pink-600/g, "bg-info-600"],
  [/bg-gradient-to-r from-amber-600 via-orange-600 to-amber-600/g, "bg-warning-600"],
  [/bg-gradient-to-br from-orange-500 via-amber-600 to-orange-700/g, "bg-warning-600"],
  [/bg-gradient-to-br from-amber-500 via-orange-500 to-orange-600/g, "bg-warning-600"],
  [/bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent/g, "text-ink-900"],
  [/bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 bg-clip-text text-transparent/g, "text-ink-900"],

  // Typographic restraint
  [/\bfont-black\b/g, "font-semibold"],
  [/\bfont-extrabold\b/g, "font-semibold"],

  // Motion restraint
  [/ hover:scale-105/g, ""],
  [/ hover:scale-110/g, ""],
  [/ drop-shadow-lg/g, ""],

  // Borders: 2px → 1px and gray → ink
  [/border-2 border-gray-200/g, "border border-ink-200"],
  [/border-2 border-gray-100/g, "border border-ink-100"],
  [/border-2 border-gray-300/g, "border border-ink-300"],
  [/border-2 border-emerald-500/g, "border border-brand-500"],
  [/border-2 border-emerald-400/g, "border border-brand-400"],
  [/border-2 border-red-500/g, "border border-negative-500"],
  [/border-2 border-red-200/g, "border border-negative-100"],
  [/border-2 border-blue-200/g, "border border-info-100"],
  [/border-2 border-blue-500/g, "border border-info-500"],
  [/border-2 border-amber-200/g, "border border-warning-100"],

  // Radii / shadows / blur
  [/\brounded-3xl\b/g, "rounded-2xl"],
  [/\bshadow-2xl\b/g, "shadow-lg"],
  [/\bbackdrop-blur-xl\b/g, "backdrop-blur-md"],
  [/bg-white\/9\d backdrop-blur-md/g, "bg-white"],
  [/bg-white\/80 backdrop-blur-md/g, "bg-white"],
  [/bg-white\/60 backdrop-blur-md/g, "bg-white"],

  // Stragglers found after first pass
  [/bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-600/g, "bg-brand-600"],
  [/bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 text-white shadow-lg shadow-emerald-300\/50 scale-105/g, "bg-ink-900 text-white"],
  [/bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50/g, "bg-brand-50"],

  // Color scale: gray → ink
  [/\btext-gray-900\b/g, "text-ink-900"],
  [/\btext-gray-800\b/g, "text-ink-800"],
  [/\btext-gray-700\b/g, "text-ink-700"],
  [/\btext-gray-600\b/g, "text-ink-600"],
  [/\btext-gray-500\b/g, "text-ink-500"],
  [/\btext-gray-400\b/g, "text-ink-400"],
  [/\btext-gray-300\b/g, "text-ink-300"],
  [/placeholder-gray-500/g, "placeholder-ink-400"],
  [/placeholder:text-gray-500/g, "placeholder:text-ink-400"],
  [/placeholder:text-gray-600/g, "placeholder:text-ink-400"],
  [/\bbg-gray-50\b/g, "bg-ink-50"],
  [/\bbg-gray-100\b/g, "bg-ink-100"],
  [/\bbg-gray-200\b/g, "bg-ink-200"],
  [/\bborder-gray-100\b/g, "border-ink-100"],
  [/\bborder-gray-200\b/g, "border-ink-200"],
  [/\bborder-gray-300\b/g, "border-ink-300"],
  [/hover:bg-gray-50/g, "hover:bg-ink-50"],
  [/hover:bg-gray-100/g, "hover:bg-ink-100"],
  [/hover:bg-gray-200/g, "hover:bg-ink-100"],
  [/hover:border-gray-300/g, "hover:border-ink-300"],

  // Focus rings → brand
  [/focus:ring-emerald-500\b/g, "focus:ring-brand-500"],
  [/focus:border-emerald-500\b/g, "focus:border-brand-500"],
  [/focus:ring-emerald-500\/20/g, "focus:ring-brand-500/20"],
  [/focus:ring-4 focus:ring-brand-500\/20/g, "focus:ring-2 focus:ring-brand-500/30"],

  // Emerald → brand
  [/\btext-emerald-600\b/g, "text-brand-700"],
  [/\btext-emerald-700\b/g, "text-brand-700"],
  [/\btext-emerald-500\b/g, "text-brand-600"],
  [/\bbg-emerald-50\b/g, "bg-brand-50"],
  [/\bbg-emerald-100\b/g, "bg-brand-100"],
  [/\bbg-emerald-600\b/g, "bg-brand-600"],
  [/hover:bg-emerald-700/g, "hover:bg-brand-700"],
  [/hover:bg-emerald-50/g, "hover:bg-brand-50"],
  [/\bborder-emerald-200\b/g, "border-brand-100"],
  [/\bborder-emerald-500\b/g, "border-brand-500"],
  [/\bborder-emerald-300\b/g, "border-brand-200"],

  // Red → negative for semantic consistency
  [/\btext-red-700\b/g, "text-negative-700"],
  [/\btext-red-600\b/g, "text-negative-600"],
  [/\btext-red-500\b/g, "text-negative-500"],
  [/\bbg-red-50\b/g, "bg-negative-50"],
  [/\bbg-red-100\b/g, "bg-negative-100"],
  [/\bbg-red-600\b/g, "bg-negative-600"],
  [/\bborder-red-100\b/g, "border-negative-100"],
  [/\bborder-red-200\b/g, "border-negative-100"],
  [/\bborder-red-300\b/g, "border-negative-200"],
  [/hover:bg-red-50/g, "hover:bg-negative-50"],
  [/hover:bg-red-700/g, "hover:bg-negative-700"],

  // Amber → warning
  [/\btext-amber-700\b/g, "text-warning-600"],
  [/\btext-amber-600\b/g, "text-warning-600"],
  [/\btext-amber-500\b/g, "text-warning-500"],
  [/\btext-amber-400\b/g, "text-warning-500"],
  [/\bbg-amber-50\b/g, "bg-warning-50"],
  [/\bbg-amber-100\b/g, "bg-warning-100"],
  [/\bborder-amber-200\b/g, "border-warning-100"],

  // Blue → info
  [/\btext-blue-700\b/g, "text-info-600"],
  [/\btext-blue-600\b/g, "text-info-600"],
  [/\btext-blue-500\b/g, "text-info-500"],
  [/\btext-blue-400\b/g, "text-info-500"],
  [/\bbg-blue-50\b/g, "bg-info-50"],
  [/\bbg-blue-100\b/g, "bg-info-100"],
  [/\bborder-blue-100\b/g, "border-info-100"],
  [/\bborder-blue-200\b/g, "border-info-100"],
  [/hover:bg-blue-50/g, "hover:bg-info-50"],
];

let total = 0;
for (const rel of FILES) {
  const p = resolve(process.cwd(), rel);
  let src = readFileSync(p, "utf8");
  const before = src.length;
  let count = 0;
  for (const [pattern, replacement] of REPLACEMENTS) {
    src = src.replace(pattern, (m) => {
      count++;
      return replacement;
    });
  }
  writeFileSync(p, src, "utf8");
  console.log(`${rel}: ${count} replacements (${before} → ${src.length} bytes)`);
  total += count;
}
console.log(`Done. ${total} total replacements.`);

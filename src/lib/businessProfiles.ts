// Per-account branding for generated statements.
// The statement header (business name, and optional phone/email) is chosen by
// the email of the currently logged-in user. Add new accounts to the map below.

export interface BusinessProfile {
  name: string;
  phone?: string;
  email?: string;
}

// Keys MUST be lowercase — lookups are normalised to lowercase.
const PROFILES: Record<string, BusinessProfile> = {
  "cdinix14@gmail.com": { name: "DINIX GENERAL TRADING" },
};

// Fallback used for any account without a specific profile.
export const DEFAULT_BUSINESS: BusinessProfile = { name: "Ezary" };

export function getBusinessProfile(
  email?: string | null,
): BusinessProfile {
  if (!email) return DEFAULT_BUSINESS;
  return PROFILES[email.trim().toLowerCase()] ?? DEFAULT_BUSINESS;
}

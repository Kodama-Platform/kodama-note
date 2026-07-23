/** Pre-KSP pages used a server edit_token — compatibility for legacy places only. */
const LEGACY_EDIT_KEY = (slug: string) => `kodama-edit-${slug}`;

export function readLegacyEditToken(slug: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(LEGACY_EDIT_KEY(slug));
  } catch {
    return null;
  }
}

/** Remove the legacy edit token after a successful migrate to KSP. */
export function clearLegacyEditToken(slug: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(LEGACY_EDIT_KEY(slug));
  } catch {
    /* ignore quota / private mode */
  }
}

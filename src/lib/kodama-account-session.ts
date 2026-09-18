/** Kodama ecosystem account session (billing). Not the note password. */

const STORAGE_KEY = "kodama-account-session";

export function kodamaAccountTokenFromEnv(): string | undefined {
  const raw = (import.meta.env.VITE_KODAMA_ACCOUNT_TOKEN as string | undefined)?.trim();
  return raw || undefined;
}

export function getKodamaAccountToken(): string | null {
  const fromEnv = kodamaAccountTokenFromEnv();
  if (fromEnv) return fromEnv;
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY)?.trim();
    return raw || null;
  } catch {
    return null;
  }
}

export function setKodamaAccountToken(token: string | null): void {
  if (typeof localStorage === "undefined") return;
  try {
    if (!token?.trim()) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    localStorage.setItem(STORAGE_KEY, token.trim());
  } catch {
    /* ignore */
  }
}

export function hasKodamaAccountSession(): boolean {
  return !!getKodamaAccountToken();
}

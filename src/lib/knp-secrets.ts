/**
 * Client-side KNP capability material — never sent to the backend.
 * Stored in sessionStorage only. `persist` writes a reader-only copy to
 * localStorage when the user explicitly chooses “remember this device”.
 */
export type KnpSecrets = {
  /** Compact reader capability JSON (base64url of UTF-8 JSON). */
  readerCapability: string;
  /** Compact editor capability JSON, or empty. */
  editorCapability: string;
  /** True when unlocked with password (owner). */
  isOwner: boolean;
};

const SESSION_KEY = (slug: string) => `kodama-knp-${slug}`;
const PERSIST_KEY = (slug: string) => `kodama-knp-persist-${slug}`;

function readStorage(kind: Storage, key: string): KnpSecrets | null {
  try {
    const raw = kind.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<KnpSecrets>;
    if (typeof parsed.readerCapability !== "string") return null;
    return {
      readerCapability: parsed.readerCapability,
      editorCapability: typeof parsed.editorCapability === "string" ? parsed.editorCapability : "",
      isOwner: !!parsed.isOwner,
    };
  } catch {
    return null;
  }
}

export function readKnpSecrets(slug: string): KnpSecrets | null {
  if (typeof window === "undefined") return null;
  return (
    readStorage(sessionStorage, SESSION_KEY(slug)) ??
    readStorage(localStorage, PERSIST_KEY(slug)) ??
    null
  );
}

export function writeKnpSecrets(slug: string, secrets: KnpSecrets, opts?: { persist?: boolean }): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(SESSION_KEY(slug), JSON.stringify(secrets));
    if (opts?.persist) {
      localStorage.setItem(
        PERSIST_KEY(slug),
        JSON.stringify({
          readerCapability: secrets.readerCapability,
          editorCapability: "",
          isOwner: false,
        }),
      );
    }
  } catch {
    /* ignore */
  }
}

export function clearKnpSecrets(slug: string): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(SESSION_KEY(slug));
    localStorage.removeItem(PERSIST_KEY(slug));
  } catch {
    /* ignore */
  }
}

export function hasKnpEditorSecrets(slug: string): boolean {
  const s = readKnpSecrets(slug);
  return !!s?.editorCapability || !!s?.isOwner;
}

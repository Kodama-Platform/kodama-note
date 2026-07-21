import { LEGACY_EDITOR_SENTINEL } from "@/lib/ksp-fragment";

/** Client-side KSP capability material — never sent to the backend. */
export type KspSecrets = {
  readerCapability: string;
  editorPrivateKey: string;
  ownerPrivateKey: string;
};

const SESSION_KEY = (slug: string) => `kodama-ksp-${slug}`;
const PERSIST_KEY = (slug: string) => `kodama-ksp-persist-${slug}`;

function readStorage(kind: Storage, key: string): KspSecrets | null {
  try {
    const raw = kind.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<KspSecrets>;
    if (typeof parsed.readerCapability !== "string" || parsed.readerCapability.length === 0) {
      return null;
    }
    return {
      readerCapability: parsed.readerCapability,
      editorPrivateKey: typeof parsed.editorPrivateKey === "string" ? parsed.editorPrivateKey : "",
      ownerPrivateKey: typeof parsed.ownerPrivateKey === "string" ? parsed.ownerPrivateKey : "",
    };
  } catch {
    return null;
  }
}

/** Prefer sessionStorage (tab-scoped); fall back to persisted localStorage. */
export function readKspSecrets(slug: string): KspSecrets | null {
  if (typeof window === "undefined") return null;
  return (
    readStorage(sessionStorage, SESSION_KEY(slug)) ??
    readStorage(localStorage, PERSIST_KEY(slug)) ??
    readStorage(localStorage, SESSION_KEY(slug))
  );
}

/** Write editor/owner keys to sessionStorage; optionally persist reader capability. */
export function writeKspSecrets(slug: string, secrets: KspSecrets, opts?: { persist?: boolean }): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(SESSION_KEY(slug), JSON.stringify(secrets));
    if (opts?.persist) {
      localStorage.setItem(
        PERSIST_KEY(slug),
        JSON.stringify({
          readerCapability: secrets.readerCapability,
          editorPrivateKey: "",
          ownerPrivateKey: "",
        }),
      );
    }
  } catch {
    /* ignore quota / private mode */
  }
}

export function clearKspSecrets(slug: string): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(SESSION_KEY(slug));
    localStorage.removeItem(PERSIST_KEY(slug));
    localStorage.removeItem(SESSION_KEY(slug));
  } catch {
    /* ignore */
  }
}

export function hasKspEditorSecrets(slug: string): boolean {
  const s = readKspSecrets(slug);
  return !!s?.editorPrivateKey && s.editorPrivateKey !== LEGACY_EDITOR_SENTINEL;
}

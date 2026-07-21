export function getHashParams(): URLSearchParams {
  if (typeof window === "undefined") return new URLSearchParams();
  return new URLSearchParams(window.location.hash.replace(/^#/, ""));
}

export function getSheetIdFromHash(): string | null {
  const id = getHashParams().get("sheet");
  return id && id.length > 0 ? id : null;
}

/** Update `#sheet=` while preserving other hash params (e.g. `#read=`). */
export function setSheetHash(sheetId: string) {
  if (typeof window === "undefined") return;
  const params = getHashParams();
  params.set("sheet", sheetId);
  const hash = params.toString();
  const url = window.location.pathname + window.location.search + (hash ? `#${hash}` : "");
  history.replaceState(null, "", url);
}

export function stripCodeFromUrl() {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (!url.searchParams.has("code")) return;
  url.searchParams.delete("code");
  history.replaceState(null, "", url.pathname + url.search + url.hash);
}

/** Remove sensitive hash params after they are consumed (edit/read/code tokens). */
export function stripSensitiveHashParams(...keys: string[]) {
  if (typeof window === "undefined") return;
  const params = getHashParams();
  let changed = false;
  for (const key of keys) {
    if (params.has(key)) {
      params.delete(key);
      changed = true;
    }
  }
  if (!changed) return;
  const hash = params.toString();
  const url = window.location.pathname + window.location.search + (hash ? `#${hash}` : "");
  history.replaceState(null, "", url);
}

/** Prefer `#code=` fragment over legacy `?code=` query param. */
export function readUnlockCode(searchCode?: string): string | undefined {
  const fromHash = getHashParams().get("code");
  if (fromHash) return fromHash;
  return searchCode;
}

/** Move legacy `?code=` to `#code=` so the password is not sent to the server. */
export function migrateCodeToHash(searchCode?: string) {
  if (typeof window === "undefined" || !searchCode) return;
  const params = getHashParams();
  if (params.get("code")) {
    stripCodeFromUrl();
    return;
  }
  params.set("code", searchCode);
  const url = new URL(window.location.href);
  url.searchParams.delete("code");
  const hash = params.toString();
  history.replaceState(null, "", url.pathname + url.search + (hash ? `#${hash}` : ""));
}

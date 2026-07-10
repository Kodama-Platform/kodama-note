export function getHashParams(): URLSearchParams {
  if (typeof window === "undefined") return new URLSearchParams();
  return new URLSearchParams(window.location.hash.replace(/^#/, ""));
}

export function getSheetIdFromHash(): string | null {
  const id = getHashParams().get("sheet");
  return id && id.length > 0 ? id : null;
}

/** Update `#sheet=` while preserving other hash params (e.g. `edit=`). */
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

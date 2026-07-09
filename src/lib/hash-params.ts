export function getHashParams(): URLSearchParams {
  if (typeof window === "undefined") return new URLSearchParams();
  return new URLSearchParams(window.location.hash.replace(/^#/, ""));
}

export function stripCodeFromUrl() {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (!url.searchParams.has("code")) return;
  url.searchParams.delete("code");
  history.replaceState(null, "", url.pathname + url.search + url.hash);
}

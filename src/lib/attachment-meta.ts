/** KSP place version pinned at upload time — stored in the attachment `mime` field. */
const VERSION_PARAM = "ksp-place-version=";

export function mimeWithPlaceVersion(mime: string, version: number): string {
  const base = stripPlaceVersion(mime);
  return `${base}; ${VERSION_PARAM}${version}`;
}

export function stripPlaceVersion(mime: string): string {
  return mime.replace(/;\s*ksp-place-version=\d+/g, "").trim();
}

export function placeVersionFromMime(mime: string): number | null {
  const match = mime.match(/ksp-place-version=(\d+)/);
  return match ? Number.parseInt(match[1]!, 10) : null;
}

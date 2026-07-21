export function getFragmentCapability(name: string): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const v = params.get(name);
  return v && v.length > 0 ? v : null;
}

/** Marker in `#editor=` for pre-KSP places that share the symmetric read key for edit access. */
export const LEGACY_EDITOR_SENTINEL = "legacy";

export function isLegacyEditorFragment(value: string | null): boolean {
  return value === LEGACY_EDITOR_SENTINEL;
}

/** KSP read-only share link — `#read=` capability never reaches the server. */
export function buildReadOnlyUrl(url: string, readerCapability: string): string {
  const target = new URL(url);
  target.hash = new URLSearchParams({ read: readerCapability }).toString();
  return target.toString();
}

/** KSP editor share link — includes read + editor fragments for decrypt and edit. */
export function buildEditorShareUrl(
  url: string,
  readerCapability: string,
  editorPrivateKey: string,
): string {
  const target = new URL(url);
  target.hash = new URLSearchParams({
    read: readerCapability,
    editor: editorPrivateKey,
  }).toString();
  return target.toString();
}

/**
 * KSP §2: editor private keys are distributed out-of-band (not in URLs).
 * Returns a portable capability object for clipboard / secure channel sharing.
 */
export function buildEditorCapabilityExport(args: {
  slug: string;
  readerCapability: string;
  editorPrivateKey: string;
}): string {
  return JSON.stringify(
    {
      protocol: "ksp-v1",
      slug: args.slug,
      read: args.readerCapability,
      editor: args.editorPrivateKey,
    },
    null,
    2,
  );
}

export function parseEditorCapabilityImport(raw: string): {
  read: string;
  editor: string;
} | null {
  try {
    const parsed = JSON.parse(raw) as { read?: string; editor?: string; protocol?: string };
    if (
      parsed.protocol === "ksp-v1" &&
      typeof parsed.read === "string" &&
      typeof parsed.editor === "string" &&
      parsed.read.length > 0 &&
      parsed.editor.length > 0
    ) {
      return { read: parsed.read, editor: parsed.editor };
    }
    return null;
  } catch {
    return null;
  }
}

/** Import editor capability from `#editor=` + `#read=` fragments (client-only, stripped after use). */
export function editorSecretsFromFragment(): { readerCapability: string; editorPrivateKey: string } | null {
  const editor = getFragmentCapability("editor");
  const read = getFragmentCapability("read");
  if (!editor || !read) return null;
  if (isLegacyEditorFragment(editor)) return null;
  return { readerCapability: read, editorPrivateKey: editor };
}

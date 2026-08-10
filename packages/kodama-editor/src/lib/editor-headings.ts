/** Normalize heading labels so markdown outline text matches TipTap textContent. */
export function normalizeHeadingText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/==([^=]+)==/g, "$1")
    .replace(/~~([^~]+)~~/g, "$1")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(\*|_)(.*?)\1/g, "$2")
    .replace(/<\/?[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export type EditorHeading = {
  level: number;
  text: string;
  /** ProseMirror document position of the heading node, when known. */
  pos?: number;
};

/** Parse ATX + simple HTML headings from markdown (drawer / offline). */
export function parseMarkdownHeadings(text: string): EditorHeading[] {
  const out: EditorHeading[] = [];
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  for (const line of lines) {
    const atx = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
    if (atx) {
      out.push({ level: atx[1].length, text: normalizeHeadingText(atx[2]) });
      continue;
    }
    const html = /^<h([1-6])(?:\s[^>]*)?>([\s\S]*?)<\/h\1>\s*$/i.exec(line.trim());
    if (html) {
      out.push({ level: Number(html[1]), text: normalizeHeadingText(html[2]) });
    }
  }
  return out;
}

/** Collect headings from a TipTap/ProseMirror doc — source of truth for jumps. */
export function collectEditorHeadings(doc: {
  descendants: (
    f: (node: { type: { name: string }; attrs: { level?: number }; textContent: string }, pos: number) => boolean | void,
  ) => void;
}): EditorHeading[] {
  const out: EditorHeading[] = [];
  doc.descendants((node, pos) => {
    if (node.type.name !== "heading") return;
    const text = normalizeHeadingText(node.textContent);
    if (!text) return;
    out.push({
      level: typeof node.attrs.level === "number" ? node.attrs.level : 1,
      text,
      pos,
    });
  });
  return out;
}

const IMAGE_MIME = /^image\//i;
const IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif|svg)$/i;

function suggestedName(type: string): string {
  const ext = type.split("/")[1]?.split("+")[0] || "png";
  return `pasted.${ext}`;
}

function addFile(file: File | null, out: File[], seen: Set<string>) {
  if (!file) return;
  const key = `${file.name}:${file.size}:${file.lastModified}:${file.type}`;
  if (seen.has(key)) return;
  seen.add(key);
  out.push(file);
}

/** Some browsers give a File whose `type` is empty even when the item is image/png. */
export function asImageFile(file: File | null, mimeHint = ""): File | null {
  if (!file) return null;
  const type = file.type || mimeHint || "";
  const named = IMAGE_EXT.test(file.name);
  if (!IMAGE_MIME.test(type) && !named) return null;
  if (file.type && IMAGE_MIME.test(file.type)) return file;
  return new File([file], file.name || suggestedName(type || "image/png"), {
    type: type || "image/png",
    lastModified: file.lastModified,
  });
}

export function dataUrlToFile(dataUrl: string): File | null {
  const m = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/.exec(dataUrl.trim());
  if (!m) return null;
  const type = m[1];
  try {
    const bin = atob(m[2].replace(/\s/g, ""));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new File([bytes], suggestedName(type), { type });
  } catch {
    return null;
  }
}

function decodeHtmlAttr(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

export function filesFromHtmlImages(html: string): File[] {
  const out: File[] = [];
  const seen = new Set<string>();
  const re = /<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html))) {
    const src = decodeHtmlAttr(match[1]);
    if (!src.startsWith("data:image/")) continue;
    addFile(dataUrlToFile(src), out, seen);
  }
  return out;
}

export function httpImageSrcsFromHtml(html: string): string[] {
  const out: string[] = [];
  const re = /<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html))) {
    const src = decodeHtmlAttr(match[1]).trim();
    if (/^https?:\/\//i.test(src)) out.push(src);
  }
  return out;
}

function clipboardTypes(data: DataTransfer): string[] {
  try {
    return Array.from(data.types ?? []);
  } catch {
    return [];
  }
}

/** Screenshot / Explorer paste often includes a filename as text/plain. */
export function collectClipboardImages(data: DataTransfer | null | undefined): File[] {
  if (!data) return [];

  const seen = new Set<string>();
  const files: File[] = [];

  if (data.files) {
    for (let i = 0; i < data.files.length; i++) {
      addFile(asImageFile(data.files[i]), files, seen);
    }
  }
  if (data.items) {
    for (let i = 0; i < data.items.length; i++) {
      const item = data.items[i];
      if (!item || item.kind !== "file") continue;
      addFile(asImageFile(item.getAsFile(), item.type), files, seen);
    }
  }

  const html = data.getData?.("text/html") ?? "";
  if (html) {
    for (const file of filesFromHtmlImages(html)) addFile(file, files, seen);
  }

  return files;
}

export function clipboardLikelyHasImage(data: DataTransfer | null | undefined): boolean {
  if (!data) return false;
  if (collectClipboardImages(data).length) return true;
  const types = clipboardTypes(data);
  if (types.some((t) => t === "Files" || IMAGE_MIME.test(t))) return true;
  const html = data.getData?.("text/html") ?? "";
  if (!/<img\b/i.test(html)) return false;
  const text = (data.getData?.("text/plain") ?? "").trim();
  const htmlText = html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").trim();
  return text.length < 120 && htmlText.length < 120;
}

export async function readImagesFromClipboardApi(): Promise<File[]> {
  const read = navigator.clipboard?.read;
  if (!read) return [];
  try {
    const items = await read.call(navigator.clipboard);
    const files: File[] = [];
    const seen = new Set<string>();
    for (const item of items) {
      const type = item.types.find((t) => IMAGE_MIME.test(t));
      if (!type) continue;
      const blob = await item.getType(type);
      addFile(new File([blob], suggestedName(type), { type }), files, seen);
    }
    return files;
  } catch {
    return [];
  }
}

export function imageAltFromFile(file: File): string {
  const name = file.name.replace(/\.[^.]+$/, "").trim();
  if (!name || /^image\d*$/i.test(name) || /^img_/i.test(name) || /^pasted$/i.test(name)) {
    return "";
  }
  return name;
}

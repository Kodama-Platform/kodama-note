import { FileArchive, FileText, FileCode2, Printer } from "lucide-react";

import { exportWorkbookMarkdown, type WorkbookPayload } from "@/lib/workbook";

function sanitizeFilename(title: string): string {
  return title.replace(/[<>:"/\\|?*]+/g, "-").trim() || "sheet";
}

/** Minimal ZIP (store only) for exporting multiple markdown files. */
function buildZip(files: Array<{ name: string; content: string }>): Blob {
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = enc.encode(file.name);
    const data = enc.encode(file.content);
    const crc = crc32(data);
    const local = new Uint8Array(30 + nameBytes.length + data.length);
    const view = new DataView(local.buffer);
    view.setUint32(0, 0x04034b50, true);
    view.setUint16(8, 0, true);
    view.setUint32(14, crc, true);
    view.setUint32(18, data.length, true);
    view.setUint32(22, data.length, true);
    view.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30);
    local.set(data, 30 + nameBytes.length);
    parts.push(local);

    const centralHdr = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(centralHdr.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(10, 0, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint32(42, offset, true);
    centralHdr.set(nameBytes, 46);
    central.push(centralHdr);

    offset += local.length;
  }

  const centralSize = central.reduce((n, c) => n + c.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);

  const out = new Uint8Array(offset + centralSize + end.length);
  let pos = 0;
  for (const p of parts) {
    out.set(p, pos);
    pos += p.length;
  }
  for (const c of central) {
    out.set(c, pos);
    pos += c.length;
  }
  out.set(end, pos);
  return new Blob([out], { type: "application/zip" });
}

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let j = 0; j < 8; j++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function useExportActions({
  slug,
  workbook,
  activeSheetTitle,
  getActiveText,
  onDone,
}: {
  slug: string;
  workbook: WorkbookPayload;
  activeSheetTitle: string;
  getActiveText: () => string;
  onDone?: () => void;
}) {
  const multiSheet = workbook.sheets.length > 1;

  const triggerDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    onDone?.();
  };

  const downloadActive = (ext: "md" | "txt") => {
    const text = getActiveText();
    const mime = ext === "md" ? "text/markdown" : "text/plain";
    const blob = new Blob([text], { type: `${mime};charset=utf-8` });
    const base = multiSheet ? sanitizeFilename(activeSheetTitle) : slug;
    triggerDownload(blob, `${base}.${ext}`);
  };

  const downloadAllSheets = () => {
    const text = exportWorkbookMarkdown(workbook);
    const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
    triggerDownload(blob, `${slug}-workbook.md`);
  };

  const downloadZip = () => {
    const files = [...workbook.sheets]
      .sort((a, b) => a.order - b.order)
      .map((s) => ({
        name: `${sanitizeFilename(s.title)}.md`,
        content: s.markdown,
      }));
    triggerDownload(buildZip(files), `${slug}-workbook.zip`);
  };

  const print = () => {
    onDone?.();
    setTimeout(() => window.print(), 50);
  };

  const items = [
    {
      icon: <FileCode2 className="h-3.5 w-3.5" />,
      label: multiSheet ? "Active sheet (.md)" : "Markdown (.md)",
      onClick: () => downloadActive("md"),
    },
    {
      icon: <FileText className="h-3.5 w-3.5" />,
      label: multiSheet ? "Active sheet (.txt)" : "Plain text (.txt)",
      onClick: () => downloadActive("txt"),
    },
    ...(multiSheet
      ? [
          {
            icon: <FileCode2 className="h-3.5 w-3.5" />,
            label: "All sheets (.md)",
            onClick: downloadAllSheets,
          },
          {
            icon: <FileArchive className="h-3.5 w-3.5" />,
            label: "All sheets (.zip)",
            onClick: downloadZip,
          },
        ]
      : []),
    {
      icon: <Printer className="h-3.5 w-3.5" />,
      label: "Print / Save as PDF",
      onClick: print,
    },
  ];

  return { items, multiSheet };
}

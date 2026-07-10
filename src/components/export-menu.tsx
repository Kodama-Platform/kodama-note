import { useEffect, useRef, useState } from "react";
import { Download, FileText, FileCode2, Printer } from "lucide-react";

export function ExportMenu({ slug, getText }: { slug: string; getText: () => string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const download = (ext: "md" | "txt") => {
    const text = getText();
    const mime = ext === "md" ? "text/markdown" : "text/plain";
    const blob = new Blob([text], { type: `${mime};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slug}.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setOpen(false);
  };

  const print = () => {
    setOpen(false);
    // Allow popover to close before print dialog
    setTimeout(() => window.print(), 50);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="note-toolbar-btn"
        title="Export"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Download className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Export</span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-40 mt-1.5 w-48 overflow-hidden rounded-xl border border-border/80 bg-card/95 p-1 shadow-card backdrop-blur-md"
        >
          <MenuItem icon={<FileCode2 className="h-3.5 w-3.5" />} label="Markdown (.md)" onClick={() => download("md")} />
          <MenuItem icon={<FileText className="h-3.5 w-3.5" />} label="Plain text (.txt)" onClick={() => download("txt")} />
          <MenuItem icon={<Printer className="h-3.5 w-3.5" />} label="Print / Save as PDF" onClick={print} />
        </div>
      )}
    </div>
  );
}

function MenuItem({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-light text-foreground transition-colors hover:bg-primary/5"
    >
      {icon}
      {label}
    </button>
  );
}

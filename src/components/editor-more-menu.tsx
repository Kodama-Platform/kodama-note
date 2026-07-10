import { useEffect, useRef, useState } from "react";
import {
  Check,
  FileCode2,
  Flame,
  Focus,
  MoreHorizontal,
  Timer,
} from "lucide-react";

import { BURN_MODES, type BurnMode } from "@/lib/pages";
import type { WorkbookPayload } from "@/lib/workbook";
import { useExportActions } from "@/components/export-menu";

type EditorMoreMenuProps = {
  canEdit: boolean;
  focus: boolean;
  markdownView: boolean;
  burnMode: BurnMode;
  expirySaving: boolean;
  slug: string;
  workbook: WorkbookPayload;
  activeSheetTitle: string;
  getActiveText: () => string;
  onToggleFocus: () => void;
  onToggleMarkdownView: () => void;
  onChangeExpiry: (mode: BurnMode) => void;
  onOpenChange?: (open: boolean) => void;
};

export function EditorMoreMenu({
  canEdit,
  focus,
  markdownView,
  burnMode,
  expirySaving,
  slug,
  workbook,
  activeSheetTitle,
  getActiveText,
  onToggleFocus,
  onToggleMarkdownView,
  onChangeExpiry,
  onOpenChange,
}: EditorMoreMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const exportActions = useExportActions({
    slug,
    workbook,
    activeSheetTitle,
    getActiveText,
    onDone: () => setOpen(false),
  });

  const setMenuOpen = (next: boolean) => {
    setOpen(next);
    onOpenChange?.(next);
  };

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setMenuOpen(!open)}
        className="note-toolbar-btn"
        title="More options"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="More options"
      >
        <MoreHorizontal className="h-3.5 w-3.5" />
      </button>
      {open && (
        <>
          <button
            aria-label="Close menu"
            className="fixed inset-0 z-30 cursor-default"
            onClick={() => setMenuOpen(false)}
          />
          <div
            role="menu"
            className="absolute right-0 z-40 mt-1.5 w-56 overflow-hidden rounded-xl border border-border/80 bg-card/95 p-1 shadow-card backdrop-blur-md"
          >
            <MenuToggle
              icon={<Focus className="h-3.5 w-3.5" />}
              label="Focus mode"
              active={focus}
              onClick={() => {
                onToggleFocus();
                setMenuOpen(false);
              }}
            />
            <MenuToggle
              icon={<FileCode2 className="h-3.5 w-3.5" />}
              label="Markdown view"
              hint="⌘⇧M"
              active={markdownView}
              onClick={() => {
                onToggleMarkdownView();
                setMenuOpen(false);
              }}
            />

            <div className="my-1 border-t border-border/60" role="separator" />

            {exportActions.items.map((item) => (
              <MenuItem key={item.label} icon={item.icon} label={item.label} onClick={item.onClick} />
            ))}

            {canEdit && (
              <>
                <div className="my-1 border-t border-border/60" role="separator" />
                <p className="px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
                  Lifetime
                </p>
                {BURN_MODES.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    role="menuitemradio"
                    aria-checked={burnMode === m.value}
                    disabled={expirySaving}
                    onClick={() => {
                      onChangeExpiry(m.value);
                      setMenuOpen(false);
                    }}
                    className={`flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-light transition-colors hover:bg-primary/5 disabled:opacity-50 ${
                      burnMode === m.value ? "bg-primary/10" : ""
                    }`}
                  >
                    <span className="mt-0.5 text-primary">
                      {m.value === "after_read" ? (
                        <Flame className="h-3 w-3" />
                      ) : (
                        <Timer className="h-3 w-3" />
                      )}
                    </span>
                    <span className="flex-1">
                      <span className="block font-medium text-foreground">{m.label}</span>
                      <span className="block text-[11px] text-muted-foreground">{m.hint}</span>
                    </span>
                    {burnMode === m.value && <Check className="mt-0.5 h-3 w-3 text-primary" />}
                  </button>
                ))}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-light text-foreground transition-colors hover:bg-primary/5"
    >
      {icon}
      {label}
    </button>
  );
}

function MenuToggle({
  icon,
  label,
  hint,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitemcheckbox"
      aria-checked={active}
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-light transition-colors hover:bg-primary/5 ${
        active ? "bg-primary/10 text-foreground" : "text-foreground"
      }`}
    >
      {icon}
      <span className="flex-1">{label}</span>
      {hint ? <span className="font-mono text-[10px] text-muted-foreground">{hint}</span> : null}
      {active ? <Check className="h-3 w-3 text-primary" /> : null}
    </button>
  );
}

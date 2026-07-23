import { useEffect, useRef, useState } from "react";
import {
  Check,
  FileCode2,
  Flame,
  Focus,
  Lock,
  MoreHorizontal,
  RotateCcw,
  Save,
  Timer,
} from "lucide-react";

import { NoteAppearancePicker } from "@/components/note-appearance-picker";
import { BURN_MODES, type BurnMode } from "@/lib/pages";
import { AUTO_LOCK_OPTIONS, autoLockLabel, type AutoLockDuration } from "@/lib/auto-lock";
import type { NoteAppearance } from "@/lib/note-appearance";
import type { SaveMode } from "@/lib/save-mode";
import type { WorkbookPayload } from "@/lib/workbook";
import { useExportActions } from "@/components/export-menu";

type EditorMoreMenuProps = {
  canEdit: boolean;
  canChangeExpiry?: boolean;
  focus: boolean;
  markdownView: boolean;
  burnMode: BurnMode;
  expirySaving: boolean;
  autoLockDuration: AutoLockDuration;
  saveMode?: SaveMode;
  canReload?: boolean;
  slug: string;
  workbook: WorkbookPayload;
  activeSheetTitle: string;
  getActiveText: () => string;
  noteAppearance?: NoteAppearance;
  onChangeNoteAppearance?: (next: NoteAppearance) => void;
  onToggleFocus: () => void;
  onToggleMarkdownView: () => void;
  onChangeExpiry: (mode: BurnMode) => void;
  onChangeAutoLockDuration: (duration: AutoLockDuration) => void;
  onChangeSaveMode?: (mode: SaveMode) => void;
  onReload?: () => void;
  onLockNow?: () => void;
  onOpenChange?: (open: boolean) => void;
};

export function EditorMoreMenu({
  canEdit,
  canChangeExpiry: canChangeExpiryProp,
  focus,
  markdownView,
  burnMode,
  expirySaving,
  autoLockDuration,
  saveMode,
  canReload,
  slug,
  workbook,
  activeSheetTitle,
  getActiveText,
  onToggleFocus,
  onToggleMarkdownView,
  onChangeExpiry,
  onChangeAutoLockDuration,
  onChangeSaveMode,
  onReload,
  noteAppearance,
  onChangeNoteAppearance,
  onLockNow,
  onOpenChange,
}: EditorMoreMenuProps) {
  const canChangeExpiry = canChangeExpiryProp ?? canEdit;
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
            className="absolute right-0 z-40 mt-1.5 max-h-[min(80vh,32rem)] w-72 overflow-y-auto overflow-x-hidden rounded-xl border border-border/80 bg-card/95 p-1 shadow-card backdrop-blur-md"
          >
            <SectionLabel>Writing</SectionLabel>
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

            {noteAppearance && onChangeNoteAppearance && (
              <>
                <div className="my-1 border-t border-border/60" role="separator" />
                <NoteAppearancePicker
                  compact
                  value={noteAppearance}
                  onChange={onChangeNoteAppearance}
                />
              </>
            )}

            {onChangeSaveMode && saveMode && (
              <>
                <div className="my-1 border-t border-border/60" role="separator" />
                <SectionLabel>Save</SectionLabel>
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={saveMode === "auto"}
                  onClick={() => {
                    onChangeSaveMode("auto");
                    setMenuOpen(false);
                  }}
                  className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-light transition-colors hover:bg-primary/5 ${
                    saveMode === "auto" ? "bg-primary/10" : ""
                  }`}
                >
                  <Save className="h-3.5 w-3.5 text-primary" />
                  <span className="flex-1 font-medium text-foreground">Auto-save</span>
                  {saveMode === "auto" && <Check className="h-3 w-3 text-primary" />}
                </button>
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={saveMode === "manual"}
                  onClick={() => {
                    onChangeSaveMode("manual");
                    setMenuOpen(false);
                  }}
                  className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-light transition-colors hover:bg-primary/5 ${
                    saveMode === "manual" ? "bg-primary/10" : ""
                  }`}
                >
                  <Save className="h-3.5 w-3.5 text-primary" />
                  <span className="flex-1 font-medium text-foreground">Manual save</span>
                  {saveMode === "manual" && <Check className="h-3 w-3 text-primary" />}
                </button>
                {canReload && onReload && (
                  <MenuItem
                    icon={<RotateCcw className="h-3.5 w-3.5" />}
                    label="Reload last saved"
                    onClick={() => {
                      onReload();
                      setMenuOpen(false);
                    }}
                  />
                )}
              </>
            )}

            <div className="my-1 border-t border-border/60" role="separator" />
            <SectionLabel>Export</SectionLabel>
            {exportActions.items.map((item) => (
              <MenuItem key={item.label} icon={item.icon} label={item.label} onClick={item.onClick} />
            ))}

            {onLockNow && (
              <>
                <div className="my-1 border-t border-border/60" role="separator" />
                <SectionLabel>Security</SectionLabel>
                <MenuItem
                  icon={<Lock className="h-3.5 w-3.5" />}
                  label="Lock now"
                  onClick={() => {
                    onLockNow();
                    setMenuOpen(false);
                  }}
                />
                <p className="px-2.5 py-1 text-[10px] font-light text-muted-foreground">
                  Auto-lock · {autoLockLabel(autoLockDuration)}
                </p>
                {AUTO_LOCK_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    role="menuitemradio"
                    aria-checked={autoLockDuration === option.value}
                    onClick={() => {
                      onChangeAutoLockDuration(option.value);
                      setMenuOpen(false);
                    }}
                    className={`flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-light transition-colors hover:bg-primary/5 ${
                      autoLockDuration === option.value ? "bg-primary/10" : ""
                    }`}
                  >
                    <span className="mt-0.5 text-primary">
                      <Lock className="h-3 w-3" />
                    </span>
                    <span className="flex-1">
                      <span className="block font-medium text-foreground">{option.label}</span>
                      <span className="block text-[11px] text-muted-foreground">{option.hint}</span>
                    </span>
                    {autoLockDuration === option.value && (
                      <Check className="mt-0.5 h-3 w-3 text-primary" />
                    )}
                  </button>
                ))}
              </>
            )}

            {canChangeExpiry && (
              <>
                <div className="my-1 border-t border-border/60" role="separator" />
                <SectionLabel>Lifetime</SectionLabel>
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

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
      {children}
    </p>
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

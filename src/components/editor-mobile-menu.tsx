import { useEffect } from "react";
import {
  Check,
  CloudOff,
  FileCode2,
  Flame,
  Focus,
  Loader2,
  Lock,
  Pencil,
  RotateCcw,
  Save,
  Search,
  Timer,
  X,
} from "lucide-react";

import { ThemeToggle } from "@/components/theme-toggle";
import { BURN_MODES, type BurnMode } from "@/lib/pages";
import { AUTO_LOCK_OPTIONS, autoLockLabel, type AutoLockDuration } from "@/lib/auto-lock";
import type { SaveMode } from "@/lib/save-mode";
import type { WorkbookPayload } from "@/lib/workbook";
import { useExportActions } from "@/components/export-menu";

type SaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";

type EditorMobileMenuProps = {
  open: boolean;
  onClose: () => void;
  canSave: boolean;
  saveMode: SaveMode;
  status: SaveStatus;
  isDirty: boolean;
  burnMode: BurnMode;
  expiresAt: string | null;
  findOpen: boolean;
  focus: boolean;
  markdownView: boolean;
  expirySaving: boolean;
  slug: string;
  workbook: WorkbookPayload;
  activeSheetTitle: string;
  getActiveText: () => string;
  onSave: () => void;
  onReload: () => void;
  onChangeSaveMode: (mode: SaveMode) => void;
  onToggleFind: () => void;
  onToggleFocus: () => void;
  onToggleMarkdownView: () => void;
  onChangeExpiry: (mode: BurnMode) => void;
  autoLockDuration: AutoLockDuration;
  onChangeAutoLockDuration: (duration: AutoLockDuration) => void;
  onLockNow?: () => void;
};

export function EditorMobileMenu({
  open,
  onClose,
  canSave,
  saveMode,
  status,
  isDirty,
  burnMode,
  expiresAt,
  findOpen,
  focus,
  markdownView,
  expirySaving,
  slug,
  workbook,
  activeSheetTitle,
  getActiveText,
  onSave,
  onReload,
  onChangeSaveMode,
  onToggleFind,
  onToggleFocus,
  onToggleMarkdownView,
  onChangeExpiry,
  autoLockDuration,
  onChangeAutoLockDuration,
  onLockNow,
}: EditorMobileMenuProps) {
  const exportActions = useExportActions({
    slug,
    workbook,
    activeSheetTitle,
    getActiveText,
    onDone: onClose,
  });

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] md:hidden" role="dialog" aria-modal="true" aria-label="Note menu">
      <button
        type="button"
        aria-label="Close menu"
        className="absolute inset-0 bg-background/95 backdrop-blur-xl"
        onClick={onClose}
      />
      <div className="relative mx-auto flex h-full max-w-lg flex-col px-4 pb-6 pt-3">
        <div className="flex items-center justify-between gap-3">
          <p className="font-display text-lg font-medium tracking-tight text-foreground">Note menu</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-5 overflow-y-auto pb-4">
          {canSave && (
            <section className="space-y-2">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Save</p>
              <MobileStatusRow status={status} isDirty={isDirty} />
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onChangeSaveMode("auto");
                  }}
                  className={`rounded-xl border px-3 py-2.5 text-left text-sm transition-colors ${
                    saveMode === "auto"
                      ? "border-primary/40 bg-primary/10 text-foreground"
                      : "border-border/70 text-muted-foreground"
                  }`}
                >
                  Auto-save
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onChangeSaveMode("manual");
                  }}
                  className={`rounded-xl border px-3 py-2.5 text-left text-sm transition-colors ${
                    saveMode === "manual"
                      ? "border-primary/40 bg-primary/10 text-foreground"
                      : "border-border/70 text-muted-foreground"
                  }`}
                >
                  Manual
                </button>
              </div>
              {saveMode === "manual" && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onSave();
                    }}
                    disabled={status === "saving" || !isDirty}
                    className="btn-moss flex-1 justify-center !py-2.5 !text-sm disabled:opacity-50"
                  >
                    <Save className="h-4 w-4" />
                    Save all sheets
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onReload();
                      onClose();
                    }}
                    disabled={status === "saving"}
                    className="note-toolbar-btn !h-11 !px-3"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>
                </div>
              )}
            </section>
          )}

          <section className="space-y-1">
            <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Tools</p>
            <MobileAction
              icon={<Search className="h-4 w-4" />}
              label="Find & replace"
              active={findOpen}
              onClick={() => {
                onToggleFind();
                onClose();
              }}
            />
          </section>

          <section className="space-y-1">
            <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Display</p>
            <MobileAction
              icon={<Focus className="h-4 w-4" />}
              label="Focus mode"
              active={focus}
              onClick={() => {
                onToggleFocus();
                onClose();
              }}
            />
            <MobileAction
              icon={<FileCode2 className="h-4 w-4" />}
              label="Markdown view"
              active={markdownView}
              onClick={() => {
                onToggleMarkdownView();
                onClose();
              }}
            />
          </section>

          <section className="space-y-1">
            <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Export</p>
            {exportActions.items.map((item) => (
              <MobileAction
                key={item.label}
                icon={item.icon}
                label={item.label}
                onClick={item.onClick}
              />
            ))}
          </section>

          {canSave && (
            <section className="space-y-1">
              <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                Lifetime
              </p>
              {BURN_MODES.map((m) => (
                <MobileAction
                  key={m.value}
                  icon={
                    m.value === "after_read" ? (
                      <Flame className="h-4 w-4" />
                    ) : (
                      <Timer className="h-4 w-4" />
                    )
                  }
                  label={m.label}
                  hint={m.hint}
                  active={burnMode === m.value}
                  disabled={expirySaving}
                  onClick={() => {
                    onChangeExpiry(m.value);
                    onClose();
                  }}
                />
              ))}
            </section>
          )}

          {onLockNow && (
            <section className="space-y-2">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                Security
              </p>
              <button
                type="button"
                onClick={() => {
                  onLockNow();
                  onClose();
                }}
                className="flex w-full items-center gap-3 rounded-xl border border-border/70 px-3 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-primary/5"
              >
                <Lock className="h-4 w-4 text-primary" />
                Lock now
              </button>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                Auto-lock · {autoLockLabel(autoLockDuration)}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {AUTO_LOCK_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => onChangeAutoLockDuration(option.value)}
                    className={`rounded-xl border px-3 py-2.5 text-left text-sm transition-colors ${
                      autoLockDuration === option.value
                        ? "border-primary/40 bg-primary/10 text-foreground"
                        : "border-border/70 text-muted-foreground"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </section>
          )}

          <section className="flex items-center justify-between rounded-xl border border-border/70 px-3 py-2.5">
            <span className="text-sm text-foreground">Theme</span>
            <ThemeToggle />
          </section>

          {burnMode !== "never" && (
            <p className="rounded-xl bg-ember/5 px-3 py-2 text-center text-[11px] text-ember">
              {burnMode === "after_read"
                ? "Burn after read"
                : expiresAt
                  ? `Expires ${new Date(expiresAt).toLocaleString()}`
                  : "Expires soon"}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function MobileStatusRow({ status, isDirty }: { status: SaveStatus; isDirty: boolean }) {
  const displayStatus: SaveStatus =
    status === "saving" || status === "error"
      ? status
      : isDirty
        ? "dirty"
        : status === "saved"
          ? "saved"
          : "idle";
  const map: Record<SaveStatus, { label: string; icon: React.ReactNode; cls: string }> = {
    idle: { label: "Ready", icon: <Check className="h-3.5 w-3.5" />, cls: "text-muted-foreground" },
    dirty: { label: "Unsaved changes", icon: <Pencil className="h-3.5 w-3.5" />, cls: "text-amber-700 dark:text-amber-300" },
    saving: { label: "Saving…", icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />, cls: "text-primary" },
    saved: { label: "Saved", icon: <Check className="h-3.5 w-3.5" />, cls: "text-emerald-700 dark:text-emerald-300" },
    error: { label: "Save failed", icon: <CloudOff className="h-3.5 w-3.5" />, cls: "text-destructive" },
  };
  const v = map[displayStatus];
  return (
    <div className={`flex items-center gap-2 rounded-xl border border-border/70 bg-card/50 px-3 py-2.5 text-sm ${v.cls}`}>
      {v.icon}
      {v.label}
    </div>
  );
}

function MobileAction({
  icon,
  label,
  hint,
  active,
  disabled,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors disabled:opacity-50 ${
        active ? "bg-primary/10 text-foreground" : "text-foreground hover:bg-primary/5"
      }`}
    >
      <span className="text-primary">{icon}</span>
      <span className="flex-1">
        <span className="block text-sm">{label}</span>
        {hint ? <span className="block text-[11px] text-muted-foreground">{hint}</span> : null}
      </span>
      {active ? <Check className="h-4 w-4 text-primary" /> : null}
    </button>
  );
}

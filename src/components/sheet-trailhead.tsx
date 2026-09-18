import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Leaf, Pencil, Plus, X } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { sheetPreviewText } from "@/lib/sheet-preview";
import { sheetVisibility } from "@/lib/tab-visibility";
import type { TabVisibility, WorkbookSheet } from "@/lib/workbook";

export type SheetTrailheadProps = {
  sheets: WorkbookSheet[];
  activeSheetId: string;
  /** Live markdown for the active sheet so the preview stays fresh. */
  activeMarkdown?: string;
  canEdit: boolean;
  onSelect: (sheetId: string) => void;
  onAdd: (visibility?: TabVisibility) => void;
  onRename: (sheetId: string, title: string) => void;
  onDelete: (sheetId: string) => void;
  canChangeVisibility?: boolean;
  onSetVisibility?: (sheetId: string, visibility: TabVisibility) => void;
};

/** Readable trail switcher under the page title — names live in the popover, not as tabs. */
export function SheetTrailhead({
  sheets,
  activeSheetId,
  activeMarkdown,
  canEdit,
  onSelect,
  onAdd,
  onRename,
  onDelete,
  canChangeVisibility,
  onSetVisibility,
}: SheetTrailheadProps) {
  const sorted = useMemo(
    () => [...sheets].sort((a, b) => a.order - b.order || a.title.localeCompare(b.title)),
    [sheets],
  );
  const multi = sorted.length > 1;
  const activeIndex = Math.max(
    0,
    sorted.findIndex((s) => s.sheet_id === activeSheetId),
  );
  const [open, setOpen] = useState(false);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<WorkbookSheet | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (sorted.length === 0 || (!multi && !canEdit)) return null;

  const commitRename = () => {
    if (!renameId) return;
    const trimmed = renameValue.trim();
    if (trimmed) onRename(renameId, trimmed);
    setRenameId(null);
    setRenameValue("");
  };

  const previewFor = (sheet: WorkbookSheet) => {
    const md =
      sheet.sheet_id === activeSheetId && activeMarkdown != null
        ? activeMarkdown
        : sheet.markdown;
    return sheetPreviewText(md, 72);
  };

  return (
    <>
      <div ref={rootRef} data-sheet-trailhead="true" className="sheet-trailhead">
        {multi ? (
          <button
            type="button"
            className="sheet-trailhead-trigger"
            aria-expanded={open}
            aria-haspopup="dialog"
            onClick={() => setOpen((v) => !v)}
          >
            <Leaf className="sheet-trailhead-mark" strokeWidth={1.75} aria-hidden="true" />
            <span>
              Trail {activeIndex + 1} of {sorted.length}
            </span>
            <ChevronDown
              className={`sheet-trailhead-chevron${open ? " is-open" : ""}`}
              aria-hidden="true"
            />
          </button>
        ) : (
          <p className="sheet-trailhead-alone">
            <Leaf className="sheet-trailhead-mark" strokeWidth={1.75} aria-hidden="true" />
            One trail in this grove
          </p>
        )}

        {canEdit && (
          <div className="sheet-trailhead-grow-group">
            <button type="button" className="sheet-trailhead-grow" onClick={() => onAdd("private")}>
              <Plus className="h-3.5 w-3.5" strokeWidth={1.75} />
              Private
            </button>
            <button type="button" className="sheet-trailhead-grow" onClick={() => onAdd("public")}>
              Public
            </button>
          </div>
        )}

        {open && multi && (
          <div className="sheet-trailhead-popover" role="dialog" aria-label="Switch trail">
            <p className="sheet-trailhead-popover-label">Trails in this grove</p>
            <ul className="sheet-trailhead-list">
              {sorted.map((sheet, i) => {
                const active = sheet.sheet_id === activeSheetId;
                const title = sheet.title || "Untitled";
                return (
                  <li key={sheet.sheet_id} className="sheet-trailhead-item-wrap">
                    <button
                      type="button"
                      className={`sheet-trailhead-item${active ? " is-active" : ""}`}
                      aria-current={active ? "true" : undefined}
                      onClick={() => {
                        onSelect(sheet.sheet_id);
                        setOpen(false);
                      }}
                    >
                      <span className="sheet-trailhead-item-index">{i + 1}</span>
                      <span className="sheet-trailhead-item-body">
                        <span className="sheet-trailhead-item-title">
                          {title}
                          <span className={`sheet-visibility-badge sheet-visibility-badge--${sheetVisibility(sheet)}`}>
                            {sheetVisibility(sheet)}
                          </span>
                        </span>
                        <span className="sheet-trailhead-item-preview">{previewFor(sheet)}</span>
                      </span>
                    </button>
                    {canEdit && (
                      <div className="sheet-trailhead-item-actions">
                        {canChangeVisibility && onSetVisibility && (
                          <button
                            type="button"
                            className="sheet-trailhead-icon-btn"
                            aria-label={
                              sheetVisibility(sheet) === "public"
                                ? `Make ${title} private`
                                : `Make ${title} public`
                            }
                            onClick={() => {
                              onSetVisibility(
                                sheet.sheet_id,
                                sheetVisibility(sheet) === "public" ? "private" : "public",
                              );
                              setOpen(false);
                            }}
                          >
                            {sheetVisibility(sheet) === "public" ? "Hide" : "Share"}
                          </button>
                        )}
                        <button
                          type="button"
                          className="sheet-trailhead-icon-btn"
                          aria-label={`Rename ${title}`}
                          onClick={() => {
                            setRenameId(sheet.sheet_id);
                            setRenameValue(sheet.title);
                            setOpen(false);
                          }}
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          className="sheet-trailhead-icon-btn sheet-trailhead-icon-btn--danger"
                          aria-label={`Delete ${title}`}
                          onClick={() => {
                            setDeleteTarget(sheet);
                            setOpen(false);
                          }}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            {canEdit && (
              <button
                type="button"
                className="sheet-trailhead-popover-grow"
                onClick={() => {
                  onAdd();
                  setOpen(false);
                }}
              >
                <Plus className="h-3.5 w-3.5" />
                Grow trail
              </button>
            )}
          </div>
        )}
      </div>

      <Dialog open={!!renameId} onOpenChange={(next) => !next && setRenameId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename trail</DialogTitle>
            <DialogDescription>This name appears as the page title.</DialogDescription>
          </DialogHeader>
          <input
            autoFocus
            className="note-sheet-tab-input !m-0 !h-10 !w-full !max-w-none"
            value={renameValue}
            maxLength={80}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename();
              if (e.key === "Escape") setRenameId(null);
            }}
            aria-label="Trail name"
          />
          <DialogFooter>
            <button type="button" className="note-toolbar-btn" onClick={() => setRenameId(null)}>
              Cancel
            </button>
            <button
              type="button"
              className="rounded-full bg-primary px-3 py-1.5 text-sm text-primary-foreground"
              onClick={commitRename}
            >
              Save
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(next) => !next && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove “{deleteTarget?.title || "Untitled"}”?</DialogTitle>
            <DialogDescription>
              {deleteTarget?.markdown.trim()
                ? "This trail has writing. Removing it cannot be undone."
                : "This empty trail will leave the grove."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button type="button" className="note-toolbar-btn" onClick={() => setDeleteTarget(null)}>
              Cancel
            </button>
            <button
              type="button"
              className="rounded-full bg-destructive px-3 py-1.5 text-sm text-destructive-foreground"
              onClick={() => {
                if (deleteTarget) onDelete(deleteTarget.sheet_id);
                setDeleteTarget(null);
              }}
            >
              Remove trail
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

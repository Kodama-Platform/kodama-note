import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FileText, GripVertical, Pencil, Plus, X } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatRelativeTime } from "@/lib/relative-time";
import { sheetVisibility } from "@/lib/tab-visibility";
import type { TabVisibility, WorkbookSheet } from "@/lib/workbook";

export type SheetNavProps = {
  sheets: WorkbookSheet[];
  activeSheetId: string;
  /** Live markdown for the active sheet (kept for callers / drawers). */
  activeMarkdown?: string;
  canEdit: boolean;
  onSelect: (sheetId: string) => void;
  onAdd: (visibility?: TabVisibility) => void;
  onRename: (sheetId: string, title: string) => void;
  onDelete: (sheetId: string) => void;
  onReorder: (orderedIds: string[]) => void;
  /** Compact list for drawers — no outer section chrome. */
  embedded?: boolean;
  onAfterSelect?: () => void;
};

export function SheetNav({
  sheets,
  activeSheetId,
  canEdit,
  onSelect,
  onAdd,
  onRename,
  onDelete,
  onReorder,
  embedded = false,
  onAfterSelect,
}: SheetNavProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<WorkbookSheet | null>(null);
  const [, setTick] = useState(0);
  const dragId = useRef<string | null>(null);

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const sorted = useMemo(
    () => [...sheets].sort((a, b) => a.order - b.order || a.title.localeCompare(b.title)),
    [sheets],
  );

  const startRename = useCallback((sheet: WorkbookSheet) => {
    setEditingId(sheet.sheet_id);
    setEditValue(sheet.title);
  }, []);

  const commitRename = useCallback(() => {
    if (!editingId) return;
    const trimmed = editValue.trim();
    if (trimmed) onRename(editingId, trimmed);
    setEditingId(null);
    setEditValue("");
  }, [editValue, editingId, onRename]);

  const onDragStart = (sheetId: string) => {
    dragId.current = sheetId;
  };

  const onDragOver = (e: React.DragEvent, overId: string) => {
    e.preventDefault();
    const from = dragId.current;
    if (!from || from === overId) return;
    const ids = sorted.map((s) => s.sheet_id);
    const fromIdx = ids.indexOf(from);
    const toIdx = ids.indexOf(overId);
    if (fromIdx < 0 || toIdx < 0) return;
    ids.splice(fromIdx, 1);
    ids.splice(toIdx, 0, from);
    onReorder(ids);
  };

  const onDragEnd = () => {
    dragId.current = null;
  };

  const list = (
    <ul className="sheet-list" role="listbox" aria-label="Workbook sheets">
      {sorted.map((sheet) => {
        const active = sheet.sheet_id === activeSheetId;
        const editing = editingId === sheet.sheet_id;
        const when = formatRelativeTime(sheet.updated_at ?? sheet.created_at ?? "");

        return (
          <li
            key={sheet.sheet_id}
            role="option"
            aria-selected={active}
            aria-label={sheet.title}
            className={`sheet-list-item group${active ? " sheet-list-item--active" : ""}`}
            onDragOver={(e) => canEdit && onDragOver(e, sheet.sheet_id)}
          >
            {canEdit && sorted.length > 1 && (
              <button
                type="button"
                draggable
                onDragStart={() => onDragStart(sheet.sheet_id)}
                onDragEnd={onDragEnd}
                className="sheet-list-drag"
                aria-label={`Reorder ${sheet.title}`}
                tabIndex={-1}
              >
                <GripVertical className="h-3 w-3" />
              </button>
            )}

            {editing ? (
              <input
                autoFocus
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitRename();
                  if (e.key === "Escape") {
                    setEditingId(null);
                    setEditValue("");
                  }
                }}
                className="sheet-thumb-rename m-1 flex-1"
                maxLength={80}
                aria-label="Sheet title"
              />
            ) : (
              <button
                type="button"
                onClick={() => {
                  onSelect(sheet.sheet_id);
                  onAfterSelect?.();
                }}
                onDoubleClick={() => canEdit && startRename(sheet)}
                className="sheet-list-btn"
                aria-label={`Open ${sheet.title}`}
                title={canEdit ? "Double-click to rename" : sheet.title}
              >
                <span className="sheet-list-title">
                  {sheet.title}
                  <span className={`sheet-visibility-badge sheet-visibility-badge--${sheetVisibility(sheet)}`}>
                    {sheetVisibility(sheet)}
                  </span>
                </span>
                {when ? <span className="sheet-list-meta">{when}</span> : null}
              </button>
            )}

            {canEdit && !editing && (
              <div className="sheet-list-actions">
                <button
                  type="button"
                  onClick={() => startRename(sheet)}
                  className="sheet-thumb-action"
                  aria-label={`Rename ${sheet.title}`}
                >
                  <Pencil className="h-3 w-3" />
                </button>
                {sorted.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(sheet)}
                    className="sheet-thumb-action sheet-thumb-action--danger"
                    aria-label={`Delete ${sheet.title}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );

  const addButton = canEdit ? (
    <div className="flex flex-col gap-1">
      <button type="button" onClick={() => onAdd("private")} className="sheet-thumb-add" aria-label="Add private sheet">
        <Plus className="h-3.5 w-3.5 shrink-0" />
        Private sheet
      </button>
      <button type="button" onClick={() => onAdd("public")} className="sheet-thumb-add" aria-label="Add public sheet">
        Public page
      </button>
    </div>
  ) : null;

  const body = (
    <>
      {list}
      {addButton}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete “{deleteTarget?.title}”?</DialogTitle>
            <DialogDescription>
              {deleteTarget?.markdown.trim()
                ? "This sheet has content. Deleting it cannot be undone."
                : "This empty sheet will be removed."}
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
              Delete sheet
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );

  if (embedded) return <div data-sheet-nav="true">{body}</div>;

  return (
    <section data-sheet-nav="true" className="min-h-0">
      <div className="mb-3 flex items-center justify-between gap-2 border-b border-border/45 pb-2">
        <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          <FileText className="h-3 w-3" /> Sheets
        </span>
      </div>
      {body}
    </section>
  );
}

import { useCallback, useRef, useState } from "react";
import { GripVertical, Pencil, Plus, X } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { WorkbookSheet } from "@/lib/workbook";

type SheetTabBarProps = {
  sheets: WorkbookSheet[];
  activeSheetId: string;
  canEdit: boolean;
  switching: boolean;
  onSelect: (sheetId: string) => void;
  onAdd: () => void;
  onRename: (sheetId: string, title: string) => void;
  onDelete: (sheetId: string) => void;
  onReorder: (orderedIds: string[]) => void;
};

export function SheetTabBar({
  sheets,
  activeSheetId,
  canEdit,
  switching,
  onSelect,
  onAdd,
  onRename,
  onDelete,
  onReorder,
}: SheetTabBarProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<WorkbookSheet | null>(null);
  const dragId = useRef<string | null>(null);

  const sorted = [...sheets].sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
  const multi = sorted.length > 1;
  if (!multi && !canEdit) return null;

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

  return (
    <>
      <div
        data-editor-tabs="true"
        className={`mb-3 flex items-center gap-1 overflow-x-auto border-b border-border/70 pb-0 ${multi ? "" : "border-transparent"}`}
        role="tablist"
        aria-label="Workbook sheets"
      >
        {multi &&
          sorted.map((sheet) => {
          const active = sheet.sheet_id === activeSheetId;
          const editing = editingId === sheet.sheet_id;
          return (
            <div
              key={sheet.sheet_id}
              role="presentation"
              className={`group flex shrink-0 items-center border-b-2 transition-colors ${
                active
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
              }`}
              onDragOver={(e) => canEdit && onDragOver(e, sheet.sheet_id)}
            >
              {canEdit && sorted.length > 1 && (
                <button
                  type="button"
                  draggable
                  onDragStart={() => onDragStart(sheet.sheet_id)}
                  onDragEnd={onDragEnd}
                  className="ml-1 cursor-grab rounded p-0.5 opacity-0 transition-opacity group-hover:opacity-60 active:cursor-grabbing"
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
                  className="mx-1 mb-1 max-w-[10rem] rounded border border-border bg-background px-2 py-1 text-xs font-medium outline-none focus:border-primary/50"
                  maxLength={80}
                  aria-label="Sheet title"
                />
              ) : (
                <button
                  type="button"
                  role="tab"
                  aria-selected={active}
                  disabled={switching}
                  onClick={() => onSelect(sheet.sheet_id)}
                  onDoubleClick={() => canEdit && startRename(sheet)}
                  className="flex items-center gap-1 px-3 py-2 text-xs font-medium transition-opacity disabled:opacity-50"
                  title={canEdit ? "Double-click to rename" : sheet.title}
                >
                  {sheet.title}
                </button>
              )}
              {canEdit && !editing && (
                <>
                  <button
                    type="button"
                    onClick={() => startRename(sheet)}
                    className="rounded p-0.5 opacity-0 transition-opacity group-hover:opacity-60 hover:bg-primary/10"
                    aria-label={`Rename ${sheet.title}`}
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  {sorted.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(sheet)}
                      className="mr-1 rounded p-0.5 opacity-0 transition-opacity group-hover:opacity-60 hover:bg-destructive/10 hover:text-destructive"
                      aria-label={`Delete ${sheet.title}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </>
              )}
            </div>
          );
        })}
        {canEdit && (
          <button
            type="button"
            onClick={onAdd}
            className="mb-1 ml-1 inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-primary/5 hover:text-primary"
            aria-label="Add sheet"
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Add sheet</span>
          </button>
        )}
      </div>

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
            <button
              type="button"
              className="rounded-lg border border-border px-3 py-1.5 text-sm"
              onClick={() => setDeleteTarget(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="rounded-lg bg-destructive px-3 py-1.5 text-sm text-destructive-foreground"
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
}

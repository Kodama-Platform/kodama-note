import { useCallback, useEffect, useRef, useState } from "react";
import { FileText, GripVertical, Pencil, Plus, X } from "lucide-react";

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
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeTabRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    const tab = activeTabRef.current;
    const scroller = scrollRef.current;
    if (!tab || !scroller) return;
    const tabLeft = tab.offsetLeft;
    const tabRight = tabLeft + tab.offsetWidth;
    const viewLeft = scroller.scrollLeft;
    const viewRight = viewLeft + scroller.clientWidth;
    if (tabLeft < viewLeft) {
      scroller.scrollTo({ left: tabLeft - 8, behavior: "smooth" });
    } else if (tabRight > viewRight) {
      scroller.scrollTo({ left: tabRight - scroller.clientWidth + 8, behavior: "smooth" });
    }
  }, [activeSheetId, sorted.length]);

  return (
    <>
      <div data-editor-tabs="true" className="note-sheet-tabs" role="tablist" aria-label="Workbook sheets">
        {multi && (
          <span className="note-sheet-tabs-label" aria-hidden="true">
            Sheets
          </span>
        )}

        <div ref={scrollRef} className="note-sheet-tabs-scroll">
          {multi &&
            sorted.map((sheet) => {
              const active = sheet.sheet_id === activeSheetId;
              const editing = editingId === sheet.sheet_id;
              return (
                <div
                  key={sheet.sheet_id}
                  ref={active ? activeTabRef : undefined}
                  role="presentation"
                  className={`note-sheet-tab-group${active ? " is-active" : ""}`}
                  onDragOver={(e) => canEdit && onDragOver(e, sheet.sheet_id)}
                >
                {canEdit && sorted.length > 1 && (
                  <button
                    type="button"
                    draggable
                    onDragStart={() => onDragStart(sheet.sheet_id)}
                    onDragEnd={onDragEnd}
                    className="note-sheet-tab-action note-sheet-tab-action--drag"
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
                    className="note-sheet-tab-input"
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
                    className="note-sheet-tab"
                    title={canEdit ? "Double-click to rename" : sheet.title}
                  >
                    <FileText
                      className="note-sheet-tab-icon"
                      aria-hidden="true"
                      strokeWidth={1.75}
                    />
                    <span className="note-sheet-tab-label">{sheet.title}</span>
                  </button>
                )}

                {canEdit && !editing && (
                  <div className="note-sheet-tab-actions">
                    <button
                      type="button"
                      onClick={() => startRename(sheet)}
                      className="note-sheet-tab-action"
                      aria-label={`Rename ${sheet.title}`}
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    {sorted.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(sheet)}
                        className="note-sheet-tab-action note-sheet-tab-action--danger"
                        aria-label={`Delete ${sheet.title}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {canEdit && (
            <button
              type="button"
              onClick={onAdd}
              className="note-sheet-tab-add"
              aria-label="Add sheet"
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">New sheet</span>
            </button>
          )}
        </div>
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
}

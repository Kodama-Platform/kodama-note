import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type UnsavedChangesDialogProps = {
  open: boolean;
  title?: string;
  description?: string;
  saving?: boolean;
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
  discardLabel?: string;
};

export function UnsavedChangesDialog({
  open,
  title = "Unsaved changes",
  description = "You have changes that are not saved yet. Save before leaving, or discard them.",
  saving = false,
  onSave,
  onDiscard,
  onCancel,
  discardLabel = "Discard",
}: UnsavedChangesDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !saving) onCancel();
      }}
    >
      <DialogContent className="max-w-md border-border/80 bg-card/95 backdrop-blur-sm">
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-medium">{title}</DialogTitle>
          <DialogDescription className="text-left text-sm leading-relaxed">
            {description}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-2">
          <button type="button" className="note-toolbar-btn" disabled={saving} onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="note-toolbar-btn"
            disabled={saving}
            onClick={onDiscard}
          >
            {discardLabel}
          </button>
          <button type="button" className="btn-moss !py-2 !text-sm" disabled={saving} onClick={onSave}>
            {saving ? "Saving…" : "Save"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

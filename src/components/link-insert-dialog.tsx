import { Link2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type LinkInsertDialogProps = {
  open: boolean;
  selectedText: string;
  initialUrl: string;
  onSubmit: (url: string) => void;
  onCancel: () => void;
};

export function LinkInsertDialog({
  open,
  selectedText,
  initialUrl,
  onSubmit,
  onCancel,
}: LinkInsertDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
    >
      <DialogContent className="max-w-md border-border/80 bg-card/95 backdrop-blur-sm">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const url = new FormData(event.currentTarget).get("url");
            if (typeof url === "string" && url.trim()) onSubmit(url.trim());
          }}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display text-xl font-medium">
              <Link2 className="h-5 w-5 shrink-0 text-primary" />
              {selectedText ? "Add link" : "Insert link"}
            </DialogTitle>
            <DialogDescription className="text-left text-sm leading-relaxed">
              {selectedText
                ? `Turn “${selectedText}” into a hyperlink.`
                : "Paste a URL to insert a linked address."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {selectedText ? (
              <div className="rounded-xl border border-border/70 bg-background/70 px-3 py-2">
                <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                  Link text
                </p>
                <p className="mt-1 text-sm text-foreground">{selectedText}</p>
              </div>
            ) : null}

            <label className="block space-y-1.5">
              <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                URL
              </span>
              <input
                key={`${open}-${initialUrl}`}
                name="url"
                type="url"
                defaultValue={initialUrl}
                placeholder="https://www.kodama.page"
                className="note-input"
                autoFocus
                spellCheck={false}
              />
            </label>

            <p className="text-xs text-muted-foreground">
              Tip: type{" "}
              <code className="rounded bg-muted/60 px-1 py-0.5 font-mono text-[11px]">
                [Click Here](https://www.kodama.page &quot;Tooltip text&quot;)
              </code>{" "}
              for markdown-style links with tooltips.
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <button type="button" className="note-toolbar-btn" onClick={onCancel}>
              Cancel
            </button>
            <button type="submit" className="btn-moss !py-2 !text-sm">
              Apply link
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

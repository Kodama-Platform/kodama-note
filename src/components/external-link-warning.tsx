import { AlertTriangle, ExternalLink } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { LinkRiskAssessment } from "@/lib/link-safety";

type ExternalLinkWarningProps = {
  open: boolean;
  assessment: LinkRiskAssessment | null;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ExternalLinkWarning({
  open,
  assessment,
  onConfirm,
  onCancel,
}: ExternalLinkWarningProps) {
  const blocked = assessment?.level === "blocked";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
    >
      <DialogContent className="max-w-md border-border/80 bg-card/95 backdrop-blur-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-xl font-medium">
            <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" />
            {blocked ? "Unsafe link blocked" : "Open external link?"}
          </DialogTitle>
          <DialogDescription className="text-left text-sm leading-relaxed">
            {blocked
              ? "This link looks unsafe and cannot be opened from Kodama Note."
              : "This link looks unusual. Only continue if you trust where it leads."}
          </DialogDescription>
        </DialogHeader>

        {assessment ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-border/70 bg-background/70 px-3 py-2">
              <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                Destination
              </p>
              <p className="mt-1 break-all text-sm text-foreground">{assessment.displayUrl}</p>
            </div>

            {assessment.reasons.length > 0 ? (
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                {assessment.reasons.map((reason) => (
                  <li key={reason} className="flex gap-2">
                    <span aria-hidden="true">•</span>
                    <span>{reason}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        <DialogFooter className="gap-2 sm:gap-2">
          <button type="button" className="note-toolbar-btn" onClick={onCancel}>
            {blocked ? "Close" : "Stay here"}
          </button>
          {!blocked ? (
            <button type="button" className="btn-moss !py-2 !text-sm" onClick={onConfirm}>
              <ExternalLink className="h-4 w-4" />
              Open link
            </button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

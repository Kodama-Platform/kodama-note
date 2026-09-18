import { Loader2, Lock } from "lucide-react";

import { NoteShell } from "@/components/site/note-shell";
import type { NotePlacePaymentPublic } from "@/lib/note-payment";

export function PaidUnlockGate({
  slug,
  payment,
  busy,
  onCheckout,
}: {
  slug: string;
  payment: NotePlacePaymentPublic | null;
  busy: boolean;
  onCheckout: () => void;
}) {
  return (
    <NoteShell centered footer="feature">
      <div className="w-full max-w-md">
        <div className="note-card">
          <span className="note-badge">Paid place</span>
          <h1 className="mt-4 font-display text-[1.75rem] font-light leading-tight tracking-tight text-foreground sm:text-3xl">
            Unlock <span className="text-primary">/{slug}</span>
          </h1>
          <p className="mt-3 text-sm font-light leading-relaxed text-muted-foreground">
            This note is gated by Kodama Pay. The Delivery Gate still only stores ciphertext —
            checkout entitles you to load it.
          </p>
          {payment?.access === "paid" ? (
            <p className="mt-2 text-xs font-light text-muted-foreground">
              After you pay, reload this page to unlock.
            </p>
          ) : null}
          <button
            type="button"
            disabled={busy}
            onClick={onCheckout}
            className="btn-moss mt-8 flex h-12 w-full items-center justify-center gap-2 text-base disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
            {busy ? "Starting checkout…" : "Continue to Kodama Pay"}
          </button>
        </div>
      </div>
    </NoteShell>
  );
}

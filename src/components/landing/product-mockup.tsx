import { Eye, Lock, ShieldCheck } from "lucide-react";

import { KodamaMark } from "@/components/kodama-mark";

export function ProductMockup() {
  return (
    <div className="product-mockup mx-auto w-full max-w-4xl">
      <div className="overflow-hidden rounded-[1.5rem] border border-border/70 bg-card/90 shadow-card backdrop-blur-sm">
        <div className="flex items-center gap-2 border-b border-border bg-muted/50 px-4 py-2.5">
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-border" />
            <span className="h-2.5 w-2.5 rounded-full bg-border" />
            <span className="h-2.5 w-2.5 rounded-full bg-border" />
          </div>
          <div className="mx-auto flex max-w-xs flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1 font-mono text-[10px] text-muted-foreground">
            <Lock className="h-3 w-3 text-primary" aria-hidden="true" />
            note.kodama.page/travel-notes
          </div>
        </div>

        <div className="border-b border-border bg-background/80 px-4 py-2.5 sm:px-5">
          <div className="flex items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2 font-display text-sm tracking-tight text-foreground">
              <KodamaMark size={20} />
              <span className="hidden sm:inline">Kodama</span>
              <span className="text-muted-foreground">/travel-notes</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="note-badge !h-7 !px-2.5 !text-[10px] !normal-case !tracking-normal">
                <ShieldCheck className="mr-1 h-3 w-3" aria-hidden="true" />
                Encrypted
              </span>
              <span className="note-toolbar-btn !h-7 !px-2.5 !text-[10px]">
                <Eye className="h-3 w-3" aria-hidden="true" />
                Preview
              </span>
            </div>
          </div>
        </div>

        <div className="grid gap-0 sm:grid-cols-[1fr_220px]">
          <div className="border-r border-border p-5 sm:p-6">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Your note
            </p>
            <div className="mt-4 space-y-2 font-mono text-sm leading-relaxed text-foreground/90">
              <p># Trip ideas</p>
              <p className="text-muted-foreground">- Kyoto in autumn</p>
              <p className="text-muted-foreground">- Train pass details</p>
              <p className="text-muted-foreground">- Hotel confirmation #4821</p>
            </div>
            <p className="mt-6 text-[11px] text-muted-foreground">
              Auto-saved · only readable with your password
            </p>
          </div>

          <div className="bg-muted/30 p-5 sm:p-6">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              On the server
            </p>
            <pre className="mt-3 overflow-hidden rounded-lg border border-border bg-background p-3 font-mono text-[9px] leading-relaxed text-primary/80">
              {`U2FsdGVkX1+abc123…\n9kJ8mN2pQ7xR4vL…\nHmacSha256:GCM`}
            </pre>
            <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
              Ciphertext only — no password, no plaintext.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

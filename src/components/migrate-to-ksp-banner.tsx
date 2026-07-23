import { useState } from "react";
import { Loader2, ShieldCheck, X } from "lucide-react";

import { resolveMigrateToKspGate } from "@/lib/migrate-to-ksp";

export function MigrateToKspBanner({
  isLegacy,
  isReader,
  hasEditToken,
  hasAttachments,
  busy,
  error,
  onMigrate,
  onDismiss,
}: {
  isLegacy: boolean;
  isReader: boolean;
  hasEditToken: boolean;
  hasAttachments: boolean;
  busy: boolean;
  error: string | null;
  onMigrate: (password: string) => void | Promise<void>;
  onDismiss: () => void;
}) {
  const gate = resolveMigrateToKspGate({
    isLegacy,
    isReader,
    hasEditToken,
    hasAttachments,
  });
  const [expanded, setExpanded] = useState(false);
  const [password, setPassword] = useState("");

  if (gate.status === "hidden") return null;

  return (
    <div
      role="region"
      aria-label="Upgrade to KSP"
      className="border-t border-border/70 bg-primary/5 px-3 py-2.5 sm:px-6 lg:px-10"
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="flex items-center gap-1.5 text-xs font-medium text-foreground">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
            Upgrade this place to KSP
          </p>
          {gate.status === "blocked_attachments" ? (
            <p className="text-[11px] font-light text-muted-foreground">
              Remove all attachments first — files stay on the old encryption key and would break after
              upgrade.
            </p>
          ) : gate.status === "blocked_no_token" ? (
            <p className="text-[11px] font-light text-muted-foreground">
              This device cannot upgrade — open the place from a browser that previously saved it (edit
              access is stored locally).
            </p>
          ) : (
            <p className="text-[11px] font-light text-muted-foreground">
              Switch to signed KSP encryption. Old read-only links stop working; create new share links
              after upgrade.
            </p>
          )}
          {error && <p className="text-[11px] text-destructive">{error}</p>}
          {gate.status === "ready" && expanded && (
            <form
              className="mt-1 flex flex-col gap-2 sm:max-w-sm"
              onSubmit={(e) => {
                e.preventDefault();
                if (!password || busy) return;
                void onMigrate(password);
              }}
            >
              <label className="space-y-1">
                <span className="text-[11px] text-muted-foreground">Confirm password</span>
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  disabled={busy}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-border/80 bg-background/60 px-3 py-2 text-sm text-foreground outline-none ring-primary/25 focus:ring-2 disabled:opacity-50"
                />
              </label>
              <button
                type="submit"
                disabled={busy || !password}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                {busy ? "Upgrading…" : "Upgrade now"}
              </button>
            </form>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {gate.status === "ready" && !expanded && (
            <button
              type="button"
              disabled={busy}
              onClick={() => setExpanded(true)}
              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
            >
              Upgrade to KSP
            </button>
          )}
          <button
            type="button"
            onClick={onDismiss}
            disabled={busy}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-background/60 hover:text-foreground disabled:opacity-50"
            aria-label="Dismiss upgrade banner"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

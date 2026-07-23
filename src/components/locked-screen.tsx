import type { FormEvent, ReactNode } from "react";
import { useState } from "react";
import { ChevronDown, Flame, Loader2, Lock } from "lucide-react";

import { NoteShell } from "@/components/site/note-shell";
import type { LockReason } from "@/lib/lock-session";
import {
  lockedBadgeLabel,
  lockedDescription,
  type UnlockCapability,
} from "@/lib/unlock-capability";

type LockedScreenProps = {
  slug: string;
  capability: UnlockCapability;
  reason?: LockReason;
  busy: boolean;
  password: string;
  onPasswordChange: (value: string) => void;
  onSubmit: (e: FormEvent) => void;
  /** KSP: paste out-of-band editor capability JSON instead of password. */
  onImportEditorCapability?: (raw: string) => void | Promise<void>;
  expiryNote?: string | null;
  autoFocusPassword?: boolean;
  /** True while auto-opening a `#read=` share link — hide password until it fails. */
  shareLinkUnlocking?: boolean;
  /** When false, password field is hidden (read-only link visit). */
  passwordFallback?: boolean;
};

export function LockedScreen({
  slug,
  capability,
  reason,
  busy,
  password,
  onPasswordChange,
  onSubmit,
  onImportEditorCapability,
  expiryNote,
  autoFocusPassword = true,
  shareLinkUnlocking = false,
  passwordFallback = true,
}: LockedScreenProps) {
  const [showImport, setShowImport] = useState(false);
  const [importRaw, setImportRaw] = useState("");

  return (
    <GateShell>
      <NoteCard>
        <NoteBadge>{lockedBadgeLabel(capability)}</NoteBadge>
        <h1 className="mt-4 font-display text-[1.75rem] font-light leading-tight tracking-tight text-foreground sm:text-3xl">
          {reason === "inactivity" ? (
            <>
              <span className="text-primary">Locked</span> for your privacy
            </>
          ) : (
            <>
              Open <span className="text-primary">/{slug}</span>
            </>
          )}
        </h1>
        <p className="mt-3 text-sm font-light leading-relaxed text-muted-foreground sm:text-[0.95rem]">
          {lockedDescription(capability)}
        </p>
        {reason === "inactivity" && (
          <p className="mt-2 text-xs font-light text-muted-foreground">
            Decrypted content was cleared after a period of inactivity.
          </p>
        )}
        {expiryNote && (
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-ember/10 px-3 py-1 text-xs font-light text-ember">
            <Flame className="h-3 w-3" /> {expiryNote}
          </p>
        )}
        {shareLinkUnlocking ? (
          <div className="mt-10 flex min-h-14 flex-col items-center justify-center gap-2 text-sm font-light text-muted-foreground">
            {busy ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : null}
            Opening your shared note…
          </div>
        ) : passwordFallback ? (
          <form onSubmit={onSubmit} className="mt-8 space-y-5">
            <PasswordInput
              label="Place password"
              value={password}
              onChange={onPasswordChange}
              autoFocus={autoFocusPassword && !showImport}
            />
            <button
              type="submit"
              disabled={busy || !password}
              className="btn-moss mt-1 flex h-12 w-full items-center justify-center gap-2 text-base disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
              {busy ? "Unlocking…" : "Unlock"}
            </button>
          </form>
        ) : null}
        {onImportEditorCapability && passwordFallback && (
          <div className="mt-8 border-t border-border/50 pt-4">
            <button
              type="button"
              onClick={() => setShowImport((v) => !v)}
              className="inline-flex items-center gap-1.5 text-[11px] font-light text-muted-foreground/80 transition-colors hover:text-muted-foreground"
              aria-expanded={showImport}
            >
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform ${showImport ? "rotate-180" : ""}`}
              />
              Advanced · paste editor capability
            </button>
            {showImport && (
              <div className="mt-3 space-y-3">
                <label className="block">
                  <span className="mb-2 block font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    Capability JSON
                  </span>
                  <textarea
                    value={importRaw}
                    onChange={(e) => setImportRaw(e.target.value)}
                    rows={4}
                    className="w-full rounded-xl border border-border/80 bg-background/50 px-3 py-2.5 font-mono text-xs text-foreground outline-none ring-primary/25 focus:ring-2"
                    placeholder='{"protocol":"ksp-v1","read":"…","editor":"…"}'
                  />
                </label>
                <button
                  type="button"
                  disabled={busy || !importRaw.trim()}
                  onClick={() => void onImportEditorCapability(importRaw.trim())}
                  className="note-toolbar-btn flex h-10 w-full items-center justify-center gap-2 !rounded-xl text-sm disabled:opacity-60"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Import & unlock
                </button>
              </div>
            )}
          </div>
        )}
      </NoteCard>
    </GateShell>
  );
}

function GateShell({ children }: { children: ReactNode }) {
  return (
    <NoteShell centered footer="feature">
      <div className="w-full max-w-md">{children}</div>
    </NoteShell>
  );
}

function NoteCard({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-border/80 bg-card/90 p-6 shadow-card backdrop-blur-md sm:p-8">
      {children}
    </div>
  );
}

function NoteBadge({ children }: { children: ReactNode }) {
  return (
    <span className="note-badge inline-flex items-center gap-1.5">
      <Lock className="h-3 w-3" /> {children}
    </span>
  );
}

function PasswordInput({
  label,
  value,
  onChange,
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoFocus?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-2 block font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </span>
      <input
        type="password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoFocus={autoFocus}
        autoComplete="current-password"
        className="w-full rounded-xl border border-border/80 bg-background/60 px-4 py-3.5 text-base text-foreground outline-none ring-primary/30 transition-shadow focus:ring-2"
      />
    </label>
  );
}

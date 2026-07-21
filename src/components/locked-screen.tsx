import type { FormEvent, ReactNode } from "react";
import { useState } from "react";
import { Flame, Loader2, Lock } from "lucide-react";

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
        <h1 className="mt-4 font-display text-[1.65rem] font-light leading-tight tracking-tight text-foreground sm:text-3xl">
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
        <p className="mt-3 text-sm font-light leading-relaxed text-muted-foreground sm:text-base">
          {lockedDescription(capability)}
        </p>
        {reason === "inactivity" && (
          <p className="mt-2 text-xs font-light text-muted-foreground">
            Kodama cleared decrypted note content from memory after a period of inactivity.
          </p>
        )}
        {expiryNote && (
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-ember/10 px-3 py-1 text-xs font-light text-ember">
            <Flame className="h-3 w-3" /> {expiryNote}
          </p>
        )}
        {shareLinkUnlocking ? (
          <div className="mt-8 flex h-12 items-center justify-center gap-2 text-sm font-light text-muted-foreground">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Opening read-only link…
          </div>
        ) : passwordFallback ? (
          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <PasswordInput
              label="Password"
              value={password}
              onChange={onPasswordChange}
              autoFocus={autoFocusPassword && !showImport}
            />
            <button
              type="submit"
              disabled={busy || !password}
              className="btn-moss mt-2 flex h-12 w-full items-center justify-center gap-2 disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
              {busy ? "Unlocking…" : "Unlock"}
            </button>
          </form>
        ) : null}
        {onImportEditorCapability && passwordFallback && (
          <div className="mt-6 border-t border-border/60 pt-6">
            <button
              type="button"
              onClick={() => setShowImport((v) => !v)}
              className="text-xs font-light text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              {showImport ? "Hide editor capability import" : "Have an editor capability?"}
            </button>
            {showImport && (
              <div className="mt-3 space-y-3">
                <label className="block">
                  <span className="mb-2 block font-mono text-[11px] uppercase tracking-[0.2em] text-clay">
                    Paste capability JSON
                  </span>
                  <textarea
                    value={importRaw}
                    onChange={(e) => setImportRaw(e.target.value)}
                    rows={5}
                    className="w-full rounded-xl border border-border/80 bg-background/50 px-3 py-2 font-mono text-xs text-foreground"
                    placeholder='{"protocol":"ksp-v1","read":"…","editor":"…"}'
                  />
                </label>
                <button
                  type="button"
                  disabled={busy || !importRaw.trim()}
                  onClick={() => void onImportEditorCapability(importRaw.trim())}
                  className="btn-moss flex h-10 w-full items-center justify-center gap-2 text-sm disabled:opacity-60"
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
      <span className="mb-2 block font-mono text-[11px] uppercase tracking-[0.2em] text-clay">
        {label}
      </span>
      <input
        type="password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoFocus={autoFocus}
        autoComplete="current-password"
        className="w-full rounded-xl border border-border/80 bg-background/50 px-4 py-3 text-sm text-foreground outline-none ring-primary/30 transition-shadow focus:ring-2"
      />
    </label>
  );
}

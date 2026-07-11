import type { FormEvent, ReactNode } from "react";
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
  expiryNote?: string | null;
  autoFocusPassword?: boolean;
};

export function LockedScreen({
  slug,
  capability,
  reason,
  busy,
  password,
  onPasswordChange,
  onSubmit,
  expiryNote,
  autoFocusPassword = true,
}: LockedScreenProps) {
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
        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <PasswordInput
            label="Password"
            value={password}
            onChange={onPasswordChange}
            autoFocus={autoFocusPassword}
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
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="note-input"
        autoComplete="off"
      />
    </label>
  );
}

function NoteCard({ children }: { children: ReactNode }) {
  return <div className="note-card">{children}</div>;
}

function NoteBadge({ children }: { children: ReactNode }) {
  return <span className="note-badge">{children}</span>;
}

import { Check, Loader2 } from "lucide-react";

export type EncryptionPhase = "deriving" | "encrypting" | "uploading" | "done";

const PHASES: { id: EncryptionPhase; label: string }[] = [
  { id: "deriving", label: "Deriving key locally…" },
  { id: "encrypting", label: "Encrypting in your browser…" },
  { id: "uploading", label: "Uploading encrypted data…" },
];

export function EncryptionProgress({ phase }: { phase: EncryptionPhase }) {
  const activeIndex = PHASES.findIndex((p) => p.id === phase);

  return (
    <div
      role="status"
      aria-live="polite"
      className="mt-4 space-y-2 rounded-xl border border-primary/20 bg-primary/5 p-4 backdrop-blur-sm"
    >
      <p className="text-xs font-light text-foreground">
        Encryption happens in your browser before anything is uploaded.
      </p>
      <ul className="space-y-1.5">
        {PHASES.map((p, i) => {
          const done = i < activeIndex || phase === "done";
          const active = p.id === phase;
          return (
            <li
              key={p.id}
              className={`flex items-center gap-2 text-xs ${
                done ? "text-primary" : active ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              {done ? (
                <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              ) : active ? (
                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden="true" />
              ) : (
                <span className="h-3.5 w-3.5 shrink-0 rounded-full border border-border" />
              )}
              {p.label}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

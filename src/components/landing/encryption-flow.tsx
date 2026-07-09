import { ArrowDown, Database, KeyRound, Lock, Monitor, User } from "lucide-react";

const STEPS = [
  { icon: User, label: "You", detail: "Write in your browser" },
  { icon: KeyRound, label: "Encrypt", detail: "AES-256-GCM locally" },
  { icon: Lock, label: "Ciphertext", detail: "Unreadable blob" },
  { icon: Database, label: "Server", detail: "Stores ciphertext only" },
  { icon: Monitor, label: "Reader", detail: "Opens shared link" },
  { icon: KeyRound, label: "Decrypt", detail: "With the password" },
] as const;

export function EncryptionFlow() {
  return (
    <div className="encryption-flow mx-auto max-w-3xl">
      <div className="grid gap-3 sm:grid-cols-3 sm:gap-4">
        {STEPS.map((step, i) => (
          <div key={step.label} className="relative">
            <div className="flex flex-col items-center rounded-2xl border border-border bg-card p-4 text-center transition-all hover:-translate-y-0.5 hover:shadow-soft">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <step.icon className="h-4 w-4" aria-hidden="true" />
              </div>
              <p className="mt-3 text-sm font-semibold text-foreground">{step.label}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{step.detail}</p>
            </div>
            {i < STEPS.length - 1 && (
              <ArrowDown
                className="encryption-flow-arrow mx-auto my-1 h-4 w-4 text-muted-foreground sm:hidden"
                aria-hidden="true"
              />
            )}
          </div>
        ))}
      </div>
      <p className="mt-6 text-center text-sm leading-relaxed text-muted-foreground">
        Argon2id derives your key from the password in-browser. Kodama never receives either one.
      </p>
    </div>
  );
}

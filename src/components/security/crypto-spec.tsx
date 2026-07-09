import { ArrowDown } from "lucide-react";

import { CRYPTO_SPEC_STEPS } from "@/lib/security";

export function CryptoSpec({ vertical }: { vertical?: boolean }) {
  if (vertical) {
    return (
      <div className="mx-auto max-w-xs font-mono text-sm">
        {CRYPTO_SPEC_STEPS.map((step, i) => (
          <div key={step}>
            <div className="rounded-xl border border-border bg-card px-4 py-2.5 text-center text-foreground">
              {step}
            </div>
            {i < CRYPTO_SPEC_STEPS.length - 1 && (
              <ArrowDown className="mx-auto my-1.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 font-mono text-xs sm:text-sm">
      {CRYPTO_SPEC_STEPS.map((step, i) => (
        <span key={step} className="inline-flex items-center gap-2">
          <span className="rounded-lg border border-border bg-card px-3 py-1.5 text-foreground">
            {step}
          </span>
          {i < CRYPTO_SPEC_STEPS.length - 1 && (
            <span className="text-muted-foreground" aria-hidden="true">
              →
            </span>
          )}
        </span>
      ))}
    </div>
  );
}

import { ArrowDown } from "lucide-react";

import { THREAT_MODEL_STEPS } from "@/lib/security";

export function ThreatModelFlow({ compact }: { compact?: boolean }) {
  return (
    <div className="mx-auto max-w-xl">
      <ol className="space-y-0">
        {THREAT_MODEL_STEPS.map((step, i) => (
          <li key={step.label}>
            <div
              className={`rounded-2xl border border-border/80 bg-card/80 text-center shadow-card backdrop-blur-sm ${
                compact ? "px-4 py-3" : "px-5 py-4"
              }`}
            >
              <p className={`font-semibold text-foreground ${compact ? "text-sm" : "text-base"}`}>
                {step.label}
              </p>
              {!compact && (
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{step.detail}</p>
              )}
            </div>
            {i < THREAT_MODEL_STEPS.length - 1 && (
              <ArrowDown
                className="mx-auto my-2 h-4 w-4 text-primary/60"
                aria-hidden="true"
              />
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

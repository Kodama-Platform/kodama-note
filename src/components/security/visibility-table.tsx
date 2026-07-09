import { Check, X } from "lucide-react";

import { VISIBILITY } from "@/lib/security";

export function VisibilityTable() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Check className="h-4 w-4 text-primary" aria-hidden="true" />
          What Kodama can see
        </h3>
        <ul className="mt-4 space-y-2.5">
          {VISIBILITY.canSee.map((item) => (
            <li key={item} className="flex gap-2 text-sm leading-relaxed text-muted-foreground">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/50" />
              {item}
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-2xl border border-primary/25 bg-primary/5 p-5 sm:p-6">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <X className="h-4 w-4 text-primary" aria-hidden="true" />
          What Kodama cannot see
        </h3>
        <ul className="mt-4 space-y-2.5">
          {VISIBILITY.cannotSee.map((item) => (
            <li key={item} className="flex gap-2 text-sm leading-relaxed text-muted-foreground">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary/60" />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowRight, Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { isSlugAvailable } from "@/lib/pages";
import { normalizeSlug, slugSchema } from "@/lib/slug";
import { cn } from "@/lib/utils";

const PLACEHOLDERS = ["shopping-list", "journal", "ideas", "travel-notes"] as const;

type SlugStatus = "idle" | "invalid" | "checking" | "available" | "taken" | "error";

export function SlugField({
  id,
  variant = "default",
}: {
  id?: string;
  variant?: "default" | "hero";
}) {
  const navigate = useNavigate();
  const [value, setValue] = useState("");
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [status, setStatus] = useState<SlugStatus>("idle");
  const [statusMessage, setStatusMessage] = useState("");
  const requestId = useRef(0);
  const isHero = variant === "hero";

  useEffect(() => {
    const timer = window.setInterval(() => {
      setPlaceholderIndex((i) => (i + 1) % PLACEHOLDERS.length);
    }, 3200);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const slug = normalizeSlug(value);
    if (!slug) {
      setStatus("idle");
      setStatusMessage("");
      return;
    }

    const parsed = slugSchema.safeParse(slug);
    if (!parsed.success) {
      setStatus("invalid");
      setStatusMessage(parsed.error.issues[0]?.message ?? "Invalid page name");
      return;
    }

    setStatus("checking");
    setStatusMessage("Checking availability…");
    const current = ++requestId.current;
    const timer = window.setTimeout(async () => {
      try {
        const available = await isSlugAvailable(parsed.data);
        if (current !== requestId.current) return;
        if (available) {
          setStatus("available");
          setStatusMessage("Available");
        } else {
          setStatus("taken");
          setStatusMessage("Already taken");
        }
      } catch {
        if (current !== requestId.current) return;
        setStatus("error");
        setStatusMessage("Could not check — try again");
      }
    }, 400);

    return () => window.clearTimeout(timer);
  }, [value]);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const slug = normalizeSlug(value);
    const parsed = slugSchema.safeParse(slug);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid page name");
      return;
    }
    if (status === "taken") {
      toast.error("That page name is already taken");
      return;
    }
    navigate({ to: "/$slug", params: { slug: parsed.data } });
  };

  const inputId = id ?? "page-name";
  const statusIcon =
    status === "checking" ? (
      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
    ) : status === "available" ? (
      <Check className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
    ) : status === "taken" || status === "invalid" ? (
      <X className="h-3.5 w-3.5 text-destructive" aria-hidden="true" />
    ) : null;

  const inputBorder =
    status === "taken" || status === "invalid"
      ? "border-destructive/50"
      : status === "available"
        ? "border-primary/35"
        : "border-transparent";

  if (isHero) {
    return (
      <form onSubmit={onSubmit} className="w-full">
        <div
          className={cn(
            "overflow-hidden rounded-2xl border bg-card/85 shadow-glow backdrop-blur-md transition-all",
            inputBorder === "border-transparent" ? "border-border/70" : inputBorder,
            "focus-within:border-ring focus-within:ring-4 focus-within:ring-ring/12",
          )}
        >
          <div className="flex flex-col sm:flex-row sm:items-stretch">
            <div className="flex min-w-0 flex-1 items-center border-b border-border/60 sm:border-b-0">
              <span
                className="shrink-0 border-r border-border/60 bg-muted/35 px-4 py-3.5 font-mono text-[11px] text-muted-foreground sm:py-4 sm:text-xs"
                aria-hidden="true"
              >
                note.kodama.page /
              </span>
              <div className="relative min-w-0 flex-1">
                <input
                  id={inputId}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder={PLACEHOLDERS[placeholderIndex]}
                  aria-label="Page name"
                  aria-invalid={status === "taken" || status === "invalid"}
                  aria-describedby={statusMessage ? `${inputId}-status` : undefined}
                  className="w-full bg-transparent px-4 py-4 text-base text-foreground outline-none placeholder:text-muted-foreground/45 sm:py-[1.125rem] sm:text-lg"
                />
                {statusIcon && (
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
                    {statusIcon}
                  </span>
                )}
              </div>
            </div>
            <button
              type="submit"
              disabled={status === "checking" || status === "taken" || status === "invalid"}
              className="inline-flex h-14 shrink-0 items-center justify-center gap-2 bg-primary px-6 text-sm font-semibold text-primary-foreground transition-all hover:brightness-[1.03] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 sm:px-8"
            >
              Create encrypted page
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        {statusMessage ? (
          <p
            id={`${inputId}-status`}
            role="status"
            className={cn(
              "mt-3 text-center text-xs",
              status === "available"
                ? "text-primary"
                : status === "taken" || status === "invalid"
                  ? "text-destructive"
                  : "text-muted-foreground",
            )}
          >
            {statusMessage}
          </p>
        ) : (
          <p className="mt-3 text-center text-xs font-light text-muted-foreground">
            Your password never leaves your device
          </p>
        )}
      </form>
    );
  }

  return (
    <form onSubmit={onSubmit} className="w-full">
      <div className="flex w-full flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 select-none text-sm font-medium text-muted-foreground">
            note.kodama.page /
          </span>
          <input
            id={inputId}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={PLACEHOLDERS[placeholderIndex]}
            aria-label="Page name"
            aria-invalid={status === "taken" || status === "invalid"}
            aria-describedby={statusMessage ? `${inputId}-status` : `${inputId}-hint`}
            className={cn(
              "h-14 w-full rounded-2xl border bg-card pl-[8.75rem] pr-10 text-base text-foreground outline-none transition-all placeholder:text-muted-foreground/60 focus-visible:border-ring focus-visible:ring-4 focus-visible:ring-ring/15",
              inputBorder === "border-transparent" ? "border-input" : inputBorder,
            )}
          />
          {statusIcon && (
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2">
              {statusIcon}
            </span>
          )}
        </div>
        <button
          type="submit"
          disabled={status === "checking" || status === "taken" || status === "invalid"}
          className="inline-flex h-14 shrink-0 items-center justify-center gap-2 rounded-2xl bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-soft transition-all hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 sm:px-7"
        >
          Create encrypted page
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className="mt-3 flex flex-col items-center gap-1 text-center sm:flex-row sm:justify-between sm:text-left">
        <p id={`${inputId}-hint`} className="text-xs text-muted-foreground">
          note.kodama.page/
          <span className="font-mono text-foreground/80">your-name</span>
        </p>
        {statusMessage ? (
          <p
            id={`${inputId}-status`}
            role="status"
            className={cn(
              "text-xs",
              status === "available"
                ? "text-primary"
                : status === "taken" || status === "invalid"
                  ? "text-destructive"
                  : "text-muted-foreground",
            )}
          >
            {statusMessage}
          </p>
        ) : null}
      </div>
    </form>
  );
}

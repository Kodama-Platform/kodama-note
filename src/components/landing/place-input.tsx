import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { CornerDownLeft, Leaf } from "lucide-react";
import { toast } from "sonner";

import { isSlugAvailable } from "@/lib/pages";
import { normalizeSlug, slugSchema } from "@/lib/slug";

const PLACEHOLDERS = [
  "morning-thoughts",
  "ideas",
  "journal",
  "recipes",
  "dreams",
  "letters",
  "garden",
  "books",
] as const;

type SlugStatus = "idle" | "invalid" | "checking" | "available" | "taken" | "error";

function slugToTitle(slug: string): string {
  if (!slug) return "";
  return slug
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function PlaceInput({ inputId = "page-name" }: { inputId?: string }) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const requestId = useRef(0);
  const [value, setValue] = useState("");
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [status, setStatus] = useState<SlugStatus>("idle");
  const [pending, setPending] = useState(false);

  const [isWideInput, setIsWideInput] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 640px)");
    const update = () => setIsWideInput(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const slug = normalizeSlug(value);
  const displaySlug = slug || PLACEHOLDERS[placeholderIndex];
  const displayTitle = slug ? slugToTitle(slug) : slugToTitle(PLACEHOLDERS[placeholderIndex]);
  const inputWidthCh = useMemo(
    () => Math.max(12, (value.length || PLACEHOLDERS[placeholderIndex].length) + 2),
    [value, placeholderIndex],
  );

  useEffect(() => {
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    if (finePointer) inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (value) return;
    const id = window.setInterval(
      () => setPlaceholderIndex((i) => (i + 1) % PLACEHOLDERS.length),
      4000,
    );
    return () => window.clearInterval(id);
  }, [value]);

  useEffect(() => {
    if (!slug) {
      setStatus("idle");
      return;
    }

    const parsed = slugSchema.safeParse(slug);
    if (!parsed.success) {
      setStatus("invalid");
      return;
    }

    setStatus("checking");
    const current = ++requestId.current;
    const timer = window.setTimeout(async () => {
      try {
        const available = await isSlugAvailable(parsed.data);
        if (current !== requestId.current) return;
        setStatus(available ? "available" : "taken");
      } catch {
        if (current !== requestId.current) return;
        setStatus("error");
      }
    }, 400);

    return () => window.clearTimeout(timer);
  }, [slug]);

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    const normalized = normalizeSlug(value);
    const parsed = slugSchema.safeParse(normalized);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid page name");
      return;
    }
    if (pending) return;
    setPending(true);
    navigate({ to: "/$slug", params: { slug: parsed.data } });
  };

  return (
    <div className="animate-rise animate-rise-delay-1 mx-auto w-full max-w-2xl">
      <form onSubmit={submit} className="flex flex-col items-stretch sm:items-center">
        <div
          className="w-full cursor-text border-b border-border pb-3 transition-colors focus-within:border-primary/60 sm:w-auto"
          onClick={() => inputRef.current?.focus()}
        >
          <p className="mb-2 text-center font-mono text-[13px] text-muted-foreground/60 sm:hidden">
            note.kodama.page/
          </p>
          <div className="flex w-full min-w-0 items-baseline justify-center gap-0 sm:inline-flex">
            <span className="hidden select-none font-mono text-[15px] tracking-tight text-muted-foreground/55 sm:inline sm:text-xl lg:text-[28px]">
              note.kodama.page/
            </span>
            <input
              ref={inputRef}
              id={inputId}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={PLACEHOLDERS[placeholderIndex]}
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              aria-label="Name your place"
              aria-describedby={`${inputId}-status ${inputId}-hints`}
              className="min-w-0 w-full border-0 bg-transparent p-0 text-center font-mono text-[17px] tracking-tight text-foreground caret-primary outline-none ring-0 placeholder:text-muted-foreground/30 focus:outline-none focus:ring-0 sm:w-auto sm:text-left sm:text-xl lg:text-[28px]"
              style={isWideInput ? { width: `${inputWidthCh}ch` } : undefined}
            />
          </div>
        </div>

        <p
          id={`${inputId}-status`}
          role="status"
          aria-live="polite"
          className={`mt-3 min-h-[1.25rem] text-center text-[13px] leading-snug transition-opacity duration-300 sm:mt-4 sm:text-sm ${
            status === "idle" ? "opacity-0" : "opacity-100"
          }`}
        >
          {status === "checking" && <span className="text-muted-foreground/60">Checking…</span>}
          {status === "invalid" && (
            <span className="text-muted-foreground">
              Lowercase letters, numbers, and hyphens only
            </span>
          )}
          {status === "available" && <span className="text-primary">✓ Available</span>}
          {status === "taken" && (
            <span className="text-muted-foreground">
              Already exists —{" "}
              <button type="submit" className="text-primary underline-offset-4 hover:underline">
                Open instead →
              </button>
            </span>
          )}
          {status === "error" && (
            <span className="text-muted-foreground">Could not check — try again</span>
          )}
        </p>

        <button type="submit" className="sr-only" tabIndex={-1}>
          Open
        </button>
      </form>

      <div
        aria-hidden="true"
        className="mx-auto mt-8 w-full max-w-[560px] rounded-md border border-border/60 bg-card px-5 py-5 text-left shadow-soft sm:mt-12 sm:px-8 sm:py-8 lg:px-10 lg:py-10"
      >
        <p className="break-all font-mono text-[12px] leading-relaxed text-muted-foreground sm:text-[13px]">
          <span className="inline-flex items-start gap-1.5">
            <Leaf className="mt-0.5 h-3 w-3 shrink-0 text-primary" strokeWidth={2} aria-hidden="true" />
            <span className={value ? "text-foreground/85" : "text-muted-foreground/60"}>
              note.kodama.page/{displaySlug}
            </span>
          </span>
        </p>
        <h2
          className={`mt-4 font-display text-[1.35rem] font-medium leading-snug tracking-tight sm:mt-6 sm:text-2xl lg:text-[30px] ${
            value ? "text-foreground" : "text-muted-foreground/40"
          }`}
        >
          {displayTitle}
          <span
            aria-hidden="true"
            className="k-caret ml-0.5 inline-block h-5 w-[2px] translate-y-0.5 bg-foreground/70 sm:h-6 sm:translate-y-1"
          />
        </h2>
        <hr className="mt-3 border-border/60 sm:mt-4" />
        <div className="mt-4 h-10 sm:mt-5 sm:h-16" />
      </div>

      <div
        id={`${inputId}-hints`}
        className="mt-6 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-[13px] text-muted-foreground/80 sm:mt-8 sm:gap-x-4 sm:text-sm"
      >
        <span>Private by design</span>
        <span className="text-muted-foreground/30" aria-hidden="true">
          ·
        </span>
        <span>No account</span>
        <span className="text-muted-foreground/30" aria-hidden="true">
          ·
        </span>
        <span
          className={`inline-flex items-center gap-1.5 transition-opacity ${
            status === "available" ? "text-primary opacity-100" : "opacity-80"
          }`}
        >
          <CornerDownLeft className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
          Press Enter
        </span>
      </div>
    </div>
  );
}

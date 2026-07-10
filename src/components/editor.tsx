import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  Check,
  CloudOff,
  Eye,
  Flame,
  Focus,
  Loader2,
  Pencil,
  Search,
  ShieldCheck,
  Timer,
} from "lucide-react";
import { toast } from "sonner";

import { ThemeToggle } from "@/components/theme-toggle";
import { KodamaMark } from "@/components/kodama-mark";
import { NoteShell } from "@/components/site/note-shell";
import {
  HEADER_INNER,
  HEADER_OFFSET,
  headerLogoClass,
  headerLogoMarkClass,
  headerLogoTextClass,
  headerShellClass,
  useHeaderScrolled,
} from "@/components/site/header-chrome";
import { AttachmentsPanel } from "@/components/attachments-panel";
import { VersionHistory } from "@/components/version-history";
import { ExportMenu } from "@/components/export-menu";
import { FindReplace } from "@/components/find-replace";
import { Outline } from "@/components/outline";
import { DonateRibbon, useVisitCount } from "@/components/donate-ribbon";
import { encrypt } from "@/lib/crypto";
import { appendVersion, BURN_MODES, updateExpiry, type BurnMode } from "@/lib/pages";
import { renderMarkdown } from "@/lib/markdown";


type SaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";

export function Editor({
  slug,
  initialText,
  initialUpdatedAt,
  cryptoKey,
  editToken,
  burnMode: initialBurnMode,
  expiresAt: initialExpiresAt,
}: {
  slug: string;
  initialText: string;
  initialUpdatedAt: string;
  cryptoKey: CryptoKey;
  editToken: string | null;
  burnMode: BurnMode;
  expiresAt: string | null;
}) {
  const canSave = !!editToken;
  const [text, setText] = useState(initialText);
  const [updatedAt, setUpdatedAt] = useState(initialUpdatedAt);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [preview, setPreview] = useState(false);
  const [burnMode, setBurnMode] = useState<BurnMode>(initialBurnMode);
  const [expiresAt, setExpiresAt] = useState<string | null>(initialExpiresAt);
  const [expiryOpen, setExpiryOpen] = useState(false);
  const [expirySaving, setExpirySaving] = useState(false);
  const [focus, setFocus] = useState(false);
  const [findOpen, setFindOpen] = useState(false);
  const [findMode, setFindMode] = useState<"find" | "replace">("find");
  const lastSavedRef = useRef(initialText);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const initialWordsRef = useRef<number>(
    initialText.trim() ? initialText.trim().split(/\s+/).length : 0,
  );
  const visits = useVisitCount(slug);
  const headerScrolled = useHeaderScrolled();


  const changeExpiry = useCallback(
    async (mode: BurnMode) => {
      if (!editToken || mode === burnMode) {
        setExpiryOpen(false);
        return;
      }
      setExpirySaving(true);
      try {
        const res = await updateExpiry({ slug, edit_token: editToken, burn_mode: mode });
        setBurnMode(res.burn_mode);
        setExpiresAt(res.expires_at);
        toast.success("Lifetime updated");
        setExpiryOpen(false);
      } catch (e) {
        toast.error((e as Error).message);
      } finally {
        setExpirySaving(false);
      }
    },
    [burnMode, editToken, slug],
  );

  const save = useCallback(
    async (opts?: { force?: boolean; text?: string }) => {
      if (!editToken) return;
      const payload = opts?.text ?? text;
      if (!opts?.force && payload === lastSavedRef.current) return;
      setStatus("saving");
      try {
        const { ciphertext, iv } = await encrypt(cryptoKey, payload);
        const res = await appendVersion({ slug, edit_token: editToken, ciphertext, iv });
        lastSavedRef.current = payload;
        setUpdatedAt(res.created_at);
        setStatus("saved");
      } catch (e) {
        setStatus("error");
        toast.error((e as Error).message);
      }
    },
    [cryptoKey, editToken, slug, text],
  );

  const restoreVersion = useCallback(
    async (plaintext: string, label?: string) => {
      // Cancel any pending debounced save so we don't double-write.
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setText(plaintext);
      // Force a new snapshot even if the restored text matches the latest one,
      // so version history stays strictly append-only.
      await save({ force: true, text: plaintext });
      toast.success(label ? `Restored to ${label}` : "Restored as a new version");
    },
    [save],
  );



  // Debounced auto-save
  useEffect(() => {
    if (!canSave) return;
    if (text === lastSavedRef.current) return;
    setStatus("dirty");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      save();
    }, 1200);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [text, canSave, save]);

  // Warn before unload if dirty
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (status === "dirty" || status === "saving") {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [status]);

  // Keyboard shortcuts + command palette events
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const k = e.key.toLowerCase();
      if (mod && k === "s") {
        e.preventDefault();
        save();
      } else if (mod && k === "f") {
        e.preventDefault();
        setFindMode("find");
        setFindOpen(true);
      } else if (mod && e.shiftKey && k === "h") {
        e.preventDefault();
        setFindMode("replace");
        setFindOpen(true);
      } else if (mod && e.shiftKey && k === "c") {
        e.preventDefault();
        navigator.clipboard
          .writeText(window.location.origin + "/" + slug)
          .then(() => toast.success("Link copied"))
          .catch(() => toast.error("Couldn't copy link"));
      } else if (k === "escape") {
        if (findOpen) setFindOpen(false);
        else if (focus) setFocus(false);
      }
    };
    const onFocusEvt = () => setFocus((v) => !v);
    const onPreviewEvt = () => setPreview((v) => !v);
    window.addEventListener("keydown", onKey);
    window.addEventListener("kodama:toggle-focus", onFocusEvt);
    window.addEventListener("kodama:toggle-preview", onPreviewEvt);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("kodama:toggle-focus", onFocusEvt);
      window.removeEventListener("kodama:toggle-preview", onPreviewEvt);
    };
  }, [save, findOpen, focus, slug]);


  // Typewriter scroll in focus mode
  useEffect(() => {
    if (!focus || preview) return;
    const ta = textareaRef.current;
    if (!ta) return;
    const onInput = () => {
      const rect = ta.getBoundingClientRect();
      const targetY = window.innerHeight / 2;
      const currentY = rect.top + Math.min(rect.height, ta.clientHeight) / 2;
      window.scrollBy({ top: currentY - targetY, behavior: "smooth" });
    };
    ta.addEventListener("keyup", onInput);
    return () => ta.removeEventListener("keyup", onInput);
  }, [focus, preview]);

  const html = useMemo(() => (preview ? renderMarkdown(text) : ""), [preview, text]);
  const charCount = text.length;
  const wordCount = useMemo(() => (text.trim() ? text.trim().split(/\s+/).length : 0), [text]);
  const sessionWords = Math.max(0, wordCount - initialWordsRef.current);
  const readingMinutes = Math.max(1, Math.round(wordCount / 200));


  return (
    <NoteShell showHeader={false} footer={false} className={focus ? "focus-mode" : ""}>
      <div className={`flex min-h-screen flex-col ${HEADER_OFFSET}`}>
      <header
        data-editor-chrome="true"
        className={headerShellClass(headerScrolled)}
      >

        <div className={HEADER_INNER}>
          <Link
            to="/"
            className={headerLogoClass()}
          >
            <KodamaMark size={26} className={`${headerLogoMarkClass()} sm:hidden`} />
            <KodamaMark size={28} className={`${headerLogoMarkClass()} hidden sm:block`} />
            <span className={headerLogoTextClass()}>
              <span className="hidden sm:inline">Kodama Note</span>
              <span className="sm:hidden">Note</span>
              <span className="text-muted-foreground">/{slug}</span>
            </span>
          </Link>

          <div className="flex items-center gap-1.5">
            {canSave && <StatusPill status={status} />}
            <ExpiryPill burnMode={burnMode} expiresAt={expiresAt} />
            <button
              onClick={() => setPreview((v) => !v)}
              className="note-toolbar-btn"
              aria-pressed={preview}
            >
              {preview ? <Pencil className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">{preview ? "Edit" : "Preview"}</span>
            </button>
            <button
              onClick={() => {
                setFindMode("find");
                setFindOpen((v) => !v);
              }}
              className="note-toolbar-btn"
              aria-pressed={findOpen}
              title="Find & Replace (⌘F)"
            >
              <Search className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Find</span>
            </button>
            <button
              onClick={() => setFocus((v) => !v)}
              className="note-toolbar-btn"
              aria-pressed={focus}
              title="Focus mode"
            >
              <Focus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Focus</span>
            </button>
            <ExportMenu slug={slug} text={text} />
            <VersionHistory
              slug={slug}
              cryptoKey={cryptoKey}
              onRestore={editToken ? restoreVersion : undefined}
            />

            {editToken && (
              <div className="relative">
                <button
                  onClick={() => setExpiryOpen((v) => !v)}
                  className="note-toolbar-btn"
                  aria-haspopup="menu"
                  aria-expanded={expiryOpen}
                  title={`Lifetime: ${BURN_MODES.find((m) => m.value === burnMode)?.label ?? burnMode}`}
                >
                  {burnMode === "after_read" ? (
                    <Flame className="h-3.5 w-3.5" />
                  ) : (
                    <Timer className="h-3.5 w-3.5" />
                  )}
                  <span className="hidden sm:inline">
                    {BURN_MODES.find((m) => m.value === burnMode)?.label ?? "Lifetime"}
                  </span>
                </button>
                {expiryOpen && (
                  <>
                    <button
                      aria-label="Close menu"
                      className="fixed inset-0 z-30 cursor-default"
                      onClick={() => setExpiryOpen(false)}
                    />
                    <div
                      role="menu"
                      className="absolute right-0 z-40 mt-1.5 w-56 overflow-hidden rounded-xl border border-border/80 bg-card/95 p-1 shadow-card backdrop-blur-md"
                    >
                      {BURN_MODES.map((m) => (
                        <button
                          key={m.value}
                          role="menuitemradio"
                          aria-checked={burnMode === m.value}
                          disabled={expirySaving}
                          onClick={() => changeExpiry(m.value)}
                          className={`flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-light transition-colors hover:bg-primary/5 ${
                            burnMode === m.value ? "bg-primary/10" : ""
                          }`}
                        >
                          <span className="mt-0.5">
                            {m.value === "after_read" ? (
                              <Flame className="h-3 w-3" />
                            ) : (
                              <Timer className="h-3 w-3" />
                            )}
                          </span>
                          <span className="flex-1">
                            <span className="block font-medium text-foreground">{m.label}</span>
                            <span className="block text-[11px] text-muted-foreground">{m.hint}</span>
                          </span>
                          {burnMode === m.value && <Check className="mt-0.5 h-3 w-3 text-primary" />}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
            <ThemeToggle />
          </div>
        </div>
        {burnMode !== "never" && (
          <div className="border-t border-border/70 bg-ember/5 px-4 py-1.5 text-center text-[11px] font-light text-ember sm:px-6 lg:px-10">
            {burnMode === "after_read" ? (
              <span className="inline-flex items-center gap-1.5">
                <Flame className="h-3 w-3" /> Burn after read — page self-destructs after the next visit.
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5">
                <AlertTriangle className="h-3 w-3" /> Expires{" "}
                {expiresAt ? new Date(expiresAt).toLocaleString() : ""}
                {expiresAt && (
                  <>
                    {" · "}
                    <ExpiryCountdown iso={expiresAt} />
                  </>
                )}
              </span>
            )}
          </div>
        )}
      </header>

      <main className="mx-auto flex w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-10 lg:px-10">
        {!focus && (
          <div data-editor-outline="true">
            <Outline text={text} textareaRef={textareaRef} />
          </div>
        )}
        <div className="mx-auto flex w-full max-w-[800px] flex-1 flex-col">
          {preview ? (
            <article
              className="prose prose-neutral dark:prose-invert reading-mode min-h-[60vh] max-w-none break-words text-[17px] leading-[1.75]"
              // eslint-disable-next-line react/no-danger
              dangerouslySetInnerHTML={{ __html: html }}
            />
          ) : (
            <textarea
              ref={textareaRef}
              data-editor-textarea="true"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Start writing… Markdown is supported. Auto-saves as you type."
              spellCheck
              autoFocus
              className="min-h-[60vh] w-full flex-1 resize-none border-0 bg-transparent font-serif text-[17px] font-light leading-[1.75] text-foreground outline-none placeholder:text-muted-foreground/50 sm:text-lg"
            />
          )}

          {!focus && (
            <div className="mt-8" data-editor-attachments="true">
              <AttachmentsPanel slug={slug} cryptoKey={cryptoKey} editToken={editToken} />
            </div>
          )}
        </div>
      </main>


      <footer
        data-editor-chrome="true"
        className="border-t border-border/70 bg-background/85 backdrop-blur-md"
      >
        <div className={`${HEADER_INNER} py-2 font-mono text-[11px] font-light uppercase tracking-[0.14em] text-muted-foreground`}>
          <div className="flex items-center gap-3">
            <span>{wordCount.toLocaleString()} words</span>
            <span className="hidden sm:inline">·</span>
            <span className="hidden sm:inline">{readingMinutes} min read</span>
            {canSave && sessionWords > 0 && (
              <>
                <span className="hidden sm:inline">·</span>
                <span className="hidden text-primary sm:inline">
                  +{sessionWords.toLocaleString()} this session
                </span>
              </>
            )}
            <span className="hidden md:inline">·</span>
            <span className="hidden md:inline">{charCount.toLocaleString()} chars</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline">
              Updated <RelTime iso={updatedAt} />
            </span>
            <span className="inline-flex items-center gap-1">
              <ShieldCheck className="h-3 w-3 text-primary" /> End-to-end encrypted
            </span>
          </div>
        </div>
      </footer>

      {findOpen && (
        <FindReplace
          text={text}
          onReplace={(next) => setText(next)}
          onClose={() => setFindOpen(false)}
          textareaRef={textareaRef}
          initialMode={findMode}
        />
      )}

      <DonateRibbon sessionWords={sessionWords} visits={visits} />
      </div>
    </NoteShell>
  );
}

function StatusPill({ status }: { status: SaveStatus }) {
  const map: Record<SaveStatus, { label: string; icon: React.ReactNode; cls: string }> = {
    idle: { label: "Ready", icon: <Check className="h-3 w-3" />, cls: "bg-muted text-muted-foreground" },
    dirty: { label: "Unsaved", icon: <Pencil className="h-3 w-3" />, cls: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
    saving: { label: "Saving…", icon: <Loader2 className="h-3 w-3 animate-spin" />, cls: "bg-primary/10 text-primary" },
    saved: { label: "Saved", icon: <Check className="h-3 w-3" />, cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
    error: { label: "Save failed", icon: <CloudOff className="h-3 w-3" />, cls: "bg-destructive/15 text-destructive" },
  };
  const v = map[status];
  return (
    <span className={`inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 font-mono text-[10px] uppercase tracking-[0.12em] ${v.cls}`}>
      {v.icon} {v.label}
    </span>
  );
}

function RelTime({ iso }: { iso: string }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 15_000);
    return () => clearInterval(id);
  }, []);
  const label = useMemo(() => {
    const d = new Date(iso).getTime();
    if (Number.isNaN(d)) return "";
    const diff = (Date.now() - d) / 1000;
    if (diff < 5) return "just now";
    if (diff < 60) return `${Math.floor(diff)}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return new Date(iso).toLocaleDateString();
  }, [iso]);
  return <span>{label}</span>;
}

function formatRemaining(ms: number): string {
  if (ms <= 0) return "expired";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

function useNow(intervalMs: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function ExpiryCountdown({ iso }: { iso: string }) {
  const now = useNow(1000);
  const remaining = new Date(iso).getTime() - now;
  return <span>{formatRemaining(remaining)} left</span>;
}

function ExpiryPill({ burnMode, expiresAt }: { burnMode: BurnMode; expiresAt: string | null }) {
  const now = useNow(1000);
  if (burnMode === "never") {
    return (
      <span className="hidden md:inline-flex h-7 items-center gap-1.5 rounded-full bg-muted px-2.5 text-[11px] font-medium text-muted-foreground">
        <Timer className="h-3 w-3" /> Never expires
      </span>
    );
  }
  if (burnMode === "after_read") {
    return (
      <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-rose-500/15 px-2.5 text-[11px] font-medium text-rose-700 dark:text-rose-300">
        <Flame className="h-3 w-3" /> Burn after read
      </span>
    );
  }
  const remaining = expiresAt ? new Date(expiresAt).getTime() - now : 0;
  const urgent = remaining < 60 * 60 * 1000;
  return (
    <span
      className={`inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-medium ${
        urgent
          ? "bg-destructive/15 text-destructive"
          : "bg-amber-500/15 text-amber-700 dark:text-amber-300"
      }`}
      title={expiresAt ? `Expires ${new Date(expiresAt).toLocaleString()}` : undefined}
    >
      <Timer className="h-3 w-3" /> {formatRemaining(remaining)}
    </span>
  );
}

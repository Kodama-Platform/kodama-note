import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { History, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { decrypt } from "@/lib/crypto";
import { listVersions, type VersionRow } from "@/lib/pages";

export function VersionHistory({
  slug,
  cryptoKey,
  onRestore,
}: {
  slug: string;
  cryptoKey: CryptoKey;
  onRestore?: (plaintext: string, label: string) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<VersionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<{ id: string; text: string; label: string } | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    setPreview(null);
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      setRows(await listVersions(slug));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, slug]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  const view = async (v: VersionRow, label: string) => {
    try {
      const pt = await decrypt(cryptoKey, v.ciphertext, v.iv);
      setPreview({ id: v.id, text: pt, label });
    } catch {
      toast.error("Could not decrypt this version");
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-8 items-center gap-1.5 rounded-full bg-accent px-3 text-xs font-medium text-foreground hover:bg-accent/70"
      >
        <History className="h-3.5 w-3.5" /> History
      </button>

      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-4 backdrop-blur"
            onClick={close}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="version-history-title"
              className="flex h-[80vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-soft"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-border px-5 py-3">
                <h2
                  id="version-history-title"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-foreground"
                >
                  <History className="h-4 w-4" /> Version history
                </h2>
                <button
                  type="button"
                  onClick={close}
                  className="-mr-1 rounded-full p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            <div className="grid flex-1 grid-cols-1 overflow-hidden sm:grid-cols-[16rem,1fr]">
              <aside className="overflow-y-auto border-b border-border sm:border-b-0 sm:border-r">
                {loading ? (
                  <div className="flex items-center gap-2 p-4 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
                  </div>
                ) : rows.length === 0 ? (
                  <p className="p-4 text-xs text-muted-foreground">No versions yet. Edit the page to create one.</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {rows.map((r, i) => {
                      const versionNumber = rows.length - i; // oldest = 1
                      const label = `version ${versionNumber}`;
                      return (
                        <li key={r.id}>
                          <button
                            onClick={() => view(r, label)}
                            className={`block w-full px-4 py-3 text-left text-xs transition-colors hover:bg-accent ${
                              preview?.id === r.id ? "bg-accent" : ""
                            }`}
                          >
                            <div className="flex items-center justify-between font-medium text-foreground">
                              <span>{label}</span>
                              {i === 0 && (
                                <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
                                  latest
                                </span>
                              )}
                            </div>
                            <div className="mt-0.5 text-muted-foreground">
                              {new Date(r.created_at).toLocaleString()}
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </aside>
              <section className="overflow-y-auto p-5">
                {preview ? (
                  <>
                    <pre className="whitespace-pre-wrap break-words text-sm text-foreground">
                      {preview.text || <span className="text-muted-foreground">(empty)</span>}
                    </pre>
                    {onRestore && (
                      <button
                        onClick={async () => {
                          const { text, label } = preview;
                          close();
                          try {
                            // Editor shows the success toast after the append succeeds.
                            await onRestore(text, label);
                          } catch (e) {
                            toast.error((e as Error).message || "Restore failed");
                          }
                        }}
                        className="mt-5 inline-flex h-9 items-center justify-center rounded-full bg-primary px-4 text-xs font-semibold text-primary-foreground hover:opacity-90"
                      >
                        Restore this version
                      </button>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">Select a version to preview.</p>
                )}
              </section>
            </div>
          </div>
          </div>,
          document.body,
        )}
    </>
  );
}

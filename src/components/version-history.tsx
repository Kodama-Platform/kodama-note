import { useCallback, useEffect, useState } from "react";

import { createPortal } from "react-dom";

import { History, Loader2, X } from "lucide-react";

import { toast } from "sonner";



import { decryptStoredPageCiphertext, type PlaceCryptoSession } from "@/lib/crypto-context";

import { listVersions, type VersionRow } from "@/lib/pages";

import type { ExistingPage } from "@/lib/page-query";



export function VersionHistory({

  slug,

  crypto,

  page,

  onRestore,

}: {

  slug: string;

  crypto: PlaceCryptoSession;

  page: Pick<ExistingPage, "slug" | "salt" | "kdf_params">;

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

      const pt = await decryptStoredPageCiphertext(crypto, v.ciphertext, v.iv, page);

      setPreview({ id: v.id, text: pt, label });

    } catch {

      toast.error("Could not decrypt this version");

    }

  };



  return (

    <>

      <button

        onClick={() => setOpen((v) => !v)}

        className="note-toolbar-btn"

      >

        <History className="h-3.5 w-3.5" /> <span className="hidden sm:inline">History</span>

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

              className="flex h-[80vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border/80 bg-card/95 shadow-card backdrop-blur-md"

              onClick={(e) => e.stopPropagation()}

            >

              <div className="flex items-center justify-between border-b border-border px-5 py-3">

                <h2

                  id="version-history-title"

                  className="inline-flex items-center gap-2 font-display text-base font-light text-foreground"

                >

                  <History className="h-4 w-4" /> Version history

                </h2>

                <button

                  type="button"

                  onClick={close}

                  className="-mr-1 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-primary/5 hover:text-foreground"

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

                      const versionNumber = rows.length - i;

                      const label = `version ${versionNumber}`;

                      return (

                        <li key={r.id}>

                          <button

                            onClick={() => view(r, label)}

                            className={`block w-full px-4 py-3 text-left text-xs font-light transition-colors hover:bg-primary/5 ${

                              preview?.id === r.id ? "bg-primary/10" : ""

                            }`}

                          >

                            <div className="flex items-center justify-between font-medium text-foreground">

                              <span>{label}</span>

                              {i === 0 && (

                                <span className="note-badge !px-1.5 !py-0.5 !text-[10px] !normal-case !tracking-normal">

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

                            await onRestore(text, label);

                          } catch (e) {

                            toast.error((e as Error).message || "Restore failed");

                          }

                        }}

                        className="btn-moss mt-5 inline-flex h-9 items-center justify-center !px-4 !py-0 !text-xs"

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



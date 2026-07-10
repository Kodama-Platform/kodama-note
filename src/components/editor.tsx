import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Check,
  CloudOff,
  Flame,
  Loader2,
  Menu,
  Pencil,
  RotateCcw,
  Save,
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
import { EditorMobileMenu } from "@/components/editor-mobile-menu";
import { EditorMoreMenu } from "@/components/editor-more-menu";
import { FindReplace } from "@/components/find-replace";
import { MarkdownView } from "@/components/markdown-view";
import { Outline } from "@/components/outline";
import { RichEditor, type RichEditorHandle } from "@/components/rich-editor";
import { DonateRibbon, useVisitCount } from "@/components/donate-ribbon";
import { SheetTabBar } from "@/components/sheet-tab-bar";
import { UnsavedChangesDialog } from "@/components/unsaved-changes-dialog";
import { invalidateAttachmentList, prefetchAttachmentList } from "@/lib/attachment-list";
import { encrypt } from "@/lib/crypto";
import { getSaveMode, setSaveMode, type SaveMode } from "@/lib/save-mode";
import { setSheetHash } from "@/lib/hash-params";
import { deleteAttachment, savePage, updateExpiry, type BurnMode } from "@/lib/pages";
import { flushActiveSheetMarkdown } from "@/lib/workbook-flush";
import { getPlanTier } from "@/lib/plan-tier";
import {
  addSheet,
  addSheetAttachment,
  collectSheetAttachmentRefs,
  deleteSheet,
  getActiveSheetMarkdown,
  getOrderedSheets,
  getSheetAttachmentIds,
  getSheetAttachmentIdsForDelete,
  getSheetById,
  parseWorkbook,
  pickAdjacentSheetId,
  renameSheet,
  reorderSheets,
  serializeWorkbook,
  updateActiveSheetMarkdown,
  WorkbookError,
  writeLastOpenedSheet,
  workbookUsesAttachments,
  type WorkbookPayload,
} from "@/lib/workbook";


type SaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";

type LeavePrompt = { kind: "home" } | { kind: "reload" };

export function Editor({
  slug,
  initialWorkbook,
  initialActiveSheetId,
  initialUpdatedAt,
  cryptoKey,
  editToken,
  burnMode: initialBurnMode,
  expiresAt: initialExpiresAt,
}: {
  slug: string;
  initialWorkbook: WorkbookPayload;
  initialActiveSheetId: string;
  initialUpdatedAt: string;
  cryptoKey: CryptoKey;
  editToken: string | null;
  burnMode: BurnMode;
  expiresAt: string | null;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canSave = !!editToken;
  const [saveMode, setSaveModeState] = useState<SaveMode>(() => getSaveMode());
  const [saveModeOpen, setSaveModeOpen] = useState(false);
  const [leavePrompt, setLeavePrompt] = useState<LeavePrompt | null>(null);
  const [leaveSaving, setLeaveSaving] = useState(false);
  const [workbook, setWorkbook] = useState(initialWorkbook);
  const [activeSheetId, setActiveSheetId] = useState(initialActiveSheetId);
  const [switchingSheet, setSwitchingSheet] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(initialUpdatedAt);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [burnMode, setBurnMode] = useState<BurnMode>(initialBurnMode);
  const [expiresAt, setExpiresAt] = useState<string | null>(initialExpiresAt);
  const [expirySaving, setExpirySaving] = useState(false);
  const [focus, setFocus] = useState(false);
  const [markdownView, setMarkdownView] = useState(false);
  const [viewMarkdown, setViewMarkdown] = useState("");
  const [findOpen, setFindOpen] = useState(false);
  const [findMode, setFindMode] = useState<"find" | "replace">("find");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const initialSerialized = useMemo(() => serializeWorkbook(initialWorkbook), [initialWorkbook]);
  const [lastSavedSerialized, setLastSavedSerialized] = useState(initialSerialized);
  const lastSavedRef = useRef(initialSerialized);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const richEditorRef = useRef<RichEditorHandle | null>(null);
  const editorSyncedRef = useRef(false);
  const workbookRef = useRef(workbook);
  workbookRef.current = workbook;
  const planTier = useMemo(() => getPlanTier(), []);
  const activeSheet = useMemo(
    () => getSheetById(workbook, activeSheetId),
    [workbook, activeSheetId],
  );
  const activeAttachmentIds = useMemo(() => {
    if (!activeSheet) return new Set<string>();
    const ids = getSheetAttachmentIds(activeSheet);
    for (const id of collectSheetAttachmentRefs(getActiveSheetMarkdown(workbook, activeSheetId))) {
      ids.add(id);
    }
    return ids;
  }, [activeSheet, activeSheetId, workbook]);
  const activeMarkdown = useMemo(
    () => getActiveSheetMarkdown(workbook, activeSheetId),
    [workbook, activeSheetId],
  );
  const initialWordsRef = useRef<number>(
    activeMarkdown.trim() ? activeMarkdown.trim().split(/\s+/).length : 0,
  );
  const visits = useVisitCount(slug);
  const headerScrolled = useHeaderScrolled();
  const needsAttachmentList = useMemo(() => workbookUsesAttachments(workbook), [workbook]);

  useEffect(() => {
    if (needsAttachmentList) {
      prefetchAttachmentList(slug, queryClient);
    }
  }, [needsAttachmentList, queryClient, slug]);

  useEffect(() => {
    editorSyncedRef.current = false;
  }, [activeSheetId]);

  const flushWorkbook = useCallback(
    (base?: WorkbookPayload) =>
      flushActiveSheetMarkdown(base ?? workbook, activeSheetId, richEditorRef),
    [workbook, activeSheetId],
  );

  const changeSaveMode = useCallback((mode: SaveMode) => {
    setSaveModeState(mode);
    setSaveMode(mode);
    setSaveModeOpen(false);
    toast.success(mode === "auto" ? "Auto-save enabled" : "Manual save enabled");
  }, []);

  const toggleMarkdownView = useCallback(() => {
    setMarkdownView((on) => {
      if (!on) {
        const flushed = flushWorkbook();
        setWorkbook(flushed);
        setViewMarkdown(getActiveSheetMarkdown(flushed, activeSheetId));
        setFocus(false);
        setFindOpen(false);
        return true;
      }
      return false;
    });
  }, [activeSheetId, flushWorkbook]);


  const changeExpiry = useCallback(
    async (mode: BurnMode) => {
      if (!editToken || mode === burnMode) {
        return;
      }
      setExpirySaving(true);
      try {
        const res = await updateExpiry({ slug, edit_token: editToken, burn_mode: mode });
        setBurnMode(res.burn_mode);
        setExpiresAt(res.expires_at);
        toast.success("Lifetime updated");
      } catch (e) {
        toast.error((e as Error).message);
      } finally {
        setExpirySaving(false);
      }
    },
    [burnMode, editToken, slug],
  );

  const serializedWorkbook = useMemo(() => {
    try {
      return serializeWorkbook(workbook);
    } catch {
      return lastSavedRef.current;
    }
  }, [workbook]);

  const isDirty = useMemo(
    () => serializedWorkbook !== lastSavedSerialized,
    [serializedWorkbook, lastSavedSerialized],
  );

  const markSaved = useCallback((plaintext: string, payload: WorkbookPayload) => {
    lastSavedRef.current = plaintext;
    setLastSavedSerialized(plaintext);
    setWorkbook(payload);
    setStatus("saved");
  }, []);

  const save = useCallback(
    async (opts?: { force?: boolean; workbook?: WorkbookPayload }): Promise<boolean> => {
      if (!editToken) return false;
      const payload = flushWorkbook(opts?.workbook);
      let plaintext: string;
      try {
        plaintext = serializeWorkbook(payload);
      } catch (e) {
        setStatus("error");
        const code = e instanceof WorkbookError ? e.code : (e as Error).message;
        toast.error(
          code === "workbook_too_large" || code === "sheet_too_large"
            ? "Workbook is too large to save"
            : (e as Error).message,
        );
        return false;
      }
      if (!opts?.force && plaintext === lastSavedRef.current) {
        markSaved(plaintext, payload);
        return true;
      }
      setStatus("saving");
      try {
        const { ciphertext, iv } = await encrypt(cryptoKey, plaintext);
        const res = await savePage({ slug, edit_token: editToken, ciphertext, iv });
        markSaved(plaintext, payload);
        setUpdatedAt(res.created_at);
        return true;
      } catch (e) {
        setStatus("error");
        toast.error((e as Error).message);
        return false;
      }
    },
    [cryptoKey, editToken, flushWorkbook, markSaved, slug],
  );

  const applyLastSaved = useCallback(() => {
    const restored = parseWorkbook(lastSavedRef.current);
    setWorkbook(restored);
    const sheetId = restored.primary_sheet_id;
    setActiveSheetId(sheetId);
    writeLastOpenedSheet(slug, sheetId);
    setSheetHash(sheetId);
    setStatus("idle");
  }, [slug]);

  const handleLeaveSave = useCallback(async () => {
    setLeaveSaving(true);
    const ok = await save();
    setLeaveSaving(false);
    if (!ok) return;
    const kind = leavePrompt?.kind;
    setLeavePrompt(null);
    if (kind === "home") {
      navigate({ to: "/" });
    } else {
      toast.success("Changes saved");
    }
  }, [leavePrompt, navigate, save]);

  const handleLeaveDiscard = useCallback(() => {
    const kind = leavePrompt?.kind;
    setLeavePrompt(null);
    setLeaveSaving(false);
    if (kind === "reload") {
      applyLastSaved();
      toast.success("Reloaded last saved version");
    } else if (kind === "home") {
      navigate({ to: "/" });
    }
  }, [applyLastSaved, leavePrompt, navigate]);

  const handleReload = useCallback(() => {
    if (!canSave) return;
    if (isDirty) {
      setLeavePrompt({ kind: "reload" });
      return;
    }
    applyLastSaved();
    toast.success("Reloaded last saved version");
  }, [applyLastSaved, canSave, isDirty]);

  const switchSheet = useCallback(
    async (nextSheetId: string, wb?: WorkbookPayload) => {
      if (nextSheetId === activeSheetId || switchingSheet) return;
      setSwitchingSheet(true);
      try {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }

        const base = wb ?? workbook;
        const flushed = flushWorkbook(base);

        if (canSave && saveMode === "auto") {
          try {
            const serialized = serializeWorkbook(flushed);
            if (serialized !== lastSavedRef.current) {
              await save({ workbook: flushed });
            }
          } catch (e) {
            if (e instanceof WorkbookError) {
              toast.error("Workbook is too large to save");
            }
          }
        }

        setWorkbook(flushed);
        setActiveSheetId(nextSheetId);
        writeLastOpenedSheet(slug, nextSheetId);
        setSheetHash(nextSheetId);
      } finally {
        setSwitchingSheet(false);
      }
    },
    [activeSheetId, canSave, flushWorkbook, save, saveMode, slug, switchingSheet, workbook],
  );

  const handleMarkdownChange = useCallback(
    (markdown: string) => {
      setWorkbook((prev) => updateActiveSheetMarkdown(prev, activeSheetId, markdown));
    },
    [activeSheetId],
  );

  const handleEditorBaseline = useCallback(
    (markdown: string) => {
      try {
        const updated = updateActiveSheetMarkdown(workbookRef.current, activeSheetId, markdown);
        const serialized = serializeWorkbook(updated);
        lastSavedRef.current = serialized;
        editorSyncedRef.current = true;
        setLastSavedSerialized(serialized);
        setWorkbook(updated);
        setStatus("idle");
      } catch {
        /* keep prior baseline */
      }
    },
    [activeSheetId],
  );

  const handleAddSheet = useCallback(() => {
    try {
      const next = addSheet(workbook);
      const newSheet = getOrderedSheets(next).at(-1)!;
      setWorkbook(next);
      void switchSheet(newSheet.sheet_id, next);
    } catch (e) {
      toast.error(e instanceof WorkbookError ? "Maximum sheets reached" : (e as Error).message);
    }
  }, [switchSheet, workbook]);

  const handleRenameSheet = useCallback((sheetId: string, title: string) => {
    setWorkbook((prev) => renameSheet(prev, sheetId, title));
  }, []);

  const handleAttachmentAdded = useCallback(
    (id: string) => {
      setWorkbook((prev) => addSheetAttachment(prev, activeSheetId, id));
    },
    [activeSheetId],
  );

  const handleDeleteSheet = useCallback(
    async (sheetId: string) => {
      try {
        let wb = workbook;
        if (sheetId === activeSheetId && getSheetById(wb, activeSheetId)) {
          const currentMd =
            richEditorRef.current?.getMarkdown() ??
            getActiveSheetMarkdown(wb, activeSheetId);
          wb = updateActiveSheetMarkdown(wb, activeSheetId, currentMd);
        }
        const idsToDelete = getSheetAttachmentIdsForDelete(wb, sheetId);
        if (editToken && idsToDelete.length > 0) {
          const results = await Promise.allSettled(
            idsToDelete.map((attachment_id) =>
              deleteAttachment({ slug, edit_token: editToken, attachment_id }),
            ),
          );
          const failed = results.filter((r) => r.status === "rejected").length;
          if (failed > 0) {
            toast.error(`Could not delete ${failed} attachment(s) from storage`);
          }
          invalidateAttachmentList(slug, queryClient);
        }
        const focusId =
          sheetId === activeSheetId ? pickAdjacentSheetId(wb, sheetId) : activeSheetId;
        const next = deleteSheet(wb, sheetId);
        setWorkbook(next);
        if (sheetId === activeSheetId) {
          void switchSheet(focusId, next);
        }
      } catch (e) {
        toast.error((e as Error).message);
      }
    },
    [activeSheetId, editToken, queryClient, slug, switchSheet, workbook],
  );

  const handleReorderSheets = useCallback((orderedIds: string[]) => {
    setWorkbook((prev) => reorderSheets(prev, orderedIds));
  }, []);

  useEffect(() => {
    if (!markdownView) return;
    setViewMarkdown(getActiveSheetMarkdown(workbook, activeSheetId));
  }, [activeSheetId, markdownView, workbook]);

  // Debounced auto-save (auto mode only)
  useEffect(() => {
    if (!canSave) return;
    if (!isDirty) {
      setStatus((s) => (s === "saving" ? "saving" : s === "saved" ? "saved" : "idle"));
      return;
    }
    setStatus((s) => (s === "saving" ? "saving" : "dirty"));
    if (saveMode !== "auto") return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void save();
    }, 1200);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [serializedWorkbook, canSave, isDirty, save, saveMode]);

  // Warn before closing tab or leaving the site
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!canSave || !editorSyncedRef.current || !isDirty || status === "saving") return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [canSave, isDirty, status]);

  // Keyboard shortcuts + command palette events
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const k = e.key.toLowerCase();
      if (mod && k === "s") {
        e.preventDefault();
        void save();
      } else if (mod && k === "f") {
        e.preventDefault();
        setFindMode("find");
        setFindOpen(true);
      } else if (mod && e.shiftKey && k === "h") {
        e.preventDefault();
        setFindMode("replace");
        setFindOpen(true);
      } else if (mod && e.shiftKey && k === "m") {
        e.preventDefault();
        toggleMarkdownView();
      } else if (mod && e.shiftKey && k === "c") {
        e.preventDefault();
        navigator.clipboard
          .writeText(window.location.origin + "/" + slug)
          .then(() => toast.success("Link copied"))
          .catch(() => toast.error("Couldn't copy link"));
      } else if (k === "escape") {
        if (findOpen) setFindOpen(false);
        else if (markdownView) setMarkdownView(false);
        else if (focus) setFocus(false);
      }
    };
    const onFocusEvt = () => {
      setFocus((v) => !v);
      setMarkdownView(false);
    };
    const onMarkdownViewEvt = () => toggleMarkdownView();
    window.addEventListener("keydown", onKey);
    window.addEventListener("kodama:toggle-focus", onFocusEvt);
    window.addEventListener("kodama:toggle-markdown-view", onMarkdownViewEvt);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("kodama:toggle-focus", onFocusEvt);
      window.removeEventListener("kodama:toggle-markdown-view", onMarkdownViewEvt);
    };
  }, [save, findOpen, focus, markdownView, slug, toggleMarkdownView]);

  const charCount = activeMarkdown.length;
  const wordCount = useMemo(
    () => (activeMarkdown.trim() ? activeMarkdown.trim().split(/\s+/).length : 0),
    [activeMarkdown],
  );
  const sessionWords = Math.max(0, wordCount - initialWordsRef.current);
  const readingMinutes = Math.max(1, Math.round(wordCount / 200));


  return (
    <NoteShell showHeader={false} footer={false} fillViewport className={focus ? "focus-mode" : ""}>
      <div className={`flex h-full min-h-0 flex-col overflow-hidden ${HEADER_OFFSET}`}>
      <header
        data-editor-chrome="true"
        className={headerShellClass(headerScrolled, mobileMenuOpen || moreMenuOpen || saveModeOpen)}
      >

        <div className={HEADER_INNER}>
          <Link
            to="/"
            onClick={(e) => {
              if (!canSave || !isDirty) return;
              e.preventDefault();
              setLeavePrompt({ kind: "home" });
            }}
            className={`${headerLogoClass()} min-w-0 flex-1 md:flex-none`}
          >
            <KodamaMark size={24} className={`${headerLogoMarkClass()} shrink-0`} />
            <span className={headerLogoTextClass()}>
              <span className="hidden md:inline">Kodama Note</span>
              <span className="text-muted-foreground">/{slug}</span>
            </span>
          </Link>

          {/* Mobile: status + quick save + menu */}
          <div className="flex shrink-0 items-center gap-1 md:hidden">
            {canSave && saveMode === "manual" && (
              <button
                type="button"
                onClick={() => void save()}
                disabled={status === "saving" || !isDirty}
                className="note-toolbar-btn !h-9 !w-9 !px-0 !text-primary disabled:opacity-40"
                aria-label="Save"
                title="Save"
              >
                <Save className="h-4 w-4" />
              </button>
            )}
            {canSave && <StatusPill status={status} isDirty={isDirty} compact />}
            <button
              type="button"
              onClick={() => {
                setSaveModeOpen(false);
                setMoreMenuOpen(false);
                setMobileMenuOpen(true);
              }}
              className="note-toolbar-btn !h-9 !w-9 !px-0"
              aria-label="Open note menu"
              aria-expanded={mobileMenuOpen}
            >
              <Menu className="h-4 w-4" />
            </button>
          </div>

          {/* Desktop toolbar */}
          <div className="hidden items-center gap-1.5 md:flex">
            {canSave && (
              <>
                {saveMode === "manual" && (
                  <>
                    <button
                      type="button"
                      onClick={() => void save()}
                      disabled={status === "saving" || !isDirty}
                      className="note-toolbar-btn !text-primary disabled:opacity-50"
                      title="Save workbook (⌘S)"
                    >
                      <Save className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Save</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleReload}
                      disabled={status === "saving"}
                      className="note-toolbar-btn"
                      title="Reload last saved version"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Reload</span>
                    </button>
                  </>
                )}
                <StatusPill status={status} isDirty={isDirty} />
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setSaveModeOpen((v) => !v)}
                    className="note-toolbar-btn"
                    aria-haspopup="menu"
                    aria-expanded={saveModeOpen}
                    title="Save mode"
                  >
                    <Save className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">
                      {saveMode === "auto" ? "Auto-save" : "Manual"}
                    </span>
                  </button>
                  {saveModeOpen && (
                    <>
                      <button
                        aria-label="Close menu"
                        className="fixed inset-0 z-30 cursor-default"
                        onClick={() => setSaveModeOpen(false)}
                      />
                      <div
                        role="menu"
                        className="absolute right-0 z-40 mt-1.5 w-52 overflow-hidden rounded-xl border border-border/80 bg-card/95 p-1 shadow-card backdrop-blur-md"
                      >
                        <button
                          type="button"
                          role="menuitemradio"
                          aria-checked={saveMode === "auto"}
                          onClick={() => changeSaveMode("auto")}
                          className={`flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-light transition-colors hover:bg-primary/5 ${
                            saveMode === "auto" ? "bg-primary/10" : ""
                          }`}
                        >
                          <span className="flex-1">
                            <span className="block font-medium text-foreground">Auto-save</span>
                            <span className="block text-[11px] text-muted-foreground">
                              Save changes automatically
                            </span>
                          </span>
                          {saveMode === "auto" && <Check className="mt-0.5 h-3 w-3 text-primary" />}
                        </button>
                        <button
                          type="button"
                          role="menuitemradio"
                          aria-checked={saveMode === "manual"}
                          onClick={() => changeSaveMode("manual")}
                          className={`flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-light transition-colors hover:bg-primary/5 ${
                            saveMode === "manual" ? "bg-primary/10" : ""
                          }`}
                        >
                          <span className="flex-1">
                            <span className="block font-medium text-foreground">Manual save</span>
                            <span className="block text-[11px] text-muted-foreground">
                              Save all sheets when you choose
                            </span>
                          </span>
                          {saveMode === "manual" && (
                            <Check className="mt-0.5 h-3 w-3 text-primary" />
                          )}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </>
            )}
            <ExpiryPill burnMode={burnMode} expiresAt={expiresAt} />
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
              <span className="hidden lg:inline">Find</span>
            </button>
            <EditorMoreMenu
              canEdit={!!editToken}
              focus={focus}
              markdownView={markdownView}
              burnMode={burnMode}
              expirySaving={expirySaving}
              slug={slug}
              workbook={workbook}
              activeSheetTitle={
                workbook.sheets.find((s) => s.sheet_id === activeSheetId)?.title ?? "sheet"
              }
              getActiveText={() => richEditorRef.current?.getMarkdown() ?? activeMarkdown}
              onToggleFocus={() => {
                setFocus((v) => !v);
                setMarkdownView(false);
              }}
              onToggleMarkdownView={toggleMarkdownView}
              onChangeExpiry={changeExpiry}
              onOpenChange={setMoreMenuOpen}
            />
            <ThemeToggle />
          </div>
        </div>

        <EditorMobileMenu
          open={mobileMenuOpen}
          onClose={() => setMobileMenuOpen(false)}
          canSave={canSave}
          saveMode={saveMode}
          status={status}
          isDirty={isDirty}
          burnMode={burnMode}
          expiresAt={expiresAt}
          findOpen={findOpen}
          focus={focus}
          markdownView={markdownView}
          expirySaving={expirySaving}
          slug={slug}
          workbook={workbook}
          activeSheetTitle={
            workbook.sheets.find((s) => s.sheet_id === activeSheetId)?.title ?? "sheet"
          }
          getActiveText={() => richEditorRef.current?.getMarkdown() ?? activeMarkdown}
          onSave={() => void save()}
          onReload={handleReload}
          onChangeSaveMode={changeSaveMode}
          onToggleFind={() => {
            setFindMode("find");
            setFindOpen((v) => !v);
          }}
          onToggleFocus={() => {
            setFocus((v) => !v);
            setMarkdownView(false);
          }}
          onToggleMarkdownView={toggleMarkdownView}
          onChangeExpiry={changeExpiry}
        />

        {burnMode !== "never" && (
          <div className="border-t border-border/70 bg-ember/5 px-3 py-1 text-center text-[10px] font-light text-ember sm:px-6 sm:py-1.5 sm:text-[11px] lg:px-10">
            {burnMode === "after_read" ? (
              <span className="inline-flex items-center gap-1.5">
                <Flame className="h-3 w-3 shrink-0" />
                <span className="sm:hidden">Burn after read</span>
                <span className="hidden sm:inline">
                  Burn after read — page self-destructs after the next visit.
                </span>
              </span>
            ) : (
              <span className="inline-flex flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5">
                <AlertTriangle className="h-3 w-3 shrink-0" />
                <span className="sm:hidden">
                  Expires {expiresAt ? <ExpiryCountdown iso={expiresAt} /> : "soon"}
                </span>
                <span className="hidden sm:inline">
                  Expires {expiresAt ? new Date(expiresAt).toLocaleString() : ""}
                  {expiresAt && (
                    <>
                      {" · "}
                      <ExpiryCountdown iso={expiresAt} />
                    </>
                  )}
                </span>
              </span>
            )}
          </div>
        )}
      </header>

      <main className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 overflow-hidden px-4 py-4 sm:px-6 sm:py-6 lg:px-10">
        {!focus && !markdownView && (
          <Outline
            text={activeMarkdown}
            onJumpToHeading={(heading) => richEditorRef.current?.scrollToHeading(heading)}
          />
        )}
        <div className="mx-auto flex min-h-0 w-full max-w-[800px] flex-1 flex-col">
          <SheetTabBar
            sheets={workbook.sheets}
            activeSheetId={activeSheetId}
            canEdit={canSave}
            switching={switchingSheet || (saveMode === "auto" && status === "saving")}
            onSelect={(id) => void switchSheet(id)}
            onAdd={handleAddSheet}
            onRename={handleRenameSheet}
            onDelete={(id) => void handleDeleteSheet(id)}
            onReorder={handleReorderSheets}
          />
          <div
            data-editor-scroll="true"
            className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden pr-1"
          >
            {markdownView ? (
              <MarkdownView
                markdown={viewMarkdown}
                sheetTitle={
                  workbook.sheets.find((s) => s.sheet_id === activeSheetId)?.title ?? "sheet"
                }
              />
            ) : null}
            <div className={markdownView ? "hidden" : undefined}>
              <RichEditor
                key={activeSheetId}
                ref={richEditorRef}
                initialContent={activeMarkdown}
                onMarkdownChange={handleMarkdownChange}
                onBaseline={handleEditorBaseline}
                slug={slug}
                cryptoKey={cryptoKey}
                editToken={editToken}
                allowedAttachmentIds={activeAttachmentIds}
                planTier={planTier}
                sheetAttachmentCount={activeAttachmentIds.size}
                onAttachmentAdded={handleAttachmentAdded}
                focusMode={focus}
              />

              {!focus && (
                <div className="mt-8" data-editor-attachments="true">
                  <AttachmentsPanel
                    slug={slug}
                    cryptoKey={cryptoKey}
                    editToken={editToken}
                    sheetMarkdown={activeMarkdown}
                    sheetAttachmentIds={activeAttachmentIds}
                    planTier={planTier}
                    onAttachmentAdded={handleAttachmentAdded}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </main>


      <footer
        data-editor-chrome="true"
        className="shrink-0 border-t border-border/70 bg-background/85 backdrop-blur-md"
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
          contentKey={activeMarkdown}
          onClose={() => setFindOpen(false)}
          editorRef={richEditorRef}
          initialMode={findMode}
        />
      )}

      <DonateRibbon sessionWords={sessionWords} visits={visits} />

      <UnsavedChangesDialog
        open={!!leavePrompt}
        saving={leaveSaving}
        title={leavePrompt?.kind === "reload" ? "Reload note?" : "Unsaved changes"}
        description={
          leavePrompt?.kind === "reload"
            ? "Reloading will discard unsaved edits on all sheets and restore the last saved version."
            : "You have unsaved changes across this workbook. Save before leaving, or discard them."
        }
        onSave={() => void handleLeaveSave()}
        onDiscard={handleLeaveDiscard}
        onCancel={() => {
          if (!leaveSaving) setLeavePrompt(null);
        }}
        discardLabel={
          leavePrompt?.kind === "reload" ? "Reload anyway" : "Leave without saving"
        }
      />
      </div>
    </NoteShell>
  );
}

function StatusPill({
  status,
  isDirty,
  compact = false,
}: {
  status: SaveStatus;
  isDirty: boolean;
  compact?: boolean;
}) {
  const displayStatus: SaveStatus =
    status === "saving" || status === "error"
      ? status
      : isDirty
        ? "dirty"
        : status === "saved"
          ? "saved"
          : "idle";
  const map: Record<SaveStatus, { label: string; icon: React.ReactNode; cls: string }> = {
    idle: { label: "Ready", icon: <Check className="h-3 w-3" />, cls: "bg-muted text-muted-foreground" },
    dirty: { label: "Unsaved", icon: <Pencil className="h-3 w-3" />, cls: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
    saving: { label: "Saving…", icon: <Loader2 className="h-3 w-3 animate-spin" />, cls: "bg-primary/10 text-primary" },
    saved: { label: "Saved", icon: <Check className="h-3 w-3" />, cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
    error: { label: "Save failed", icon: <CloudOff className="h-3 w-3" />, cls: "bg-destructive/15 text-destructive" },
  };
  const v = map[displayStatus];
  if (compact) {
    return (
      <span
        className={`inline-flex h-9 w-9 items-center justify-center rounded-full ${v.cls}`}
        title={v.label}
        aria-label={v.label}
      >
        {v.icon}
      </span>
    );
  }
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

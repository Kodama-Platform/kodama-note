import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Check,
  CloudOff,
  Flame,
  Leaf,
  Loader2,
  Menu,
  Pencil,
  Save,
  Timer,
} from "lucide-react";
import { toast } from "sonner";

import { KodamaMark } from "@/components/kodama-mark";
import { NoteShell } from "@/components/site/note-shell";
import {
  EDITOR_HEADER_INNER,
  EDITOR_HEADER_OFFSET,
  editorHeaderShellClass,
  headerLogoClass,
  headerLogoMarkClass,
  headerLogoTextClass,
} from "@/components/site/header-chrome";
import { EditorEmptyState } from "@/components/editor-empty-state";
import { EditorMobileMenu } from "@/components/editor-mobile-menu";
import { EditorMoreMenu } from "@/components/editor-more-menu";
import { EditorPageTitle } from "@/components/editor-page-title";
import { EditorTemplatesOverlay } from "@/components/editor-templates-overlay";
import { FindReplace } from "@/components/find-replace";
import { KeyboardShortcutsDialog } from "@/components/keyboard-shortcuts-dialog";
import { MarkdownView } from "@/components/markdown-view";
import { OutlineCanopyPanel } from "@/components/outline-canopy-panel";
import { OutlineDrawer, type OutlineDrawerPanel } from "@/components/outline";
import { RichEditor, type RichEditorHandle } from "@/components/rich-editor";
import { SheetTrailhead } from "@/components/sheet-trailhead";
import type { Editor as TiptapEditor } from "@tiptap/react";
import { DonateRibbon, useVisitCount } from "@/components/donate-ribbon";
import { UnsavedChangesDialog } from "@/components/unsaved-changes-dialog";
import { useExportActions } from "@/components/export-menu";
import {
  parseMarkdownHeadings,
  type EditorHeading,
} from "@/lib/editor-headings";
import { EDITOR_EVENTS, setEditorCommandContext } from "@/lib/editor-commands";
import { useAutoLock } from "@/hooks/use-auto-lock";
import { invalidateAttachmentList } from "@/lib/attachment-list";
import {
  autoLockLabel,
  autoLockMsFor,
  getAutoLockDuration,
  setAutoLockDuration,
  type AutoLockDuration,
} from "@/lib/auto-lock";
import {
  canSignKnpWorkbook,
  saveKnpWorkbook,
  type PlaceCryptoSession,
} from "@/lib/crypto-context";
import {
  getEditorFontScale,
  getEditorViewWidth,
  getEditorZoom,
  setEditorFontScale,
  setEditorViewWidth,
  setEditorZoom,
  type EditorFontScale,
  type EditorViewWidth,
  type EditorZoom,
} from "@/lib/editor-view-prefs";
import { savePlaintextWorkbook } from "@/lib/plaintext-mode";
import type { LockReason } from "@/lib/lock-session";
import {
  getStoredNoteAppearance,
  noteColorsToCssVars,
  resolveNoteColors,
  setStoredNoteAppearance,
  type NoteAppearance,
} from "@/lib/note-appearance";
import type { NoteTemplate } from "@/lib/note-templates";
import { pageQueryKey } from "@/lib/page-query";
import { getSaveMode, setSaveMode, type SaveMode } from "@/lib/save-mode";
import { getStoredTheme, resolveTheme, watchSystemTheme } from "@/lib/theme";
import type { UnlockCapability } from "@/lib/unlock-capability";
import { setSheetHash } from "@/lib/hash-params";
import { deleteAttachment, updateExpiry, type BurnMode } from "@/lib/pages";
import { flushActiveSheetMarkdown } from "@/lib/workbook-flush";
import {
  buildEditorCapabilityExport,
  buildEditorShareUrl,
  buildReadOnlyUrl,
  encodeCapabilityFragment,
} from "@/lib/knp-fragment";
import { hasKnpEditorSecrets, readKnpSecrets } from "@/lib/knp-secrets";
import { composeKodamaNoteApp } from "@/lib/security-bootstrap";
import {
  addSheet,
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
  crypto,
  burnMode: initialBurnMode,
  expiresAt: initialExpiresAt,
  unlockCapability = "owner",
  onLock,
}: {
  slug: string;
  initialWorkbook: WorkbookPayload;
  initialActiveSheetId: string;
  initialUpdatedAt: string;
  crypto: PlaceCryptoSession;
  burnMode: BurnMode;
  expiresAt: string | null;
  unlockCapability?: UnlockCapability;
  onLock?: (reason: LockReason) => void;
}) {
  const isReader = unlockCapability === "reader";
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [cryptoSession, setCryptoSession] = useState(crypto);
  useEffect(() => {
    setCryptoSession(crypto);
  }, [crypto]);
  const isKnp = cryptoSession.kind === "knp";
  const isPlaintext = cryptoSession.kind === "plaintext";
  const canSave =
    isPlaintext ||
    (!isReader && canSignKnpWorkbook(cryptoSession) && hasKnpEditorSecrets(slug));
  const canEdit = canSave;
  const canChangeExpiry =
    !isPlaintext && !isReader && !!readKnpSecrets(slug)?.isOwner;
  const [saveMode, setSaveModeState] = useState<SaveMode>(() => getSaveMode());
  const [autoLockDuration, setAutoLockDurationState] = useState<AutoLockDuration>(() =>
    getAutoLockDuration(),
  );
  const [saveModeOpen, setSaveModeOpen] = useState(false);
  const [leavePrompt, setLeavePrompt] = useState<LeavePrompt | null>(null);
  const [leaveSaving, setLeaveSaving] = useState(false);
  const [workbook, setWorkbook] = useState(initialWorkbook);
  const [activeSheetId, setActiveSheetId] = useState(initialActiveSheetId);
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
  const [shareOpen, setShareOpen] = useState(false);
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [outlinePanel, setOutlinePanel] = useState<OutlineDrawerPanel>("outline");
  /** Desktop docked canopy panel (layout-shifting). Mobile uses OutlineDrawer. */
  const [canopyDocked, setCanopyDocked] = useState(false);
  const [outlineVisible, setOutlineVisible] = useState(false);
  const [notesVisible, setNotesVisible] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [activeHeading, setActiveHeading] = useState<string | null>(null);
  const [outlineHeadings, setOutlineHeadings] = useState<EditorHeading[]>([]);
  const [formatEditor, setFormatEditor] = useState<TiptapEditor | null>(null);
  const [editorIsEmpty, setEditorIsEmpty] = useState(true);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [editorZoom, setEditorZoomState] = useState<EditorZoom>(() => getEditorZoom());
  const [fontScale, setFontScaleState] = useState<EditorFontScale>(() => getEditorFontScale());
  const [viewWidth, setViewWidthState] = useState<EditorViewWidth>(() => getEditorViewWidth());
  const [noteAppearance, setNoteAppearance] = useState<NoteAppearance>(() =>
    getStoredNoteAppearance(),
  );
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">(() =>
    resolveTheme(getStoredTheme()),
  );
  const noteColors = useMemo(
    () => resolveNoteColors(noteAppearance, resolvedTheme),
    [noteAppearance, resolvedTheme],
  );
  const noteSurfaceStyle = useMemo(() => noteColorsToCssVars(noteColors), [noteColors]);
  const noteSurfaceFilled = noteColors.background !== "transparent";

  useEffect(() => {
    const syncTheme = () => setResolvedTheme(resolveTheme(getStoredTheme()));
    syncTheme();
    const unwatch = watchSystemTheme(syncTheme);
    window.addEventListener("storage", syncTheme);
    const onThemeToggle = () => syncTheme();
    window.addEventListener("kodama-theme-change", onThemeToggle);
    return () => {
      unwatch();
      window.removeEventListener("storage", syncTheme);
      window.removeEventListener("kodama-theme-change", onThemeToggle);
    };
  }, []);

  const changeNoteAppearance = useCallback((next: NoteAppearance) => {
    setNoteAppearance(next);
    setStoredNoteAppearance(next);
  }, []);

  const initialSerialized = useMemo(() => serializeWorkbook(initialWorkbook), [initialWorkbook]);
  const lastSavedRef = useRef(initialSerialized);
  const [isDirty, setIsDirty] = useState(false);
  const isDirtyRef = useRef(false);
  const editGenerationRef = useRef(0);
  const saveInFlightRef = useRef<Promise<boolean> | null>(null);
  const lockingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const richEditorRef = useRef<RichEditorHandle | null>(null);
  const syncOutlineHeadings = useCallback((fallbackMarkdown?: string) => {
    const live = richEditorRef.current?.getHeadings();
    if (live && live.length > 0) {
      setOutlineHeadings(live);
      return;
    }
    setOutlineHeadings(parseMarkdownHeadings(fallbackMarkdown ?? ""));
  }, []);
  const jumpToOutlineHeading = useCallback((heading: EditorHeading) => {
    const ed = richEditorRef.current;
    if (!ed) return;
    if (typeof heading.pos === "number") {
      ed.scrollToHeadingAt(heading.pos);
      return;
    }
    ed.scrollToHeading(heading.text);
  }, []);
  const onEditorReady = useCallback(
    (ed: TiptapEditor | null) => {
      setFormatEditor(ed);
      queueMicrotask(() => syncOutlineHeadings(richEditorRef.current?.getMarkdown()));
    },
    [syncOutlineHeadings],
  );
  useEffect(() => {
    if (!formatEditor) {
      setCanUndo(false);
      setCanRedo(false);
      setEditorIsEmpty(true);
      return;
    }
    const syncEditorUi = () => {
      setCanUndo(formatEditor.can().undo());
      setCanRedo(formatEditor.can().redo());
      setEditorIsEmpty(formatEditor.isEmpty);
    };
    syncEditorUi();
    formatEditor.on("transaction", syncEditorUi);
    formatEditor.on("create", syncEditorUi);
    return () => {
      formatEditor.off("transaction", syncEditorUi);
      formatEditor.off("create", syncEditorUi);
    };
  }, [formatEditor]);
  const handleUndo = useCallback(() => {
    formatEditor?.chain().focus().undo().run();
  }, [formatEditor]);
  const handleRedo = useCallback(() => {
    formatEditor?.chain().focus().redo().run();
  }, [formatEditor]);
  const changeZoom = useCallback((next: EditorZoom) => {
    setEditorZoomState(next);
    setEditorZoom(next);
  }, []);
  const changeFontScale = useCallback((next: EditorFontScale) => {
    setFontScaleState(next);
    setEditorFontScale(next);
  }, []);
  const changeViewWidth = useCallback((next: EditorViewWidth) => {
    setViewWidthState(next);
    setEditorViewWidth(next);
  }, []);
  const openNavigateDrawer = useCallback((panel: OutlineDrawerPanel) => {
    setOutlinePanel(panel);
    setOutlineOpen(true);
  }, []);
  const isNarrowViewport = useCallback(
    () => typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches,
    [],
  );

  const toggleOutlinePanel = useCallback(() => {
    if (isNarrowViewport()) {
      setCanopyDocked(false);
      if (outlineOpen && outlinePanel === "outline") {
        setOutlineOpen(false);
        setOutlineVisible(false);
      } else {
        setOutlinePanel("outline");
        setOutlineOpen(true);
        setOutlineVisible(true);
      }
      return;
    }
    setOutlineOpen(false);
    setCanopyDocked((v) => {
      const next = !v;
      setOutlineVisible(next);
      return next;
    });
  }, [isNarrowViewport, outlineOpen, outlinePanel]);

  const toggleNotesPanel = useCallback(() => {
    setCanopyDocked(false);
    if (outlineOpen && outlinePanel === "sheets") {
      setOutlineOpen(false);
      setNotesVisible(false);
    } else {
      setOutlinePanel("sheets");
      setOutlineOpen(true);
      setNotesVisible(true);
    }
  }, [outlineOpen, outlinePanel]);
  const editorSyncedRef = useRef(false);
  const workbookRef = useRef(workbook);
  workbookRef.current = workbook;
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
  const [storedSecrets, setStoredSecrets] = useState(() => readKnpSecrets(slug));
  const [readFromUrl, setReadFromUrl] = useState(() =>
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.hash.replace(/^#/, "")).get("read")
      : null,
  );
  const [editorFromUrl, setEditorFromUrl] = useState(() =>
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.hash.replace(/^#/, "")).get("editor")
      : null,
  );
  useEffect(() => {
    const sync = () => {
      const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      setReadFromUrl(params.get("read"));
      setEditorFromUrl(params.get("editor"));
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);
  useEffect(() => {
    setStoredSecrets(readKnpSecrets(slug));
  }, [cryptoSession, slug]);
  useEffect(() => {
    if (shareOpen) setStoredSecrets(readKnpSecrets(slug));
  }, [shareOpen, slug]);

  const { readerCapability, editorCapability } = useMemo(() => {
    return {
      readerCapability: storedSecrets?.readerCapability || readFromUrl || null,
      editorCapability: storedSecrets?.editorCapability || editorFromUrl || null,
    };
  }, [storedSecrets, readFromUrl, editorFromUrl]);

  const readerShareUrl = useMemo(() => {
    if (!readerCapability) return null;
    return buildReadOnlyUrl(`${window.location.origin}/${slug}`, readerCapability);
  }, [readerCapability, slug]);

  const editorShareUrl = useMemo(() => {
    if (!editorCapability) return null;
    return buildEditorShareUrl(`${window.location.origin}/${slug}`, editorCapability);
  }, [editorCapability, slug]);

  const editorCapabilityExport = useMemo(() => {
    if (!editorCapability) return null;
    return buildEditorCapabilityExport({ slug, editorCapability });
  }, [editorCapability, slug]);

  const issueEditorShare = useCallback(async () => {
    if (cryptoSession.kind !== "knp" || cryptoSession.session.role !== "owner") {
      toast.error("Only the owner can issue editor links");
      return;
    }
    try {
      const { note } = composeKodamaNoteApp();
      const { capability, session } = await note.issueEditorCapability(cryptoSession.session);
      setCryptoSession({ kind: "knp", session });
      const encoded = encodeCapabilityFragment(capability);
      const { writeKnpSecrets } = await import("@/lib/knp-secrets");
      const existing = readKnpSecrets(slug);
      writeKnpSecrets(slug, {
        readerCapability: existing?.readerCapability ?? encodeCapabilityFragment(capability),
        editorCapability: encoded,
        isOwner: true,
      });
      setStoredSecrets(readKnpSecrets(slug));
      await navigator.clipboard.writeText(
        buildEditorShareUrl(`${window.location.origin}/${slug}`, encoded),
      );
      toast.success("Editor link copied");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }, [cryptoSession, slug]);

  const copyToClipboard = useCallback(async (text: string, label = "Link copied") => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(label);
    } catch {
      toast.error("Couldn't copy link");
    }
  }, []);

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

  const changeAutoLockDuration = useCallback((duration: AutoLockDuration) => {
    setAutoLockDuration(duration);
    setAutoLockDurationState(duration);
    toast.success(
      duration === "never"
        ? "Auto-lock disabled"
        : `Auto-lock set to ${autoLockLabel(duration)}`,
    );
  }, []);

  const autoLockMs = useMemo(() => autoLockMsFor(autoLockDuration), [autoLockDuration]);

  const toggleMarkdownView = useCallback(() => {
    setMarkdownView((on) => {
      if (!on) {
        const flushed = flushWorkbook();
        setWorkbook(flushed);
        setViewMarkdown(getActiveSheetMarkdown(flushed, activeSheetId));
        setFocus(false);
        setFindOpen(false);
        setFormatEditor(null);
        return true;
      }
      return false;
    });
  }, [activeSheetId, flushWorkbook]);


  const changeExpiry = useCallback(
    async (mode: BurnMode) => {
      if (!canChangeExpiry || mode === burnMode) {
        return;
      }
      setExpirySaving(true);
      try {
        const res = await updateExpiry({
          slug,
          burn_mode: mode,
          ksp: isKnp,
                  });
        setBurnMode(res.burn_mode);
        setExpiresAt(res.expires_at);
        toast.success("Lifetime updated");
      } catch (e) {
        toast.error((e as Error).message);
      } finally {
        setExpirySaving(false);
      }
    },
    [burnMode, canChangeExpiry, isKnp, slug],
  );

  const markDirty = useCallback(() => {
    editGenerationRef.current += 1;
    if (isDirtyRef.current) return;
    isDirtyRef.current = true;
    setIsDirty(true);
    setStatus((s) => (s === "saving" ? "saving" : "dirty"));
  }, []);

  const markClean = useCallback(() => {
    isDirtyRef.current = false;
    setIsDirty(false);
  }, []);

  const markSaved = useCallback(
    (plaintext: string, payload: WorkbookPayload, generationAtSaveStart: number) => {
      lastSavedRef.current = plaintext;
      const stillSameEdits = editGenerationRef.current === generationAtSaveStart;
      if (stillSameEdits) {
        workbookRef.current = payload;
        setWorkbook(payload);
        markClean();
        setStatus("saved");
        return;
      }
      setStatus("dirty");
    },
    [markClean],
  );

  const save = useCallback(
    async (opts?: {
      force?: boolean;
      workbook?: WorkbookPayload;
      skipFlush?: boolean;
    }): Promise<boolean> => {
      const run = async (): Promise<boolean> => {
        if (!canSave) return false;
        const payload =
          opts?.skipFlush && opts.workbook != null
            ? opts.workbook
            : flushWorkbook(opts?.workbook);
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
        if (!opts?.force && !isDirtyRef.current && plaintext === lastSavedRef.current) {
          markSaved(plaintext, payload, editGenerationRef.current);
          return true;
        }
        const generationAtSaveStart = editGenerationRef.current;
        setStatus("saving");
        try {
          if (cryptoSession.kind === "plaintext") {
            savePlaintextWorkbook(slug, plaintext);
            markSaved(plaintext, payload, generationAtSaveStart);
            setUpdatedAt(new Date().toISOString());
            return true;
          }
          const next = await saveKnpWorkbook(cryptoSession, payload);
          setCryptoSession(next);
          markSaved(plaintext, payload, generationAtSaveStart);
          setUpdatedAt(new Date().toISOString());
          return true;
        } catch (e) {
          setStatus("error");
          toast.error((e as Error).message);
          return false;
        }
      };

      const promise = run();
      saveInFlightRef.current = promise;
      try {
        return await promise;
      } finally {
        if (saveInFlightRef.current === promise) {
          saveInFlightRef.current = null;
        }
      }
    },
    [cryptoSession, canSave, flushWorkbook, markSaved, slug],
  );

  const prepareForLock = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (saveInFlightRef.current) {
      await saveInFlightRef.current;
    } else if (canSave && isDirtyRef.current) {
      await save();
    }
  }, [canSave, save]);

  const handleLockNow = useCallback(
    async (reason: LockReason) => {
      if (!onLock || lockingRef.current) return;
      lockingRef.current = true;
      try {
        await prepareForLock();
        onLock(reason);
      } finally {
        lockingRef.current = false;
      }
    },
    [onLock, prepareForLock],
  );

  useAutoLock({
    enabled: !!onLock,
    durationMs: autoLockMs,
    onInactive: () => void handleLockNow("inactivity"),
  });

  const applyLastSaved = useCallback(() => {
    const restored = parseWorkbook(lastSavedRef.current);
    setWorkbook(restored);
    const sheetId = restored.primary_sheet_id;
    setActiveSheetId(sheetId);
    writeLastOpenedSheet(slug, sheetId);
    setSheetHash(sheetId);
    setViewMarkdown(getActiveSheetMarkdown(restored, sheetId));
    markClean();
    setStatus("idle");
  }, [markClean, slug]);

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
    (nextSheetId: string, wb?: WorkbookPayload) => {
      if (nextSheetId === activeSheetId) return;

      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }

      const leavingSheetId = activeSheetId;
      const base = wb ?? workbookRef.current;
      const priorMarkdown = getActiveSheetMarkdown(base, leavingSheetId);
      const leavingMarkdown =
        richEditorRef.current?.getMarkdown() ??
        priorMarkdown;

      let flushed: WorkbookPayload;
      try {
        flushed =
          priorMarkdown === leavingMarkdown
            ? base
            : updateActiveSheetMarkdown(base, leavingSheetId, leavingMarkdown);
        serializeWorkbook(flushed);
      } catch {
        return;
      }

      workbookRef.current = flushed;
      setWorkbook(flushed);
      setActiveSheetId(nextSheetId);
      writeLastOpenedSheet(slug, nextSheetId);
      setSheetHash(nextSheetId);
      editorSyncedRef.current = false;

      if (canSave && saveMode === "auto" && isDirtyRef.current) {
        void save({ workbook: flushed, skipFlush: true });
      }
    },
    [activeSheetId, canSave, save, saveMode, slug],
  );

  const handleMarkdownChange = useCallback(
    (markdown: string) => {
      markDirty();
      setWorkbook((prev) => updateActiveSheetMarkdown(prev, activeSheetId, markdown));
      queueMicrotask(() => syncOutlineHeadings(markdown));
    },
    [activeSheetId, markDirty, syncOutlineHeadings],
  );

  const handleViewMarkdownChange = useCallback(
    (markdown: string) => {
      setViewMarkdown(markdown);
      handleMarkdownChange(markdown);
    },
    [handleMarkdownChange],
  );

  const handleEditorBaseline = useCallback(
    (markdown: string) => {
      try {
        const prior = workbookRef.current;
        const priorMarkdown = getActiveSheetMarkdown(prior, activeSheetId);
        const updated =
          priorMarkdown === markdown
            ? prior
            : updateActiveSheetMarkdown(prior, activeSheetId, markdown);
        workbookRef.current = updated;
        if (updated !== prior) setWorkbook(updated);
        editorSyncedRef.current = true;
        if (!isDirtyRef.current) {
          lastSavedRef.current = serializeWorkbook(updated);
          setStatus((s) => (s === "saved" ? "saved" : "idle"));
        }
      } catch {
        /* keep prior baseline */
      }
    },
    [activeSheetId],
  );

  const handleAddSheet = useCallback(() => {
    try {
      const wasSingle = workbook.sheets.length === 1;
      const next = addSheet(workbook);
      const newSheet = getOrderedSheets(next).at(-1)!;
      markDirty();
      setWorkbook(next);
      void switchSheet(newSheet.sheet_id, next);
      if (wasSingle) {
        toast.message("A new trail opened in the grove.");
      }
    } catch (e) {
      toast.error(e instanceof WorkbookError ? "Maximum sheets reached" : (e as Error).message);
    }
  }, [markDirty, switchSheet, workbook]);

  const handleRenameSheet = useCallback(
    (sheetId: string, title: string) => {
      markDirty();
      setWorkbook((prev) => renameSheet(prev, sheetId, title));
    },
    [markDirty],
  );

  const applyTemplate = useCallback(
    (template: NoteTemplate) => {
      if (!canEdit) return;
      const current =
        richEditorRef.current?.getMarkdown() ??
        getActiveSheetMarkdown(workbookRef.current, activeSheetId);
      const hasContent = current.trim().length > 0;
      if (hasContent) {
        const title =
          workbookRef.current.sheets.find((s) => s.sheet_id === activeSheetId)?.title || "note";
        const ok = window.confirm(
          `Replace “${title}” with the ${template.label} template?`,
        );
        if (!ok) return;
      }
      let markdown = template.markdown;
      const h1 = markdown.match(/^#\s+(.+)\n+/);
      if (h1) {
        markdown = markdown.slice(h1[0].length);
      }
      const noteTitle = template.id === "blank" ? "" : template.label;
      handleRenameSheet(activeSheetId, noteTitle);
      richEditorRef.current?.setMarkdown(markdown);
      handleMarkdownChange(markdown);
      toast.success(template.id === "blank" ? "Blank note" : `${template.label} applied`);
      queueMicrotask(() => richEditorRef.current?.focus());
    },
    [activeSheetId, canEdit, handleMarkdownChange, handleRenameSheet],
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
        if (canSave && idsToDelete.length > 0) {
          const results = await Promise.allSettled(
            idsToDelete.map((attachment_id) =>
              deleteAttachment({
                slug,
                attachment_id,
                ksp: isKnp,
                              }),
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
        markDirty();
        setWorkbook(next);
        if (sheetId === activeSheetId) {
          void switchSheet(focusId, next);
        }
      } catch (e) {
        toast.error((e as Error).message);
      }
    },
    [activeSheetId, canSave, isKnp, markDirty, queryClient, slug, switchSheet, workbook],
  );

  const handleReorderSheets = useCallback(
    (orderedIds: string[]) => {
      markDirty();
      setWorkbook((prev) => reorderSheets(prev, orderedIds));
    },
    [markDirty],
  );

  useEffect(() => {
    if (!markdownView) return;
    // Sync when switching sheets while in markdown mode; typing updates viewMarkdown directly.
    setViewMarkdown(getActiveSheetMarkdown(workbook, activeSheetId));
  }, [activeSheetId, markdownView]);

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
  }, [canSave, isDirty, save, saveMode]);

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

  const exportActions = useExportActions({
    slug,
    workbook,
    activeSheetTitle:
      workbook.sheets.find((s) => s.sheet_id === activeSheetId)?.title ?? "sheet",
    getActiveText: () => richEditorRef.current?.getMarkdown() ?? activeMarkdown,
  });
  const exportMdRef = useRef(exportActions.items[0]?.onClick);
  exportMdRef.current = exportActions.items[0]?.onClick;

  useEffect(() => {
    setEditorCommandContext({
      sheets: getOrderedSheets(workbook).map((s) => ({
        sheetId: s.sheet_id,
        title: s.title,
      })),
      activeSheetId,
      canSave,
      canLock: !!onLock,
      canEdit,
    });
  }, [workbook, activeSheetId, canSave, canEdit, onLock]);

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
        const url = readerShareUrl ?? `${window.location.origin}/${slug}`;
        void copyToClipboard(url);
      } else if (mod && k === "/") {
        e.preventDefault();
        setShortcutsOpen(true);
      } else if (k === "escape") {
        if (findOpen) setFindOpen(false);
        else if (canopyDocked) setCanopyDocked(false);
        else if (outlineOpen) setOutlineOpen(false);
        else if (shortcutsOpen) setShortcutsOpen(false);
        else if (markdownView) setMarkdownView(false);
        else if (focus) setFocus(false);
      }
    };
    const onFocusEvt = () => {
      setFocus((v) => !v);
      setMarkdownView(false);
    };
    const onMarkdownViewEvt = () => toggleMarkdownView();
    const onFind = () => {
      setFindMode("find");
      setFindOpen(true);
    };
    const onFindReplace = () => {
      setFindMode("replace");
      setFindOpen(true);
    };
    const onSaveEvt = () => void save();
    const onLockEvt = () => {
      if (onLock) void handleLockNow("manual");
    };
    const onAppearanceEvt = () => {
      setMobileMenuOpen(false);
      setShareOpen(false);
      setSaveModeOpen(false);
      setMoreMenuOpen(true);
    };
    const onShortcutsEvt = () => setShortcutsOpen(true);
    const onOutlineEvt = () => toggleOutlinePanel();
    const onExportEvt = () => {
      exportMdRef.current?.();
    };
    const onSwitchSheet = (e: Event) => {
      const sheetId = (e as CustomEvent<{ sheetId?: string }>).detail?.sheetId;
      if (sheetId) void switchSheet(sheetId);
    };

    window.addEventListener("keydown", onKey);
    window.addEventListener(EDITOR_EVENTS.toggleFocus, onFocusEvt);
    window.addEventListener(EDITOR_EVENTS.toggleMarkdownView, onMarkdownViewEvt);
    window.addEventListener(EDITOR_EVENTS.find, onFind);
    window.addEventListener(EDITOR_EVENTS.findReplace, onFindReplace);
    window.addEventListener(EDITOR_EVENTS.save, onSaveEvt);
    window.addEventListener(EDITOR_EVENTS.lock, onLockEvt);
    window.addEventListener(EDITOR_EVENTS.appearance, onAppearanceEvt);
    window.addEventListener(EDITOR_EVENTS.shortcuts, onShortcutsEvt);
    window.addEventListener(EDITOR_EVENTS.outline, onOutlineEvt);
    window.addEventListener(EDITOR_EVENTS.export, onExportEvt);
    window.addEventListener(EDITOR_EVENTS.switchSheet, onSwitchSheet);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(EDITOR_EVENTS.toggleFocus, onFocusEvt);
      window.removeEventListener(EDITOR_EVENTS.toggleMarkdownView, onMarkdownViewEvt);
      window.removeEventListener(EDITOR_EVENTS.find, onFind);
      window.removeEventListener(EDITOR_EVENTS.findReplace, onFindReplace);
      window.removeEventListener(EDITOR_EVENTS.save, onSaveEvt);
      window.removeEventListener(EDITOR_EVENTS.lock, onLockEvt);
      window.removeEventListener(EDITOR_EVENTS.appearance, onAppearanceEvt);
      window.removeEventListener(EDITOR_EVENTS.shortcuts, onShortcutsEvt);
      window.removeEventListener(EDITOR_EVENTS.outline, onOutlineEvt);
      window.removeEventListener(EDITOR_EVENTS.export, onExportEvt);
      window.removeEventListener(EDITOR_EVENTS.switchSheet, onSwitchSheet);
    };
  }, [
    canopyDocked,
    copyToClipboard,
    findOpen,
    focus,
    handleLockNow,
    markdownView,
    onLock,
    outlineOpen,
    readerShareUrl,
    save,
    shortcutsOpen,
    slug,
    switchSheet,
    toggleMarkdownView,
    toggleOutlinePanel,
  ]);

  useEffect(() => {
    if (focus) setCanopyDocked(false);
  }, [focus]);

  const charCount = activeMarkdown.length;
  const wordCount = useMemo(
    () => (activeMarkdown.trim() ? activeMarkdown.trim().split(/\s+/).length : 0),
    [activeMarkdown],
  );
  const sessionWords = Math.max(0, wordCount - initialWordsRef.current);
  const readingMinutes = Math.max(1, Math.round(wordCount / 200));


  // Match TipTap's placeholder: when the live editor is empty, show starters under it.
  // Fall back to workbook markdown before the editor mounts.
  const sheetIsEmpty = !activeMarkdown.replace(/[\s\u200b\uFEFF]/g, "").trim();
  const showEmptyStarters =
    canEdit &&
    !focus &&
    !markdownView &&
    (formatEditor ? editorIsEmpty : sheetIsEmpty);

  useEffect(() => {
    setActiveHeading(null);
    const md = getActiveSheetMarkdown(workbookRef.current, activeSheetId);
    setOutlineHeadings(parseMarkdownHeadings(md));
    queueMicrotask(() => syncOutlineHeadings(md));
  }, [activeSheetId, syncOutlineHeadings]);

  return (
    <NoteShell
      showHeader={false}
      footer={false}
      atmosphere={false}
      spiritCursor={false}
      fillViewport
      className={`editor-app editor-app--paper${focus ? " focus-mode" : ""}`}
    >
      <div className={`flex h-full min-h-0 flex-col overflow-hidden ${EDITOR_HEADER_OFFSET}`}>
      {isReader && (
        <div
          className="border-b border-border/60 bg-muted/30 px-4 py-2 text-center text-xs font-light text-muted-foreground"
          role="status"
        >
          Read-only — unlock with the place password on this device to edit or share.
        </div>
      )}
      <header data-editor-chrome="true" className={editorHeaderShellClass()}>
        <div className={EDITOR_HEADER_INNER}>
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
              <span className="hidden md:inline">Kodama</span>
              <span className="text-muted-foreground">/{slug}</span>
            </span>
          </Link>

          {/* Mobile: status + share entry + menu */}
          <div className="flex shrink-0 items-center gap-1 md:hidden">
            {canSave && saveMode === "manual" && isDirty && (
              <button
                type="button"
                onClick={() => void save()}
                disabled={status === "saving"}
                className="note-toolbar-btn !h-9 !w-9 !px-0 !text-primary disabled:opacity-40"
                aria-label="Save"
                title="Save"
              >
                <Save className="h-4 w-4" />
              </button>
            )}
            {canSave && (
              <StatusPill status={status} isDirty={isDirty} compact privateNote={!isPlaintext} />
            )}
            <button
              type="button"
              onClick={() => {
                setSaveModeOpen(false);
                setShareOpen(false);
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

          {/* Desktop — Private · Saved, Share, ⋯ */}
          <div className="hidden items-center gap-2 md:flex">
            {canSave && (
              <button
                type="button"
                onClick={() => {
                  setShareOpen(false);
                  setMoreMenuOpen(false);
                  setSaveModeOpen((v) => !v);
                }}
                className="rounded-md"
                aria-haspopup="menu"
                aria-expanded={saveModeOpen}
                title={`Save status · ${saveMode === "auto" ? "Auto-save" : "Manual"}`}
              >
                <StatusPill status={status} isDirty={isDirty} privateNote={!isPlaintext} />
              </button>
            )}
            {canSave && saveModeOpen && (
              <>
                <button
                  aria-label="Close menu"
                  className="fixed inset-0 z-30 cursor-default"
                  onClick={() => setSaveModeOpen(false)}
                />
                <div
                  role="menu"
                  className="absolute right-28 top-[52px] z-40 mt-1.5 w-56 overflow-hidden rounded-xl border border-border/60 bg-card/95 p-1 shadow-card backdrop-blur-md"
                >
                  <p className="px-2.5 py-1 font-sans text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                    Save
                  </p>
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
                        Save when you choose (⌘S)
                      </span>
                    </span>
                    {saveMode === "manual" && (
                      <Check className="mt-0.5 h-3 w-3 text-primary" />
                    )}
                  </button>
                </div>
              </>
            )}
            {burnMode !== "never" && (
              <ExpiryPill burnMode={burnMode} expiresAt={expiresAt} />
            )}
            {!focus && (
              <button
                type="button"
                onClick={() => {
                  setShareOpen(false);
                  setSaveModeOpen(false);
                  setMoreMenuOpen(false);
                  toggleOutlinePanel();
                }}
                className="note-toolbar-btn !h-8 !px-2.5 gap-1.5 text-xs font-medium"
                aria-pressed={
                  canopyDocked || (outlineOpen && outlinePanel === "outline")
                }
                title={
                  canopyDocked || (outlineOpen && outlinePanel === "outline")
                    ? "Hide canopy"
                    : "Canopy outline"
                }
                aria-label={
                  canopyDocked || (outlineOpen && outlinePanel === "outline")
                    ? "Hide canopy"
                    : "Show canopy"
                }
              >
                <Leaf className="h-3.5 w-3.5" strokeWidth={1.75} />
                Canopy
              </button>
            )}
            {!isPlaintext && (
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setSaveModeOpen(false);
                  setMoreMenuOpen(false);
                  setShareOpen((v) => !v);
                }}
                className="note-toolbar-btn !h-8 !px-3 text-xs font-medium"
                aria-haspopup="menu"
                aria-expanded={shareOpen}
                title="Share"
                aria-label="Share"
              >
                Share
              </button>
              {shareOpen && (
                <>
                  <button
                    aria-label="Close menu"
                    className="fixed inset-0 z-30 cursor-default"
                    onClick={() => setShareOpen(false)}
                  />
                  <div
                    role="menu"
                    className="absolute right-0 z-40 mt-1.5 w-64 overflow-hidden rounded-xl border border-border/80 bg-card/95 p-1 shadow-card backdrop-blur-md"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      disabled={!readerShareUrl}
                      onClick={() => {
                        if (!readerShareUrl) return;
                        setShareOpen(false);
                        void copyToClipboard(readerShareUrl, "Read-only link copied");
                      }}
                      className="flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-light transition-colors hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-40"
                      title={
                        readerShareUrl
                          ? "Anyone with this link can read"
                          : "Unlock with your password once to generate a read-only link"
                      }
                    >
                      <span className="flex-1">
                        <span className="block font-medium text-foreground">Read-only link</span>
                        <span className="block text-[11px] text-muted-foreground">
                          Anyone with this link can decrypt and read
                        </span>
                      </span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      disabled={!editorShareUrl}
                      onClick={() => {
                        if (!editorShareUrl) return;
                        setShareOpen(false);
                        void copyToClipboard(editorShareUrl, "Editor link copied");
                      }}
                      className="flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-light transition-colors hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-40"
                      title={
                        editorShareUrl
                          ? "Anyone with this link can decrypt and edit"
                          : isReader
                            ? "Unlock with your password to share edit access"
                            : "Unlock with your password to generate an editor link"
                      }
                    >
                      <span className="flex-1">
                        <span className="block font-medium text-foreground">Editor link</span>
                        <span className="block text-[11px] text-muted-foreground">
                          Decrypt and edit — share only over a secure channel
                        </span>
                      </span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      disabled={!editorCapabilityExport}
                      onClick={() => {
                        if (!editorCapabilityExport) return;
                        setShareOpen(false);
                        void copyToClipboard(
                          editorCapabilityExport,
                          "Editor capability copied — share out-of-band",
                        );
                      }}
                      className="flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-light transition-colors hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-40"
                      title={
                        editorCapabilityExport
                          ? "Copy KSP editor capability JSON for secure sharing"
                          : "Unlock with your password to export editor capability"
                      }
                    >
                      <span className="flex-1">
                        <span className="block font-medium text-foreground">Editor capability (JSON)</span>
                        <span className="block text-[11px] text-muted-foreground">
                          Paste import for recipients who cannot use a link
                        </span>
                      </span>
                    </button>
                  </div>
                </>
              )}
            </div>
            )}
            <EditorMoreMenu
              canEdit={canEdit}
              canChangeExpiry={canChangeExpiry}
              focus={focus}
              markdownView={markdownView}
              burnMode={burnMode}
              expirySaving={expirySaving}
              autoLockDuration={autoLockDuration}
              saveMode={saveMode}
              canReload={canSave && saveMode === "manual"}
              slug={slug}
              workbook={workbook}
              activeSheetTitle={
                workbook.sheets.find((s) => s.sheet_id === activeSheetId)?.title || "Untitled"
              }
              getActiveText={() => richEditorRef.current?.getMarkdown() ?? activeMarkdown}
              onToggleFocus={() => {
                setFocus((v) => {
                  if (!v) setCanopyDocked(false);
                  return !v;
                });
                setMarkdownView(false);
              }}
              onToggleMarkdownView={toggleMarkdownView}
              onOpenShortcuts={() => setShortcutsOpen(true)}
              onOpenOutline={toggleOutlinePanel}
              onOpenTemplates={() => setTemplatesOpen(true)}
              onOpenFind={() => {
                setFindMode("find");
                setFindOpen(true);
              }}
              fontScale={fontScale}
              viewWidth={viewWidth}
              editorZoom={editorZoom}
              onFontScaleChange={changeFontScale}
              onViewWidthChange={changeViewWidth}
              onZoomChange={changeZoom}
              onChangeExpiry={changeExpiry}
              onChangeAutoLockDuration={changeAutoLockDuration}
              onChangeSaveMode={changeSaveMode}
              onReload={handleReload}
              noteAppearance={noteAppearance}
              onChangeNoteAppearance={changeNoteAppearance}
              onLockNow={onLock ? () => void handleLockNow("manual") : undefined}
              onOpenChange={setMoreMenuOpen}
            />
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
          readerShareUrl={readerShareUrl}
          editorShareUrl={editorShareUrl}
          editorCapabilityExport={editorCapabilityExport}
          shareEnabled={!isPlaintext}
          onCopyShare={(text, label) => void copyToClipboard(text, label)}
          onSave={() => void save()}
          onReload={handleReload}
          onChangeSaveMode={changeSaveMode}
          noteAppearance={noteAppearance}
          onChangeNoteAppearance={changeNoteAppearance}
          onToggleFind={() => {
            setFindMode("find");
            setFindOpen((v) => !v);
          }}
          onOpenOutline={toggleOutlinePanel}
          onOpenShortcuts={() => setShortcutsOpen(true)}
          onToggleFocus={() => {
            setFocus((v) => {
              if (!v) setCanopyDocked(false);
              return !v;
            });
            setMarkdownView(false);
          }}
          onToggleMarkdownView={toggleMarkdownView}
          onChangeExpiry={changeExpiry}
          autoLockDuration={autoLockDuration}
          onChangeAutoLockDuration={changeAutoLockDuration}
          onLockNow={onLock ? () => void handleLockNow("manual") : undefined}
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

      {focus && (
        <button
          type="button"
          data-editor-exit-focus="true"
          onClick={() => setFocus(false)}
        >
          Exit focus
        </button>
      )}

      <main
        data-editor-board="true"
        data-editor-focus={focus ? "true" : undefined}
        data-canopy-docked={canopyDocked && !focus ? "true" : undefined}
        className="relative flex min-h-0 w-full flex-1 overflow-hidden"
      >
        <div
          data-editor-stage="true"
          className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden"
        >
          <div
            data-editor-page-stack="true"
            data-editor-view-width={viewWidth}
            className={focus ? "editor-page-stack editor-page-stack--focus" : "editor-page-stack"}
          >
            <div data-editor-page-card="true">
              <div
                data-editor-zoom-surface="true"
                data-editor-font-surface="true"
                data-editor-zoom={String(editorZoom)}
                style={
                  {
                    "--editor-zoom": editorZoom,
                    "--editor-font-scale": fontScale / 100,
                  } as CSSProperties
                }
              >
                {!focus && (
                  <div data-editor-page-title-wrap="true">
                    <EditorPageTitle
                      title={
                        workbook.sheets.find((s) => s.sheet_id === activeSheetId)?.title ?? ""
                      }
                      canEdit={canEdit}
                      onRename={(next) => handleRenameSheet(activeSheetId, next)}
                    />
                    <SheetTrailhead
                      sheets={workbook.sheets}
                      activeSheetId={activeSheetId}
                      activeMarkdown={activeMarkdown}
                      canEdit={canEdit}
                      onSelect={(id) => void switchSheet(id)}
                      onAdd={handleAddSheet}
                      onRename={handleRenameSheet}
                      onDelete={(id) => void handleDeleteSheet(id)}
                    />
                  </div>
                )}
                <div
                  data-editor-scroll="true"
                  data-note-surface={noteSurfaceFilled ? "filled" : "default"}
                  className="overflow-x-hidden"
                  style={noteSurfaceStyle as CSSProperties}
                >
                  {markdownView ? (
                    <MarkdownView
                      markdown={viewMarkdown}
                      sheetTitle={
                        workbook.sheets.find((s) => s.sheet_id === activeSheetId)?.title ||
                        "Untitled"
                      }
                      canEdit={canEdit}
                      onChange={canEdit ? handleViewMarkdownChange : undefined}
                    />
                  ) : (
                    <>
                      <RichEditor
                        key={activeSheetId}
                        ref={richEditorRef}
                        initialContent={activeMarkdown}
                        onMarkdownChange={handleMarkdownChange}
                        onBaseline={handleEditorBaseline}
                        slug={slug}
                        crypto={cryptoSession}
                        canEdit={canEdit}
                        allowedAttachmentIds={activeAttachmentIds}
                        focusMode={focus}
                        placeholder="Start writing…"
                        onEditorReady={onEditorReady}
                        onActiveHeadingChange={setActiveHeading}
                      />
                      {showEmptyStarters && (
                        <EditorEmptyState onSelect={applyTemplate} />
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
        {canopyDocked && !focus && (
          <OutlineCanopyPanel
            text={activeMarkdown}
            headings={outlineHeadings}
            activeHeading={activeHeading}
            onJumpToHeading={jumpToOutlineHeading}
            onClose={() => setCanopyDocked(false)}
          />
        )}
      </main>

      <EditorTemplatesOverlay
        open={templatesOpen}
        onClose={() => setTemplatesOpen(false)}
        onSelect={applyTemplate}
      />

      {findOpen && (
        <FindReplace
          contentKey={activeMarkdown}
          onClose={() => setFindOpen(false)}
          editorRef={richEditorRef}
          initialMode={findMode}
        />
      )}

      <OutlineDrawer
        open={outlineOpen}
        onClose={() => setOutlineOpen(false)}
        text={activeMarkdown}
        headings={outlineHeadings}
        activeHeading={activeHeading}
        initialPanel={outlinePanel}
        onJumpToHeading={jumpToOutlineHeading}
        sheets={{
          sheets: workbook.sheets,
          activeSheetId,
          activeMarkdown,
          canEdit,
          onSelect: (id) => void switchSheet(id),
          onAdd: handleAddSheet,
          onRename: handleRenameSheet,
          onDelete: (id) => void handleDeleteSheet(id),
          onReorder: handleReorderSheets,
        }}
      />

      <KeyboardShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />

      <DonateRibbon sessionWords={sessionWords} visits={visits} />

      <UnsavedChangesDialog
        open={!!leavePrompt}
        saving={leaveSaving}
        title={leavePrompt?.kind === "reload" ? "Reload note?" : "Unsaved changes"}
        description={
          leavePrompt?.kind === "reload"
            ? "Reloading will discard unsaved edits on all sheets and restore the last saved version."
            : "You have unsaved changes on this note. Save before leaving, or discard them."
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
  privateNote = true,
}: {
  status: SaveStatus;
  isDirty: boolean;
  compact?: boolean;
  privateNote?: boolean;
}) {
  const displayStatus: SaveStatus =
    status === "saving" || status === "error"
      ? status
      : isDirty
        ? "dirty"
        : status === "saved"
          ? "saved"
          : "idle";
  const saveLabel =
    displayStatus === "saving"
      ? "Saving"
      : displayStatus === "error"
        ? "Error"
        : displayStatus === "dirty"
          ? "Unsaved"
          : "Saved";
  const label = privateNote ? `Private · ${saveLabel}` : saveLabel;
  const cls =
    displayStatus === "error"
      ? "text-destructive"
      : displayStatus === "dirty"
        ? "text-amber-700 dark:text-amber-300"
        : displayStatus === "saving"
          ? "text-primary"
          : "text-primary/90";
  const icon =
    displayStatus === "saving" ? (
      <Loader2 className="h-3 w-3 animate-spin" />
    ) : displayStatus === "error" ? (
      <CloudOff className="h-3 w-3" />
    ) : displayStatus === "dirty" ? (
      <Pencil className="h-3 w-3" />
    ) : (
      <Check className="h-3 w-3" />
    );
  const title = privateNote ? `${label} · End-to-end encrypted` : label;
  if (compact) {
    return (
      <span
        className={`inline-flex h-9 w-9 items-center justify-center rounded-full ${cls}`}
        title={title}
        aria-label={title}
      >
        {icon}
      </span>
    );
  }
  return (
    <span
      className={`inline-flex h-8 items-center gap-1.5 px-1.5 font-sans text-xs font-medium tracking-tight ${cls}`}
      title={title}
    >
      {icon}
      <span>{label}</span>
    </span>
  );
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

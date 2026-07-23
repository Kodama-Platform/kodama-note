import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Check,
  CloudOff,
  Copy,
  Flame,
  Loader2,
  Lock,
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
import { EditorFormatToolbar } from "@/components/editor-format-toolbar";
import { EditorMobileMenu } from "@/components/editor-mobile-menu";
import { EditorMoreMenu } from "@/components/editor-more-menu";
import { FindReplace } from "@/components/find-replace";
import { MarkdownView } from "@/components/markdown-view";
import { MigrateToKspBanner } from "@/components/migrate-to-ksp-banner";
import { Outline } from "@/components/outline";
import { RichEditor, type RichEditorHandle } from "@/components/rich-editor";
import type { Editor as TiptapEditor } from "@tiptap/react";
import { DonateRibbon, useVisitCount } from "@/components/donate-ribbon";
import { SheetTabBar } from "@/components/sheet-tab-bar";
import { UnsavedChangesDialog } from "@/components/unsaved-changes-dialog";
import { useAutoLock } from "@/hooks/use-auto-lock";
import { invalidateAttachmentList, prefetchAttachmentList } from "@/lib/attachment-list";
import {
  autoLockLabel,
  autoLockMsFor,
  getAutoLockDuration,
  setAutoLockDuration,
  type AutoLockDuration,
} from "@/lib/auto-lock";
import {
  encryptPlaceWorkbookForSave,
  canSignKspWorkbook,
  kspSessionFromSecrets,
  type PlaceCryptoSession,
} from "@/lib/crypto-context";
import type { LockReason } from "@/lib/lock-session";
import {
  getStoredNoteAppearance,
  noteColorsToCssVars,
  resolveNoteColors,
  setStoredNoteAppearance,
  type NoteAppearance,
} from "@/lib/note-appearance";
import { pageQueryKey } from "@/lib/page-query";
import { getSaveMode, setSaveMode, type SaveMode } from "@/lib/save-mode";
import { getStoredTheme, resolveTheme, watchSystemTheme } from "@/lib/theme";
import type { UnlockCapability } from "@/lib/unlock-capability";
import { setSheetHash } from "@/lib/hash-params";
import { migrateLegacyPlaceToKsp } from "@/lib/ksp-place";
import { deleteAttachment, savePage, updateExpiry, type BurnMode } from "@/lib/pages";
import { flushActiveSheetMarkdown } from "@/lib/workbook-flush";
import { getPlanTier } from "@/lib/plan-tier";
import {
  buildEditorCapabilityExport,
  buildEditorShareUrl,
  buildReadOnlyUrl,
  getFragmentCapability,
  isLegacyEditorFragment,
} from "@/lib/ksp-fragment";
import { resolveShareCapabilities, syncKspSecretsFromSession } from "@/lib/share-capabilities";
import { hasKspEditorSecrets, readKspSecrets, writeKspSecrets } from "@/lib/ksp-secrets";
import { clearLegacyEditToken, readLegacyEditToken } from "@/lib/legacy-edit";
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
  const [legacyEditToken, setLegacyEditToken] = useState(() => readLegacyEditToken(slug));
  useEffect(() => {
    setLegacyEditToken(readLegacyEditToken(slug));
  }, [slug]);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [cryptoSession, setCryptoSession] = useState(crypto);
  useEffect(() => {
    setCryptoSession(crypto);
  }, [crypto]);
  const isKsp = cryptoSession.kind === "ksp";
  const [migrateBannerDismissed, setMigrateBannerDismissed] = useState(false);
  const [migrateBusy, setMigrateBusy] = useState(false);
  const [migrateError, setMigrateError] = useState<string | null>(null);
  const canSave =
    !isReader &&
    canSignKspWorkbook(cryptoSession) &&
    (isKsp ? hasKspEditorSecrets(slug) : !!legacyEditToken);
  const canEdit = canSave;
  const canChangeExpiry =
    !isReader &&
    (isKsp ? !!readKspSecrets(slug)?.ownerPrivateKey : !!legacyEditToken);
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
  const [formatEditor, setFormatEditor] = useState<TiptapEditor | null>(null);
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
  const onEditorReady = useCallback((ed: TiptapEditor | null) => {
    setFormatEditor(ed);
  }, []);
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
  const [storedSecrets, setStoredSecrets] = useState(() => readKspSecrets(slug));
  const [readFromUrl, setReadFromUrl] = useState(() => getFragmentCapability("read"));
  const [editorFromUrl, setEditorFromUrl] = useState(() => getFragmentCapability("editor"));
  useEffect(() => {
    const sync = () => {
      setReadFromUrl(getFragmentCapability("read"));
      setEditorFromUrl(getFragmentCapability("editor"));
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);
  useEffect(() => {
    syncKspSecretsFromSession(slug, cryptoSession, writeKspSecrets);
    setStoredSecrets(readKspSecrets(slug));
  }, [cryptoSession, slug]);
  useEffect(() => {
    if (shareOpen) setStoredSecrets(readKspSecrets(slug));
  }, [shareOpen, slug]);

  const { readerCapability, editorPrivateKey } = useMemo(
    () =>
      resolveShareCapabilities({
        session: cryptoSession,
        stored: storedSecrets,
        readFromUrl,
        editorFromUrl,
      }),
    [cryptoSession, storedSecrets, readFromUrl, editorFromUrl],
  );

  const readerShareUrl = useMemo(() => {
    if (!readerCapability) return null;
    return buildReadOnlyUrl(`${window.location.origin}/${slug}`, readerCapability);
  }, [readerCapability, slug]);

  const editorShareUrl = useMemo(() => {
    if (!readerCapability || !editorPrivateKey) return null;
    if (cryptoSession.kind === "ksp" && isLegacyEditorFragment(editorPrivateKey)) return null;
    if (cryptoSession.kind === "legacy" && !isLegacyEditorFragment(editorPrivateKey)) return null;
    return buildEditorShareUrl(
      `${window.location.origin}/${slug}`,
      readerCapability,
      editorPrivateKey,
    );
  }, [cryptoSession.kind, editorPrivateKey, readerCapability, slug]);

  const editorCapabilityExport = useMemo(() => {
    if (cryptoSession.kind !== "ksp" || !readerCapability || !editorPrivateKey) {
      return null;
    }
    return buildEditorCapabilityExport({
      slug,
      readerCapability,
      editorPrivateKey,
    });
  }, [cryptoSession.kind, editorPrivateKey, readerCapability, slug]);

  const copyToClipboard = useCallback(async (text: string, label = "Link copied") => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(label);
    } catch {
      toast.error("Couldn't copy link");
    }
  }, []);

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
          ksp: isKsp,
          legacyEditToken,
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
    [burnMode, canChangeExpiry, isKsp, legacyEditToken, slug],
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
          const { ciphertext, iv, session } = await encryptPlaceWorkbookForSave(
            cryptoSession,
            plaintext,
          );
          setCryptoSession(session);
          const res = await savePage({
            slug,
            ciphertext,
            iv,
            ksp: isKsp,
            legacyEditToken,
          });
          markSaved(plaintext, payload, generationAtSaveStart);
          setUpdatedAt(res.created_at);
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
    [cryptoSession, canSave, flushWorkbook, isKsp, legacyEditToken, markSaved, slug],
  );

  const migrateToKsp = useCallback(
    async (password: string) => {
      if (!legacyEditToken || cryptoSession.kind !== "legacy") return;
      setMigrateBusy(true);
      setMigrateError(null);
      try {
        const payload = flushWorkbook();
        const plaintext = serializeWorkbook(payload);
        const result = await migrateLegacyPlaceToKsp({
          slug,
          password,
          workbookPlaintext: plaintext,
          legacyEditToken,
        });
        writeKspSecrets(slug, result.secrets);
        clearLegacyEditToken(slug);
        setLegacyEditToken(null);
        setCryptoSession(
          kspSessionFromSecrets({
            slug,
            secrets: result.secrets,
            meta: result.kdf_params,
          }),
        );
        workbookRef.current = payload;
        setWorkbook(payload);
        lastSavedRef.current = plaintext;
        markClean();
        setStatus("saved");
        await queryClient.invalidateQueries({ queryKey: pageQueryKey(slug) });
        toast.success("Upgraded to KSP — create new share links; old #read= links no longer work");
        setMigrateBannerDismissed(true);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        setMigrateError(message);
        toast.error(message);
      } finally {
        setMigrateBusy(false);
      }
    },
    [cryptoSession.kind, flushWorkbook, legacyEditToken, markClean, queryClient, slug],
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
    },
    [activeSheetId, markDirty],
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
      const next = addSheet(workbook);
      const newSheet = getOrderedSheets(next).at(-1)!;
      markDirty();
      setWorkbook(next);
      void switchSheet(newSheet.sheet_id, next);
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

  const handleAttachmentAdded = useCallback(
    (id: string) => {
      markDirty();
      setWorkbook((prev) => addSheetAttachment(prev, activeSheetId, id));
    },
    [activeSheetId, markDirty],
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
                ksp: isKsp,
                legacyEditToken,
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
    [activeSheetId, canSave, isKsp, legacyEditToken, markDirty, queryClient, slug, switchSheet, workbook],
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
  }, [copyToClipboard, findOpen, focus, markdownView, readerShareUrl, save, slug, toggleMarkdownView]);

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
      {isReader && (
        <div
          className="border-b border-border/60 bg-muted/30 px-4 py-2 text-center text-xs font-light text-muted-foreground"
          role="status"
        >
          Read-only — unlock with the place password on this device to edit or share.
        </div>
      )}
      <header
        data-editor-chrome="true"
        className={headerShellClass(
          headerScrolled,
          mobileMenuOpen || moreMenuOpen || saveModeOpen || shareOpen,
        )}
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
              <span className="hidden md:inline">Kodama</span>
              <span className="text-muted-foreground">/{slug}</span>
            </span>
          </Link>

          {/* Mobile: status + quick save + menu */}
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
            {canSave && <StatusPill status={status} isDirty={isDirty} compact />}
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

          {/* Desktop toolbar — status, share, find, lock, more */}
          <div className="hidden items-center gap-1.5 md:flex">
            {canSave && (
              <>
                {saveMode === "manual" && isDirty && (
                  <button
                    type="button"
                    onClick={() => void save()}
                    disabled={status === "saving"}
                    className="note-toolbar-btn !text-primary disabled:opacity-50"
                    title="Save workbook (⌘S)"
                  >
                    <Save className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Save</span>
                  </button>
                )}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setShareOpen(false);
                      setMoreMenuOpen(false);
                      setSaveModeOpen((v) => !v);
                    }}
                    className="rounded-full"
                    aria-haspopup="menu"
                    aria-expanded={saveModeOpen}
                    title={`Save status · ${saveMode === "auto" ? "Auto-save" : "Manual"}`}
                  >
                    <StatusPill status={status} isDirty={isDirty} />
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
                        className="absolute right-0 z-40 mt-1.5 w-56 overflow-hidden rounded-xl border border-border/80 bg-card/95 p-1 shadow-card backdrop-blur-md"
                      >
                        <p className="px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
                          Save mode
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
                        {saveMode === "manual" && (
                          <>
                            <div className="my-1 border-t border-border/60" role="separator" />
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => {
                                setSaveModeOpen(false);
                                handleReload();
                              }}
                              disabled={status === "saving"}
                              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-light text-foreground transition-colors hover:bg-primary/5 disabled:opacity-50"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                              Reload last saved
                            </button>
                          </>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </>
            )}
            {burnMode !== "never" && (
              <ExpiryPill burnMode={burnMode} expiresAt={expiresAt} />
            )}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setSaveModeOpen(false);
                  setMoreMenuOpen(false);
                  setShareOpen((v) => !v);
                }}
                className="note-toolbar-btn"
                aria-haspopup="menu"
                aria-expanded={shareOpen}
                title="Share"
              >
                <Copy className="h-3.5 w-3.5" />
                <span className="hidden lg:inline">Share</span>
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
                            : cryptoSession.kind === "legacy"
                              ? "Unlock with your password once to generate an editor link"
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
                          : cryptoSession.kind === "legacy"
                            ? "Editor capability export requires a KSP place"
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
            {onLock && (
              <button
                type="button"
                onClick={() => void handleLockNow("manual")}
                className="note-toolbar-btn"
                title="Lock now"
              >
                <Lock className="h-3.5 w-3.5" />
                <span className="hidden lg:inline">Lock</span>
              </button>
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
                workbook.sheets.find((s) => s.sheet_id === activeSheetId)?.title ?? "sheet"
              }
              getActiveText={() => richEditorRef.current?.getMarkdown() ?? activeMarkdown}
              onToggleFocus={() => {
                setFocus((v) => !v);
                setMarkdownView(false);
              }}
              onToggleMarkdownView={toggleMarkdownView}
              onChangeExpiry={changeExpiry}
              onChangeAutoLockDuration={changeAutoLockDuration}
              onChangeSaveMode={changeSaveMode}
              onReload={handleReload}
              noteAppearance={noteAppearance}
              onChangeNoteAppearance={changeNoteAppearance}
              onLockNow={onLock ? () => void handleLockNow("manual") : undefined}
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
          readerShareUrl={readerShareUrl}
          editorShareUrl={editorShareUrl}
          editorCapabilityExport={editorCapabilityExport}
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
          onToggleFocus={() => {
            setFocus((v) => !v);
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

        {!migrateBannerDismissed && (
          <MigrateToKspBanner
            isLegacy={cryptoSession.kind === "legacy"}
            isReader={isReader}
            hasEditToken={!!legacyEditToken}
            hasAttachments={workbookUsesAttachments(workbook)}
            busy={migrateBusy}
            error={migrateError}
            onMigrate={migrateToKsp}
            onDismiss={() => setMigrateBannerDismissed(true)}
          />
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
            canEdit={canEdit}
            switching={false}
            onSelect={(id) => switchSheet(id)}
            onAdd={handleAddSheet}
            onRename={handleRenameSheet}
            onDelete={(id) => void handleDeleteSheet(id)}
            onReorder={handleReorderSheets}
          />
          {canEdit && !markdownView && !focus && (
            <EditorFormatToolbar
              editor={formatEditor}
              onOpenLink={() => richEditorRef.current?.openLinkDialog()}
              onInsertImage={(file) => void richEditorRef.current?.insertImageFromFile(file)}
            />
          )}
          <div
            data-editor-scroll="true"
            data-note-surface={noteSurfaceFilled ? "filled" : "default"}
            className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden pr-1"
            style={noteSurfaceStyle as CSSProperties}
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
                crypto={cryptoSession}
                canEdit={canEdit}
                canUpload={canSave}
                allowedAttachmentIds={activeAttachmentIds}
                planTier={planTier}
                sheetAttachmentCount={activeAttachmentIds.size}
                onAttachmentAdded={handleAttachmentAdded}
                focusMode={focus}
                onEditorReady={onEditorReady}
              />

              {!focus && (
                <div className="mt-8" data-editor-attachments="true">
                  <AttachmentsPanel
                    slug={slug}
                    crypto={cryptoSession}
                    canUpload={canSave}
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

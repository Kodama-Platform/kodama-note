import { createFileRoute, Link } from "@tanstack/react-router";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Flame, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { LockedScreen } from "@/components/locked-screen";
import { PaidUnlockGate } from "@/components/paid-unlock-gate";
import { NoteShell } from "@/components/site/note-shell";
import { fetchPayAccountMe, startPayCheckout } from "@/lib/kodama-pay";
import type { NotePlaceEntitlement, NotePlacePaymentPublic } from "@/lib/note-payment";
import type { NotePlaceSettings } from "@/lib/note-place-settings";

const Editor = lazy(() =>
  import("@/components/editor").then((m) => ({ default: m.Editor })),
);
import {
  EncryptionProgress,
  type EncryptionPhase,
} from "@/components/encryption-progress";
import { slugSchema } from "@/lib/slug";
import { getSheetIdFromHash, migrateCodeToHash, readUnlockCode, stripCodeFromUrl, stripSensitiveHashParams } from "@/lib/hash-params";
import {
  createPlaintextSession,
  createPublicSession,
  type PlaceCryptoSession,
} from "@/lib/crypto-context";
import { publicTabsToWorkbook, resolveSheetRef } from "@/lib/tab-visibility";
import { clearDecryptedSession, type LockReason } from "@/lib/lock-session";
import { BURN_MODES, getPage, type BurnMode, type GetPageResult } from "@/lib/pages";
import { pageQueryKey, type ExistingPage } from "@/lib/page-query";
import { isPlaintextMode, loadPlaintextWorkbook } from "@/lib/plaintext-mode";
import { resolveUnlockCapability, type UnlockCapability } from "@/lib/unlock-capability";
import {
  encodeCapabilityFragment,
  getFragmentCapability,
  parseEditorCapabilityImport,
} from "@/lib/knp-fragment";
import { readKnpSecrets, writeKnpSecrets } from "@/lib/knp-secrets";
import { unlockErrorMessage, unlockPlace, unlockPlaceWithEditorImport } from "@/lib/unlock-place";
import { composeKodamaNoteApp } from "@/lib/security-bootstrap";
import {
  createEmptyWorkbook,
  parseWorkbook,
  readLastOpenedSheet,
  resolveInitialSheetId,
  serializeWorkbook,
} from "@/lib/workbook";

type SlugSearch = { code?: string };

export const Route = createFileRoute("/$slug")({
  validateSearch: (search: Record<string, unknown>): SlugSearch => ({
    code: typeof search.code === "string" && search.code.length > 0 ? search.code : undefined,
  }),
  component: SlugPage,
});

function fragmentCapabilitySecrets(): {
  readerCapability: string;
  editorCapability: string;
} | null {
  const editor = getFragmentCapability("editor");
  if (editor) return { readerCapability: editor, editorCapability: editor };
  const read = getFragmentCapability("read");
  if (read) return { readerCapability: read, editorCapability: "" };
  return null;
}

function initialUnlockCapability(slug: string, viaShareLink: boolean): UnlockCapability {
  const secrets = readKnpSecrets(slug);
  const fromHash = fragmentCapabilitySecrets();
  return resolveUnlockCapability({
    hasEditorSecrets: !!(secrets?.isOwner || secrets?.editorCapability || fromHash?.editorCapability),
    hasReadCapability: viaShareLink || !!getFragmentCapability("read") || !!secrets?.readerCapability,
  });
}

/** Persist `#editor=` / `#read=` fragments into session secrets. */
function importEditorFragment(slug: string): void {
  const imported = fragmentCapabilitySecrets();
  if (!imported) return;
  writeKnpSecrets(slug, {
    readerCapability: imported.readerCapability,
    editorCapability: imported.editorCapability,
    isOwner: false,
  });
}

type UnlockedSession = {
  crypto: PlaceCryptoSession;
  plaintext: string;
  updatedAt: string;
  capability: UnlockCapability;
};

type FreshCreateSession = {
  session: UnlockedSession;
  burnMode: BurnMode;
  expiresAt: string | null;
};

function UnlockedEditor({
  slug,
  session,
  burnMode,
  expiresAt,
  settings,
  payment,
  entitlement,
  onLock,
  onUnlockPrivate,
}: {
  slug: string;
  session: UnlockedSession;
  burnMode: BurnMode;
  expiresAt: string | null;
  settings?: NotePlaceSettings | null;
  payment?: NotePlacePaymentPublic | null;
  entitlement?: NotePlaceEntitlement | null;
  onLock: (reason: LockReason) => void;
  onUnlockPrivate?: () => void;
}) {
  const workbook = useMemo(() => parseWorkbook(session.plaintext), [session.plaintext]);
  const preferred =
    resolveSheetRef(workbook, getSheetIdFromHash()) ??
    resolveSheetRef(workbook, readLastOpenedSheet(slug)) ??
    workbook.primary_sheet_id;
  const initialActiveSheetId = resolveInitialSheetId(workbook, preferred);

  return (
    <Suspense
      fallback={
        <NoteShell centered>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            <span>Opening editor…</span>
          </div>
        </NoteShell>
      }
    >
      <Editor
        slug={slug}
        initialWorkbook={workbook}
        initialActiveSheetId={initialActiveSheetId}
        initialUpdatedAt={session.updatedAt}
        crypto={session.crypto}
        burnMode={burnMode}
        expiresAt={expiresAt}
        unlockCapability={session.capability}
        initialSettings={settings}
        initialPayment={payment}
        initialEntitlement={entitlement}
        onLock={onLock}
        onUnlockPrivate={onUnlockPrivate}
      />
    </Suspense>
  );
}

function SlugPage() {
  const { slug } = Route.useParams();
  const parsed = slugSchema.safeParse(slug);

  useEffect(() => {
    document.title = `${slug} · Kodama`;
  }, [slug]);

  if (!parsed.success) {
    return (
      <GateShell>
        <NoteCard>
          <h1 className="font-display text-xl font-light tracking-tight text-foreground sm:text-2xl">
            Invalid page name
          </h1>
          <p className="mt-3 text-sm font-light leading-relaxed text-muted-foreground">
            {parsed.error.issues[0]?.message}
          </p>
          <div className="mt-8">
            <Link to="/" className="btn-moss inline-flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" /> Back home
            </Link>
          </div>
        </NoteCard>
      </GateShell>
    );
  }

  return <PageGate slug={parsed.data} />;
}

class PageNotFoundError extends Error {
  constructor() {
    super("PAGE_NOT_FOUND");
    this.name = "PageNotFoundError";
  }
}

async function resolveExistingPage(
  data: GetPageResult | undefined,
  fetchPage: () => Promise<{ data: GetPageResult | undefined }>,
): Promise<ExistingPage> {
  let result = data;
  if (!result) {
    const fetched = await fetchPage();
    result = fetched.data;
  }
  if (!result?.exists) throw new PageNotFoundError();
  return result;
}

function PlaintextEditorGate({ slug }: { slug: string }) {
  const session = useMemo<UnlockedSession>(
    () => ({
      crypto: createPlaintextSession(),
      plaintext: loadPlaintextWorkbook(slug),
      updatedAt: new Date().toISOString(),
      capability: "editor",
    }),
    [slug],
  );

  return (
    <UnlockedEditor
      slug={slug}
      session={session}
      burnMode="never"
      expiresAt={null}
      onLock={() => {
        // Soft lock: reload chrome without wiping localStorage notes.
        window.location.assign(`/${slug}`);
      }}
    />
  );
}

function PageGate({ slug }: { slug: string }) {
  if (isPlaintextMode()) {
    return <PlaintextEditorGate slug={slug} />;
  }
  return <EncryptedPageGate slug={slug} />;
}

function EncryptedPageGate({ slug }: { slug: string }) {
  const { code: searchCode } = Route.useSearch();
  const codePassword = readUnlockCode(searchCode);
  const queryClient = useQueryClient();
  const [freshCreate, setFreshCreate] = useState<FreshCreateSession | null>(null);

  useEffect(() => {
    migrateCodeToHash(searchCode);
    importEditorFragment(slug);
  }, [searchCode, slug]);

  const q = useQuery({
    queryKey: pageQueryKey(slug),
    queryFn: () => getPage(slug),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const ensurePage = useCallback(
    () =>
      resolveExistingPage(q.data, async () => {
        const result = await q.refetch();
        return { data: result.data };
      }),
    [q.data, q.refetch],
  );

  const endFreshCreate = useCallback(
    (reason: LockReason) => {
      clearDecryptedSession(slug, queryClient);
      setFreshCreate(null);
      void q.refetch();
      if (reason === "inactivity") {
        toast.info("Locked due to inactivity");
      }
    },
    [queryClient, q.refetch, slug],
  );

  if (freshCreate) {
    return (
      <UnlockedEditor
        slug={slug}
        session={freshCreate.session}
        burnMode={freshCreate.burnMode}
        expiresAt={freshCreate.expiresAt}
        onLock={endFreshCreate}
      />
    );
  }

  if (q.isError && !q.data) {
    return (
      <GateShell>
        <NoteCard>
          <h1 className="font-display text-xl font-light tracking-tight text-foreground sm:text-2xl">
            Couldn&apos;t load this page
          </h1>
          <p className="mt-3 text-sm font-light leading-relaxed text-muted-foreground">
            {(q.error as Error).message}
          </p>
        </NoteCard>
      </GateShell>
    );
  }

  const data = q.data;

  if (data && !data.exists) {
    return (
      <CreateGate
        slug={slug}
        onCreated={(created) => {
          setFreshCreate(created);
          void q.refetch();
        }}
        onSlugTaken={() => void q.refetch()}
      />
    );
  }

  const page: ExistingPage | null = data?.exists === true ? data : null;

  if (page?.paid_unlock_required && !page.ciphertext) {
    return <PaidUnlockPage slug={slug} payment={page.payment ?? null} />;
  }

  return (
    <UnlockGate
      slug={slug}
      page={page}
      ensurePage={ensurePage}
      codePassword={codePassword}
    />
  );
}

function CreateGate({
  slug,
  onCreated,
  onSlugTaken,
}: {
  slug: string;
  onCreated: (created: FreshCreateSession) => void;
  onSlugTaken: () => void;
}) {
  const queryClient = useQueryClient();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [burnMode, setBurnMode] = useState<BurnMode>("never");
  const [busy, setBusy] = useState(false);
  const [encryptPhase, setEncryptPhase] = useState<EncryptionPhase | null>(null);
  const [session, setSession] = useState<UnlockedSession | null>(null);
  const [lockReason, setLockReason] = useState<LockReason | null>(null);
  const [unlockPw, setUnlockPw] = useState("");
  const [unlockBusy, setUnlockBusy] = useState(false);
  const [createdExpiresAt, setCreatedExpiresAt] = useState<string | null>(null);
  const capabilityRef = useRef<UnlockCapability>("editor");

  const endSession = useCallback(
    (reason: LockReason) => {
      clearDecryptedSession(slug, queryClient);
      setSession(null);
      setLockReason(reason);
      setUnlockPw("");
      if (reason === "inactivity") {
        toast.info("Locked due to inactivity");
      }
    },
    [queryClient, slug],
  );

  const unlockAfterLock = async (e: FormEvent) => {
    e.preventDefault();
    if (!unlockPw) return;
    setUnlockBusy(true);
    try {
      const loaded = await getPage(slug);
      if (!loaded.exists) throw new Error("Page not found");
      const unlocked = await unlockPlace({
        page: loaded,
        password: unlockPw,
      });
      capabilityRef.current = unlocked.capability;
      setSession({
        crypto: unlocked.crypto,
        plaintext: unlocked.plaintext,
        updatedAt: loaded.updated_at,
        capability: unlocked.capability,
      });
      setLockReason(null);
      setUnlockPw("");
    } catch (err) {
      toast.error(unlockErrorMessage(err));
    } finally {
      setUnlockBusy(false);
    }
  };

  if (session) {
    return (
      <UnlockedEditor
        slug={slug}
        session={session}
        burnMode={burnMode}
        expiresAt={createdExpiresAt}
        onLock={endSession}
      />
    );
  }

  if (lockReason) {
    return (
      <LockedScreen
        slug={slug}
        capability={capabilityRef.current}
        reason={lockReason}
        busy={unlockBusy}
        password={unlockPw}
        onPasswordChange={setUnlockPw}
        onSubmit={(e) => void unlockAfterLock(e)}
      />
    );
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (pw.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (pw !== pw2) {
      toast.error("Passwords don't match");
      return;
    }
    setBusy(true);
    try {
      setEncryptPhase("deriving");
      const { note } = composeKodamaNoteApp();
      setEncryptPhase("encrypting");
      let created;
      try {
        created = await note.createPlace({
          slug,
          password: pw,
          burnMode,
          workbook: createEmptyWorkbook(),
        });
      } catch (err) {
        if ((err as Error).message === "slug_taken") {
          toast.error("That page name was just taken. Reloading…");
          onSlugTaken();
          return;
        }
        throw err;
      }
      setEncryptPhase("uploading");
      const readerCap = await note.issueReaderCapability(created.session);
      writeKnpSecrets(slug, {
        readerCapability: encodeCapabilityFragment(readerCap),
        editorCapability: "",
        isOwner: true,
      });
      history.replaceState(null, "", window.location.pathname);
      setEncryptPhase("done");
      onCreated({
        session: {
          crypto: { kind: "knp", session: created.session },
          plaintext: serializeWorkbook(created.workbook),
          updatedAt: new Date().toISOString(),
          capability: "owner",
        },
        burnMode,
        expiresAt: null,
      });
    } catch (err) {
      toast.error((err as Error).message || "Could not create page");
    } finally {
      setBusy(false);
      setEncryptPhase(null);
    }
  };

  return (
    <GateShell>
      <NoteCard>
        <NoteBadge>New place</NoteBadge>
        <h1 className="mt-4 font-display text-[1.75rem] font-light leading-tight tracking-tight text-foreground sm:text-3xl">
          Create <span className="text-primary">/{slug}</span>
        </h1>
        <p className="mt-3 text-sm font-light leading-relaxed text-muted-foreground sm:text-[0.95rem]">
          Choose a password only you know. It never leaves this device — and we cannot recover it
          if you forget it.
        </p>
        <form onSubmit={submit} className="mt-8 space-y-6">
          <section className="space-y-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              1 · Password
            </p>
            <PasswordInput label="Create password" value={pw} onChange={setPw} autoFocus />
            <PasswordInput label="Confirm password" value={pw2} onChange={setPw2} />
            <p className="text-[11px] font-light text-muted-foreground">
              At least 6 characters. Prefer a phrase you can remember.
            </p>
          </section>

          <section>
            <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              2 · Lifetime
            </p>
            <div className="grid gap-2">
              {BURN_MODES.map((m) => (
                <label
                  key={m.value}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 text-left text-sm transition-colors ${
                    burnMode === m.value
                      ? "border-primary/50 bg-primary/5"
                      : "border-border/80 bg-background/40 hover:border-primary/30 hover:bg-primary/[0.03]"
                  }`}
                >
                  <input
                    type="radio"
                    name="burn"
                    className="mt-1 accent-primary"
                    checked={burnMode === m.value}
                    onChange={() => setBurnMode(m.value)}
                  />
                  <span>
                    <span className="flex items-center gap-1.5 font-medium text-foreground">
                      {m.value === "after_read" && <Flame className="h-3.5 w-3.5 text-ember" />}
                      {m.label}
                    </span>
                    <span className="mt-0.5 block text-xs font-light text-muted-foreground">
                      {m.hint}
                    </span>
                  </span>
                </label>
              ))}
            </div>
            <p className="mt-2 text-[11px] font-light text-muted-foreground">
              You can change this later from the note menu.
            </p>
          </section>

          <button
            type="submit"
            disabled={busy}
            className="btn-moss flex h-12 w-full items-center justify-center gap-2 text-base disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            {busy ? "Securing your place…" : "Create & start writing"}
          </button>

          {encryptPhase && <EncryptionProgress phase={encryptPhase} />}
        </form>
      </NoteCard>
    </GateShell>
  );
}

function UnlockGate({
  slug,
  page,
  ensurePage,
  codePassword,
}: {
  slug: string;
  page: ExistingPage | null;
  ensurePage: () => Promise<ExistingPage>;
  codePassword?: string;
}) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<UnlockedSession | null>(null);
  const [lockReason, setLockReason] = useState<LockReason | null>(null);
  const [unlockPrivate, setUnlockPrivate] = useState(false);
  const publicWorkbook = useMemo(
    () => (page ? publicTabsToWorkbook(page.public_tabs ?? []) : null),
    [page],
  );
  const hasPublicTabs = (page?.public_tabs?.length ?? 0) > 0;
  const [pw, setPw] = useState("");
  const hasReadShareLink = !!getFragmentCapability("read");
  const [busy, setBusy] = useState(!!codePassword || hasReadShareLink);
  const [shareUnlockFailed, setShareUnlockFailed] = useState(false);
  const capabilityRef = useRef<UnlockCapability>(
    initialUnlockCapability(slug, !!codePassword),
  );
  const unlockInFlight = useRef(false);

  const unlockWithPassword = async (password: string, viaShareLink = false) => {
    if (unlockInFlight.current) return;
    unlockInFlight.current = true;
    try {
      const loaded = page ?? (await ensurePage());
      const unlocked = await unlockPlace({ page: loaded, password, viaShareLink });
      capabilityRef.current = unlocked.capability;
      setSession({
        crypto: unlocked.crypto,
        plaintext: unlocked.plaintext,
        updatedAt: loaded.updated_at,
        capability: unlocked.capability,
      });
      setLockReason(null);
      setPw("");
      stripSensitiveHashParams("read", "editor");
    } finally {
      unlockInFlight.current = false;
    }
  };

  const unlockWithShareLink = useCallback(async () => {
    if (unlockInFlight.current) return;
    unlockInFlight.current = true;
    try {
      const loaded = page ?? (await ensurePage());
      const unlocked = await unlockPlace({ page: loaded, viaShareLink: true });
      capabilityRef.current = unlocked.capability;
      setSession({
        crypto: unlocked.crypto,
        plaintext: unlocked.plaintext,
        updatedAt: loaded.updated_at,
        capability: unlocked.capability,
      });
      setLockReason(null);
      setPw("");
      setShareUnlockFailed(false);
      stripSensitiveHashParams("read", "editor");
    } finally {
      unlockInFlight.current = false;
    }
  }, [ensurePage, page]);

  const endSession = useCallback(
    (reason: LockReason) => {
      clearDecryptedSession(slug, queryClient);
      setSession(null);
      setLockReason(reason);
      setPw("");
      if (reason === "inactivity") {
        toast.info("Locked due to inactivity");
      }
    },
    [queryClient, slug],
  );

  useEffect(() => {
    if (session) return;
    const hasEditorShareLink = !!getFragmentCapability("editor");
    const stored = readKnpSecrets(slug);
    const canAutoUnlock =
      hasReadShareLink ||
      hasEditorShareLink ||
      (!!stored?.readerCapability && (!!stored?.editorCapability || !!stored?.isOwner));
    if (!canAutoUnlock) return;
    let cancelled = false;
    setShareUnlockFailed(false);
    (async () => {
      setBusy(true);
      try {
        await unlockWithShareLink();
      } catch (err) {
        if (cancelled) return;
        if (err instanceof PageNotFoundError) return;
        setShareUnlockFailed(true);
        toast.error(unlockErrorMessage(err));
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session, unlockWithShareLink, hasReadShareLink, slug]);

  useEffect(() => {
    if (!codePassword || session) return;
    let cancelled = false;
    (async () => {
      setBusy(true);
      try {
        await unlockWithPassword(codePassword, true);
        stripCodeFromUrl();
        stripSensitiveHashParams("code");
      } catch (err) {
        if (cancelled) return;
        if (err instanceof PageNotFoundError) return;
        toast.error(unlockErrorMessage(err));
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codePassword, slug, page]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!pw) return;
    setBusy(true);
    try {
      await unlockWithPassword(pw, false);
    } catch (err) {
      if (err instanceof PageNotFoundError) return;
      toast.error(unlockErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const importEditorCapability = async (raw: string) => {
    const parsed = parseEditorCapabilityImport(raw);
    if (!parsed) {
      toast.error("Invalid editor capability JSON");
      return;
    }
    setBusy(true);
    try {
      const loaded = page ?? (await ensurePage());
      const unlocked = await unlockPlaceWithEditorImport({
        page: loaded,
        editorCapability: parsed.editor,
      });
      capabilityRef.current = unlocked.capability;
      setSession({
        crypto: unlocked.crypto,
        plaintext: unlocked.plaintext,
        updatedAt: loaded.updated_at,
        capability: unlocked.capability,
      });
      setLockReason(null);
      setPw("");
    } catch (err) {
      if (err instanceof PageNotFoundError) return;
      toast.error(unlockErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const expiryNote = useMemo(() => {
    if (!page) return null;
    if (page.burn_mode === "after_read") return "This page will burn after the next read.";
    if (page.expires_at) return `Expires ${new Date(page.expires_at).toLocaleString()}.`;
    return null;
  }, [page]);

  if (session) {
    return (
      <UnlockedEditor
        slug={slug}
        session={session}
        burnMode={page?.burn_mode ?? "never"}
        expiresAt={page?.expires_at ?? null}
        settings={page?.settings}
        payment={page?.payment}
        entitlement={page?.entitlement}
        onLock={endSession}
      />
    );
  }

  if (hasPublicTabs && publicWorkbook && !unlockPrivate && !lockReason) {
    return (
      <UnlockedEditor
        slug={slug}
        session={{
          crypto: createPublicSession(),
          plaintext: serializeWorkbook(publicWorkbook, { validate: false }),
          updatedAt: page?.updated_at ?? new Date().toISOString(),
          capability: "reader",
        }}
        burnMode={page?.burn_mode ?? "never"}
        expiresAt={page?.expires_at ?? null}
        settings={page?.settings}
        payment={page?.payment}
        entitlement={page?.entitlement}
        onLock={endSession}
        onUnlockPrivate={() => setUnlockPrivate(true)}
      />
    );
  }

  return (
    <LockedScreen
      slug={slug}
      capability={capabilityRef.current}
      reason={lockReason ?? undefined}
      busy={busy}
      password={pw}
      onPasswordChange={setPw}
      onSubmit={submit}
      onImportEditorCapability={importEditorCapability}
      expiryNote={expiryNote}
      autoFocusPassword={!codePassword && !(hasReadShareLink && !shareUnlockFailed)}
      shareLinkUnlocking={hasReadShareLink && !shareUnlockFailed}
      passwordFallback={!hasReadShareLink || shareUnlockFailed}
      onCancel={hasPublicTabs ? () => setUnlockPrivate(false) : undefined}
    />
  );
}

function PaidUnlockPage({
  slug,
  payment,
}: {
  slug: string;
  payment: NotePlacePaymentPublic | null;
}) {
  const [busy, setBusy] = useState(false);

  const onCheckout = async () => {
    setBusy(true);
    try {
      const account = await fetchPayAccountMe();
      const result = await startPayCheckout({
        account_id: account?.account_id,
        product: "note",
        place_slug: slug,
      });
      if (result.checkout_url) {
        window.location.assign(result.checkout_url);
        return;
      }
      toast.error("Checkout did not return a URL");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't start checkout");
    } finally {
      setBusy(false);
    }
  };

  return (
    <PaidUnlockGate slug={slug} payment={payment} busy={busy} onCheckout={() => void onCheckout()} />
  );
}

function GateShell({ children }: { children: ReactNode }) {
  return (
    <NoteShell centered footer="feature">
      <div className="w-full max-w-md">{children}</div>
    </NoteShell>
  );
}

function PasswordInput({
  label,
  value,
  onChange,
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoFocus?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-2 block font-mono text-[11px] uppercase tracking-[0.2em] text-clay">
        {label}
      </span>
      <input
        type="password"
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="note-input"
        autoComplete="off"
      />
    </label>
  );
}

function NoteCard({ children }: { children: ReactNode }) {
  return <div className="note-card">{children}</div>;
}

function NoteBadge({ children }: { children: ReactNode }) {
  return <span className="note-badge">{children}</span>;
}

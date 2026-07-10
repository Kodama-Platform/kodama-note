import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Flame, Loader2, Lock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { NoteShell } from "@/components/site/note-shell";
import { Editor } from "@/components/editor";
import {
  EncryptionProgress,
  type EncryptionPhase,
} from "@/components/encryption-progress";
import { slugSchema } from "@/lib/slug";
import { getHashParams, getSheetIdFromHash, stripCodeFromUrl } from "@/lib/hash-params";
import {
  DEFAULT_KDF_PARAMS,
  decrypt,
  deriveKey,
  encrypt,
  newSalt,
  unlockErrorMessage,
  type KdfParams,
} from "@/lib/crypto";
import { BURN_MODES, createPage, getPage, type BurnMode, type GetPageResult } from "@/lib/pages";
import { pageQueryKey, type ExistingPage } from "@/lib/page-query";
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

const EDIT_TOKEN_KEY = (slug: string) => `kodama-edit-${slug}`;

function readEditToken(slug: string): string | null {
  if (typeof window === "undefined") return null;
  const params = getHashParams();
  const fromHash = params.get("edit");
  if (fromHash) {
    try {
      localStorage.setItem(EDIT_TOKEN_KEY(slug), fromHash);
    } catch {
      /* ignore */
    }
    return fromHash;
  }
  try {
    return localStorage.getItem(EDIT_TOKEN_KEY(slug));
  } catch {
    return null;
  }
}

function useEditToken(slug: string): string | null {
  const [token, setToken] = useState<string | null>(() => readEditToken(slug));
  useEffect(() => {
    const sync = () => setToken(readEditToken(slug));
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, [slug]);
  return token;
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

function PageGate({ slug }: { slug: string }) {
  const { code } = Route.useSearch();
  const editToken = useEditToken(slug);
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
    return <CreateGate slug={slug} onCreated={() => q.refetch()} />;
  }

  const page: ExistingPage | null = data?.exists === true ? data : null;

  return (
    <UnlockGate
      slug={slug}
      page={page}
      ensurePage={ensurePage}
      codePassword={code}
      editToken={editToken}
    />
  );
}

function CreateGate({ slug, onCreated }: { slug: string; onCreated: () => void }) {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [burnMode, setBurnMode] = useState<BurnMode>("never");
  const [busy, setBusy] = useState(false);
  const [encryptPhase, setEncryptPhase] = useState<EncryptionPhase | null>(null);
  const [created, setCreated] = useState<{
    editToken: string;
    expiresAt: string | null;
    key: CryptoKey;
    updatedAt: string;
  } | null>(null);

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
      const salt = newSalt();
      setEncryptPhase("deriving");
      const key = await deriveKey(pw, salt, DEFAULT_KDF_PARAMS);
      setEncryptPhase("encrypting");
      const { ciphertext, iv } = await encrypt(key, serializeWorkbook(createEmptyWorkbook()));
      setEncryptPhase("uploading");
      const res = await createPage({
        slug,
        ciphertext,
        salt,
        iv,
        kdf_params: DEFAULT_KDF_PARAMS,
        burn_mode: burnMode,
      });
      if (!res.ok) {
        toast.error("That page name was just taken. Reloading…");
        onCreated();
        return;
      }
      try {
        localStorage.setItem(EDIT_TOKEN_KEY(slug), res.edit_token);
      } catch {
        /* ignore */
      }
      history.replaceState(null, "", window.location.pathname);
      setEncryptPhase("done");
      setCreated({
        editToken: res.edit_token,
        expiresAt: res.expires_at,
        key,
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      toast.error((err as Error).message || "Could not create page");
    } finally {
      setBusy(false);
      setEncryptPhase(null);
    }
  };

  if (created) {
    const workbook = createEmptyWorkbook();
    return (
      <Editor
        slug={slug}
        initialWorkbook={workbook}
        initialActiveSheetId={workbook.primary_sheet_id}
        initialUpdatedAt={created.updatedAt}
        cryptoKey={created.key}
        editToken={created.editToken}
        burnMode={burnMode}
        expiresAt={created.expiresAt}
      />
    );
  }

  return (
    <GateShell>
      <NoteCard>
        <NoteBadge>New place</NoteBadge>
        <h1 className="mt-4 font-display text-[1.65rem] font-light leading-tight tracking-tight text-foreground sm:text-3xl">
          Name your <span className="text-primary">/{slug}</span>
        </h1>
        <p className="mt-3 text-sm font-light leading-relaxed text-muted-foreground sm:text-base">
          Your password never leaves your device. We cannot reset it — if you lose it, this place
          cannot be recovered.
        </p>
        <form onSubmit={submit} className="mt-8 space-y-4">
          <PasswordInput label="Create password" value={pw} onChange={setPw} autoFocus />
          <PasswordInput label="Confirm password" value={pw2} onChange={setPw2} />

          <div>
            <span className="mb-2 block font-mono text-[11px] uppercase tracking-[0.2em] text-clay">
              Lifetime
            </span>
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
            <p className="mt-3 text-[11px] font-light text-muted-foreground">
              You can change this any time from the editor.
            </p>
          </div>

          <button type="submit" disabled={busy} className="btn-moss mt-2 flex h-12 w-full items-center justify-center gap-2 disabled:opacity-60">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            {busy ? "Securing your place…" : "Create encrypted page"}
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
  editToken,
}: {
  slug: string;
  page: ExistingPage | null;
  ensurePage: () => Promise<ExistingPage>;
  codePassword?: string;
  editToken: string | null;
}) {
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(!!codePassword);
  const [unlocked, setUnlocked] = useState<{ key: CryptoKey; plaintext: string; updatedAt: string } | null>(null);

  const unlockWithPassword = async (password: string) => {
    const loaded = page ?? (await ensurePage());
    const key = await deriveKey(password, loaded.salt, loaded.kdf_params as KdfParams);
    const plaintext = await decrypt(key, loaded.ciphertext, loaded.iv);
    setUnlocked({ key, plaintext, updatedAt: loaded.updated_at });
  };

  useEffect(() => {
    if (!codePassword || unlocked) return;
    let cancelled = false;
    (async () => {
      setBusy(true);
      try {
        await unlockWithPassword(codePassword);
        stripCodeFromUrl();
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
      await unlockWithPassword(pw);
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

  if (unlocked) {
    const workbook = parseWorkbook(unlocked.plaintext);
    const preferred =
      getSheetIdFromHash() ?? readLastOpenedSheet(slug) ?? workbook.primary_sheet_id;
    const initialActiveSheetId = resolveInitialSheetId(workbook, preferred);
    const burnMode = page?.burn_mode ?? "never";
    const expiresAt = page?.expires_at ?? null;
    return (
      <Editor
        slug={slug}
        initialWorkbook={workbook}
        initialActiveSheetId={initialActiveSheetId}
        initialUpdatedAt={unlocked.updatedAt}
        cryptoKey={unlocked.key}
        editToken={editToken}
        burnMode={burnMode}
        expiresAt={expiresAt}
      />
    );
  }

  return (
    <GateShell>
      <NoteCard>
        <NoteBadge>{editToken ? "Locked · editable" : "Locked"}</NoteBadge>
        <h1 className="mt-4 font-display text-[1.65rem] font-light leading-tight tracking-tight text-foreground sm:text-3xl">
          Open <span className="text-primary">/{slug}</span>
        </h1>
        <p className="mt-3 text-sm font-light leading-relaxed text-muted-foreground sm:text-base">
          Enter the password to unlock this place.
        </p>
        {expiryNote && (
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-ember/10 px-3 py-1 text-xs font-light text-ember">
            <Flame className="h-3 w-3" /> {expiryNote}
          </p>
        )}
        <form onSubmit={submit} className="mt-8 space-y-4">
          <PasswordInput label="Password" value={pw} onChange={setPw} autoFocus={!codePassword} />
          <button
            type="submit"
            disabled={busy || (!pw && !codePassword)}
            className="btn-moss mt-2 flex h-12 w-full items-center justify-center gap-2 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
            {busy ? (codePassword ? "Unlocking from link…" : "Unlocking…") : "Unlock"}
          </button>
        </form>
      </NoteCard>
    </GateShell>
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

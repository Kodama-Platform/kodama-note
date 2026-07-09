import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Flame, Loader2, Lock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Footer } from "@/components/footer";
import { SiteHeader } from "@/components/site/site-header";
import { Editor } from "@/components/editor";
import {
  EncryptionProgress,
  type EncryptionPhase,
} from "@/components/encryption-progress";
import { slugSchema } from "@/lib/slug";
import { getHashParams, stripCodeFromUrl } from "@/lib/hash-params";
import {
  DEFAULT_KDF_PARAMS,
  decrypt,
  deriveKey,
  encrypt,
  newSalt,
  unlockErrorMessage,
  type KdfParams,
} from "@/lib/crypto";
import { BURN_MODES, createPage, getPage, type BurnMode } from "@/lib/pages";

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
      <Shell>
        <Card>
          <h1 className="font-display text-lg font-light text-foreground">Invalid page name</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {parsed.error.issues[0]?.message}
          </p>
          <div className="mt-6">
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </Link>
          </div>
        </Card>
      </Shell>
    );
  }

  return <PageGate slug={parsed.data} />;
}

function PageGate({ slug }: { slug: string }) {
  const { code } = Route.useSearch();
  const editToken = useEditToken(slug);
  const q = useQuery({
    queryKey: ["page", slug],
    queryFn: () => getPage(slug),
    staleTime: 0,
    refetchOnWindowFocus: false,
  });

  if (q.isLoading) {
    return (
      <Shell>
        <Card>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading page…
          </div>
        </Card>
      </Shell>
    );
  }

  if (q.error) {
    return (
      <Shell>
        <Card>
          <h1 className="font-display text-lg font-light text-foreground">Couldn't load this page</h1>
          <p className="mt-2 text-sm text-muted-foreground">{(q.error as Error).message}</p>
        </Card>
      </Shell>
    );
  }

  const data = q.data!;
  if (!data.exists) {
    return <CreateGate slug={slug} onCreated={() => q.refetch()} />;
  }

  return (
    <UnlockGate
      slug={slug}
      ciphertext={data.ciphertext}
      salt={data.salt}
      iv={data.iv}
      kdfParams={data.kdf_params as KdfParams}
      updatedAt={data.updated_at}
      burnMode={data.burn_mode}
      expiresAt={data.expires_at}
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
      const { ciphertext, iv } = await encrypt(key, "");
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
    return (
      <Editor
        slug={slug}
        initialText=""
        initialUpdatedAt={created.updatedAt}
        cryptoKey={created.key}
        editToken={created.editToken}
        burnMode={burnMode}
        expiresAt={created.expiresAt}
      />
    );
  }

  return (
    <Shell>
      <Card>
        <Badge>New page</Badge>
        <h1 className="mt-3 font-display text-2xl font-light tracking-tight text-foreground">
          Create <span className="text-primary">/{slug}</span>
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your password never leaves your device. We cannot reset it — if you lose it, this page
          cannot be recovered.
        </p>
        <form onSubmit={submit} className="mt-6 space-y-3">
          <PasswordInput label="Create password" value={pw} onChange={setPw} autoFocus />
          <PasswordInput label="Confirm password" value={pw2} onChange={setPw2} />

          <div>
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Lifetime
            </span>
            <div className="grid gap-1.5">
              {BURN_MODES.map((m) => (
                <label
                  key={m.value}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-left text-sm transition-colors ${
                    burnMode === m.value
                      ? "border-primary bg-primary/5"
                      : "border-input hover:bg-accent/30"
                  }`}
                >
                  <input
                    type="radio"
                    name="burn"
                    className="mt-1 accent-current"
                    checked={burnMode === m.value}
                    onChange={() => setBurnMode(m.value)}
                  />
                  <span>
                    <span className="flex items-center gap-1.5 font-medium text-foreground">
                      {m.value === "after_read" && <Flame className="h-3.5 w-3.5" />}
                      {m.label}
                    </span>
                    <span className="block text-xs text-muted-foreground">{m.hint}</span>
                  </span>
                </label>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              You can change this any time from the editor.
            </p>
          </div>

          <button
            type="submit"
            disabled={busy}
            className="mt-2 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-primary text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            {busy ? "Securing…" : "Create encrypted page"}
          </button>

          {encryptPhase && <EncryptionProgress phase={encryptPhase} />}
        </form>
      </Card>
    </Shell>
  );
}

function UnlockGate({
  slug,
  ciphertext,
  salt,
  iv,
  kdfParams,
  updatedAt,
  burnMode,
  expiresAt,
  codePassword,
  editToken,
}: {
  slug: string;
  ciphertext: string;
  salt: string;
  iv: string;
  kdfParams: KdfParams;
  updatedAt: string;
  burnMode: BurnMode;
  expiresAt: string | null;
  codePassword?: string;
  editToken: string | null;
}) {
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(!!codePassword);
  const [unlocked, setUnlocked] = useState<{ key: CryptoKey; plaintext: string } | null>(null);

  const unlockWithPassword = async (password: string) => {
    const key = await deriveKey(password, salt, kdfParams);
    const plaintext = await decrypt(key, ciphertext, iv);
    setUnlocked({ key, plaintext });
  };

  // /slug?code=password — auto-unlock when password is in the link.
  useEffect(() => {
    if (!codePassword || unlocked) return;
    let cancelled = false;
    (async () => {
      setBusy(true);
      try {
        await unlockWithPassword(codePassword);
        stripCodeFromUrl();
      } catch (err) {
        if (!cancelled) toast.error(unlockErrorMessage(err));
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codePassword, slug]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!pw) return;
    setBusy(true);
    try {
      await unlockWithPassword(pw);
    } catch (err) {
      toast.error(unlockErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const expiryNote = useMemo(() => {
    if (burnMode === "after_read") return "This page will burn after the next read.";
    if (expiresAt) return `Expires ${new Date(expiresAt).toLocaleString()}.`;
    return null;
  }, [burnMode, expiresAt]);

  if (unlocked) {
    return (
      <Editor
        slug={slug}
        initialText={unlocked.plaintext}
        initialUpdatedAt={updatedAt}
        cryptoKey={unlocked.key}
        editToken={editToken}
        burnMode={burnMode}
        expiresAt={expiresAt}
      />
    );
  }

  if (codePassword && busy) {
    return (
      <Shell>
        <Card>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Unlocking from link…
          </div>
        </Card>
      </Shell>
    );
  }

  return (
    <Shell>
      <Card>
        <Badge>{editToken ? "Locked · editable" : "Locked"}</Badge>
        <h1 className="mt-3 font-display text-2xl font-light tracking-tight text-foreground">
          <span className="text-primary">/{slug}</span>
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Enter the password to unlock this page.
        </p>
        {expiryNote && (
          <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
            <Flame className="h-3 w-3" /> {expiryNote}
          </p>
        )}
        <form onSubmit={submit} className="mt-6 space-y-3">
          <PasswordInput label="Password" value={pw} onChange={setPw} autoFocus />
          <button
            type="submit"
            disabled={busy || !pw}
            className="mt-2 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-primary text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
            {busy ? "Unlocking…" : "Unlock"}
          </button>
        </form>
      </Card>
    </Shell>
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
      <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</span>
      <input
        type="password"
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full rounded-xl border border-input bg-background px-4 text-sm text-foreground outline-none transition-all focus-visible:border-ring focus-visible:ring-4 focus-visible:ring-ring/20"
        autoComplete="off"
      />
    </label>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      <SiteHeader variant="note" />
      <main className="flex flex-1 items-center justify-center px-6 pb-16 pt-6">
        <div className="w-full max-w-md">{children}</div>
      </main>
      <Footer />
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-border bg-card p-7 shadow-soft">{children}</div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-[0.2em] text-primary">
      {children}
    </span>
  );
}

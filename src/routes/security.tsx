import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { Reveal } from "@/components/site/reveal";
import { SiteLayout } from "@/components/site/site-layout";
import { CryptoSpec } from "@/components/security/crypto-spec";
import { ThreatModelFlow } from "@/components/security/threat-model-flow";
import { VisibilityTable } from "@/components/security/visibility-table";
import { SITE } from "@/lib/brand";
import {
  CIPHER_SPEC,
  KDF_SPEC,
  LIMITATIONS,
  PRIVACY_PRINCIPLES,
} from "@/lib/security";

export const Route = createFileRoute("/security")({
  component: SecurityPage,
});

function SecurityPage() {
  return (
    <SiteLayout>
      <main className="mx-auto max-w-3xl px-5 pb-24 pt-10 sm:px-8 sm:pt-16">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm font-light text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back
        </Link>

        <Reveal>
          <p className="mt-8 font-mono text-xs uppercase tracking-[0.34em] text-clay">Security</p>
          <h1 className="mt-4 font-display text-4xl font-light tracking-tight text-foreground sm:text-5xl">
            Can Kodama read your pages?
          </h1>
          <p className="mt-4 text-base font-light leading-relaxed text-muted-foreground">
            <strong className="font-medium text-foreground">No.</strong> Page contents are encrypted in
            your browser before upload. Kodama stores ciphertext we cannot decrypt without your
            password — and we never receive your password.
          </p>
        </Reveal>

        <Section title="Threat model">
          <p className="text-sm leading-relaxed text-muted-foreground">
            This is the entire data path. If any step fails to hold, we would be able to read your
            pages. Today, none of them do.
          </p>
          <div className="mt-8">
            <ThreatModelFlow />
          </div>
        </Section>

        <Section title="What we know — and what we don't">
          <p className="text-sm leading-relaxed text-muted-foreground">
            Zero-knowledge does not mean zero data. We are explicit about the metadata we retain.
          </p>
          <div className="mt-6">
            <VisibilityTable />
          </div>
        </Section>

        <Section title="Cryptography specification">
          <p className="text-sm leading-relaxed text-muted-foreground">
            The protocol below is what Note implements. We publish this specification so
            cryptographers and security engineers can evaluate our design without needing access to
            the full application.
          </p>
          <div className="mt-8">
            <CryptoSpec vertical />
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            <SpecCard title="Key derivation">
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                <li>Algorithm: {KDF_SPEC.algorithm}</li>
                <li>Memory: {KDF_SPEC.memoryMiB} MiB ({KDF_SPEC.memoryKiB} KiB)</li>
                <li>Iterations: {KDF_SPEC.iterations}</li>
                <li>Parallelism: {KDF_SPEC.parallelism}</li>
                <li>Output: {KDF_SPEC.hashLength}-bit key</li>
                <li>Salt: {KDF_SPEC.saltBytes} random bytes (per page)</li>
              </ul>
            </SpecCard>
            <SpecCard title="Symmetric encryption">
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                <li>Algorithm: {CIPHER_SPEC.algorithm}</li>
                <li>IV: {CIPHER_SPEC.ivBytes} random bytes (per encryption)</li>
                <li>API: {CIPHER_SPEC.api}</li>
                <li>Attachments: same scheme, separate IVs</li>
                <li>Version history: each version is a new ciphertext + IV</li>
              </ul>
            </SpecCard>
          </div>
        </Section>

        <Section title="Password handling">
          <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
            <p>
              Your password is entered in the browser and used only to derive an encryption key via
              Argon2id. It is never transmitted to Kodama servers, never logged, and never stored in
              localStorage or cookies.
            </p>
            <p>
              We cannot reset, recover, or verify your password. Wrong-password detection happens
              client-side when AES-GCM decryption fails.
            </p>
          </div>
        </Section>

        <Section title="If our servers are compromised">
          <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
            <p>
              An attacker with full database access would obtain ciphertext blobs, salts, IVs, KDF
              parameters, slugs, and timestamps. They would <em>not</em> obtain passwords, keys, or
              plaintext.
            </p>
            <p>
              Decrypting pages still requires brute-forcing each password through Argon2id — a
              deliberately slow operation (64 MiB memory, 3 iterations per our defaults). Strong,
              unique passwords remain the user's best defense.
            </p>
          </div>
        </Section>

        <Section title="Metadata we store">
          <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-muted-foreground">
            <li>Page slug, ciphertext, salt, IV, and serialized KDF parameters</li>
            <li>Burn mode and optional expiry timestamp</li>
            <li>Edit and view tokens (opaque random strings — not derived from your password)</li>
            <li>Encrypted attachment blobs and encrypted filenames</li>
            <li>Version history as additional ciphertext records</li>
          </ul>
        </Section>

        <Section title="Honest limitations">
          <div className="space-y-4">
            {LIMITATIONS.map((item) => (
              <div key={item.title} className="rounded-xl border border-border bg-card p-4">
                <h3 className="text-sm font-semibold text-foreground">{item.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Who built Kodama">
          <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
            <p>
              Kodama is a small studio building quiet internet tools — present, calm, and
              unobtrusive. Note exists because sharing text privately should not require an account,
              an app install, or trust in a company to "be good" with your data.
            </p>
            <p>Our design principles for Note:</p>
            <ul className="list-disc space-y-1.5 pl-5">
              {PRIVACY_PRINCIPLES.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
            <p>
              <a
                href={`${SITE.mainUrl}/about`}
                className="text-foreground underline underline-offset-4 hover:text-primary"
              >
                Read more about Kodama →
              </a>
            </p>
          </div>
        </Section>

        <Section title="Independent validation">
          <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
            <p>
              We have not yet completed a third-party security audit. When we do, results will be
              published here.
            </p>
            <p>
              In the meantime, the cryptography specification above describes exactly what to
              verify. The client-side encryption implementation is available for expert review on{" "}
              <a
                href={`${SITE.github}/tree/main/src/lib/crypto.ts`}
                className="text-foreground underline underline-offset-4 hover:text-primary"
                target="_blank"
                rel="noreferrer"
              >
                GitHub
              </a>
              , along with cryptographic test vectors.
            </p>
          </div>
        </Section>
      </main>
    </SiteLayout>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-14 border-t border-border pt-10">
      <h2 className="font-display text-2xl font-light tracking-tight text-foreground">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function SpecCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <div className="mt-3">{children}</div>
    </div>
  );
}

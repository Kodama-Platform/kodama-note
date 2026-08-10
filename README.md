# kodama-note

A zero-knowledge, end-to-end encrypted place for writing, sharing, and owning your thoughts.

Cryptography follows **Kodama Note Protocol (KNP-1)** on **Kodama Security Core (KSC-1 / 0.2.0)** via `@kodama.page/core` and `@kodama.page/security-browser`.

**Security profile:** production security **candidate**. Not production-proven until KNP-1 §14 (audits, fuzz corpus, signed releases) is completed. See [`docs/KODAMA_NOTE_PROTOCOL.md`](docs/KODAMA_NOTE_PROTOCOL.md).

## Auth model (KNP-1)

| Action | Authorization |
|--------|----------------|
| Read | `#read=` capability fragment or owner password |
| Edit / save | Owner or editor signing key + signed state header |
| Owner settings | Password unlock (owner role) |

The Delivery Gate stores ciphertext and public meta only — it never decrypts notes. Writes go through `knp-create-page` / `knp-append-version` edge functions (or RPC fallback in local/dev).

Deploy migrations and edge functions before saving in production:

```bash
# From kodama-note/
supabase db push
yarn vendor:ksc
supabase functions deploy knp-create-page
supabase functions deploy knp-append-version
```

| Edge function | Purpose |
|---------------|---------|
| `knp-create-page` | Accept KNP meta + envelope ciphertext, insert page |
| `knp-append-version` | Monotonic version + writer checks, append ciphertext |

Prior temporary KSP pages are wiped (not migrated). Create new notes under KNP-1.

## Development

```bash
yarn install
yarn dev
yarn test
```

Shared live Markdown editor (floating toolbar) lives in [`packages/kodama-editor`](packages/kodama-editor) as `@kodama.page/editor`. Standalone playground:

```bash
yarn dev:editor
```

Opens at `http://127.0.0.1:5180/`.

Link local KSC packages via `file:../kodama-security-core/packages/...` in `package.json` (Vite/Vitest also alias to package sources).

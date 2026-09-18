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

The Delivery Gate stores an encrypted **private-tab bundle** and **public tab documents**. It never decrypts private notes. **This repo is the trusted client only.** Set `VITE_BACKEND_URL` to the gate root; notes are `{VITE_BACKEND_URL}/v1/notes` and files are `{VITE_BACKEND_URL}/v1/files`.

Assumed routes: [`docs/NOTE_API.md`](docs/NOTE_API.md). Do not add SQL, edge functions, or a backend in this repo.

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

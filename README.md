# kodama-note

A zero-knowledge, end-to-end encrypted place for writing, sharing, and owning your thoughts.

Cryptography follows [Kodama Security Protocol (KSP)](../kodama-security-protocol/docs/KODAMA_SECURITY_PROTOCOL.md) via `@kodama.page/ksp-core`.

## KSP auth model

| Action | Authorization |
|--------|----------------|
| Read | `#read=` URL fragment or password |
| Edit / save | Ed25519-signed wire payload + editor private key (from password or out-of-band import) |
| Owner settings | Owner private key (from password) |

There is **no server `edit_token`** for KSP places. KSP writes are verified server-side (Ed25519) via Supabase Edge Functions before persisting.

Deploy migrations and edge functions before saving in production:

```bash
# From kodama-note/
supabase db push
npm run vendor:ksp
supabase functions deploy ksp-append-version
supabase functions deploy ksp-create-page
supabase functions deploy ksp-migrate-page
```

| Edge function | Purpose |
|---------------|---------|
| `ksp-create-page` | Verify owner create signature, then insert page |
| `ksp-append-version` | Verify editor edit signature, then append version |
| `ksp-migrate-page` | Verify create signature + legacy `edit_token`, then rewrite place to KSP |

Direct client calls to `kodama_ksp_append_version` are revoked for anon/authenticated roles; only the `ksp-append-version` edge function (service role) may invoke it after verification. Attachment and expiry RPCs remain open until signed edge functions are added.

## Development

```bash
npm install
npm run dev
npm test
```

Link local KSP packages via `file:../kodama-security-protocol/packages/core` in `package.json`.

# Kodama backend — basic requirements

Hand this to the backend team. The browser is the trusted client. The server stores and delivers **ciphertext and public metadata only**.

```text
https://api.kodama.com/v1
├── /notes     Note Delivery Gate (this product)
└── /files     Global object store  ← Note, Talk, Place
```

**v1 does not include payment.** No `/v1/pay`, no place bind, no paid unlock, no entitlements. Every place is free to read (with the password or a share capability). Billing ships later.

---

## 0. Hard rules (all products)

1. **Never receive or derive secrets.** No password, CEK, reader secret, wrapping key, or plaintext note/message/file.
2. **Never decrypt.** No `POST /decrypt`. If the blob is opaque, store it and return it.
3. **Public metadata only** on the server for private data: slug, ciphertext, salt, IVs, KDF/public place meta, signatures, sizes, timestamps, burn/expiry, presentation settings. **Public tabs** are signed plaintext Markdown — the one intentional exception. Never store private tab titles or content in public rows.
4. **Writes are capability-signed**, not “log in to edit the note.” Place `owner_public_key` + Ed25519 over the request. No Kodama account session in v1.
5. **Errors:** `{ "error": "…" }` and/or `{ "reason": "slug_taken" | … }`.  
   `409` + `slug_taken`. `404` = missing.

---

## 1. Note Delivery Gate — `/v1/notes`

Base: `{VITE_BACKEND_URL}/v1/notes` (Delivery Gate root + `/v1/notes`). Optional override: `VITE_NOTE_API_URL`.

A Place is **public tab documents + one encrypted private-tab bundle**. Public readers never learn private titles or that private tabs exist. Private ciphertext is a separate resource.

**v1 stores one current private snapshot per slug** (overwrite). Public tabs are individual signed rows. No version history.

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `GET` | `/{slug}` or `/{slug}/public` | none | Place identity, settings, public tabs. **No** private envelope or private metadata. |
| `GET` | `/{slug}/private` | none | Opaque private bundle only. |
| `POST` | `/` | owner signature | Create place. Body: `slug`, `ciphertext` (b64), `salt`, `kdf_params`, `burn_mode`, `owner_public_key`, `state_signature`. `409` if slug taken. |
| `PUT` | `/{slug}/private` | owner or editor | Replace the private envelope (content save **or** password change). |
| `PATCH` | `/{slug}` | owner | Update `burn_mode` only. |
| `GET` | `/{slug}/settings` | none | Public presentation. Missing → client defaults. |
| `PUT` | `/{slug}/settings` | **owner** | Change look. |
| `POST` | `/{slug}/tabs` | owner or editor | Create a public tab (plaintext Markdown + signature). |
| `PUT` | `/{slug}/tabs/{tab_id}` | owner or editor | Replace a public tab. |
| `DELETE` | `/{slug}/tabs/{tab_id}` | owner or editor | Delete a public tab. |
| `POST` | `/{slug}/tabs/{tab_id}/publish` | **owner** | Atomic publish: insert public row + replace private ciphertext. |
| `POST` | `/{slug}/tabs/{tab_id}/unpublish` | **owner** | Atomic unpublish: replace private ciphertext + delete public row. |

Publish/unpublish must be one database transaction. `expected_revision` on the private envelope is concurrency control, not a version history.

### `GET /{slug}` (public reader)

```json
{
  "slug": "kodama",
  "title": "Kodama",
  "description": "A quieter internet starts here.",
  "settings": { "schema": "knp-place-settings-1", "preset": "paper" },
  "tabs": [
    {
      "id": "tab-001",
      "public_slug": "welcome",
      "title": "Welcome to Kodama",
      "content_markdown": "...",
      "display_order": 0
    }
  ]
}
```

`burn_mode`: `never` | `after_read` | `1h` | `24h` | `7d`. Server computes `expires_at` for timed modes. After-read: delete (or tombstone) ciphertext after first successful reader fetch — still never decrypt.

### Change settings (look)

`PUT /{slug}/settings` is how the owner changes font, size, colors, and spacing. Readers and editors see the new look on the next `GET` — no unlock required.

Public, not encrypted. Signed `purpose`: `"knp-place-settings-1"`. **Owner only** (verify against stored `owner_public_key`). Editors cannot change settings.

Fields: `schema`, `preset` (`default|paper|ink|sepia|dusk|moss|custom`), `background`, `text`, `font` (`sans|serif|mono`), `font_size` (`85|100|115|130`), `line_height` (1.2–2.2), `letter_spacing` (−0.04–0.08), `paragraph_spacing` (`tight|normal|relaxed`), `view_width` (`comfortable|tablet|full`).

Request is the settings document plus:

```json
{
  "owner_public_key": "<base64 Ed25519 — must match stored owner>",
  "state_signature": "<base64>"
}
```

`state_signature` is Ed25519 over CBOR `{ purpose, slug, document }` where `purpose` is `"knp-place-settings-1"` and `document` is the settings object **without** the signature fields.

Do **not** put settings inside the encrypted workbook (that would flash default chrome, then restyle after unlock).

### Change password (place password, not Kodama account)

The server **never** receives the old or new password and **cannot reset** it. There is no email / “forgot password” flow.

The owner client already has `changePassword`: it re-derives keys in the browser (new salt, new Argon2 wrap, re-wrap CEK) and then **saves** with `PUT /{slug}`.

| Who | What the server does |
|-----|----------------------|
| Owner | `PUT /{slug}` with new `salt`, new `kdf_params` (new protected-master-key record and possibly new `owner_public_key`), new `ciphertext`. Signature must verify against the **currently stored** `owner_public_key`. After verify, atomically replace `salt`, `kdf_params`, `ciphertext`, and the stored owner key if it changed. |
| Editor | May `PUT /{slug}` to save content only. Must **not** change `salt` or `owner_public_key`. Reject if those fields differ from the stored row (`403`). |
| Anyone else | `403`. |

```json
{
  "ciphertext": "<base64>",
  "salt": "<base64 — new on password change>",
  "kdf_params": { "protocol": "knp-1", "storage_mode": "knp-envelope", "owner_public_key": "<new or same>" },
  "writer_public_key": "<base64 — current owner, for this request>",
  "state_signature": "<base64>"
}
```

If `kdf_params.owner_public_key` ≠ stored owner key, treat the request as a password change: verify with the **old** stored key, then store the new key. Last write wins (same as content save).

Share links (`#read=` / `#editor=`) keep working after a routine password change (CEK is re-wrapped, not rotated). Full access rotation (new CEK) is out of scope for v1.

There is no Kodama account on this API in v1. The place password is the only secret, and it never leaves the device.

### What Note must not implement

| Do not add | Why |
|------------|-----|
| `POST /{slug}/decrypt` | Server must never see keys. |
| Private sheet CRUD / private titles on public GET | Private tabs live only in the encrypted bundle. |
| `POST /{slug}/versions` / history | **Deferred.** v1 is overwrite-only (`PUT /{slug}`). |
| `/v1/pay`, `/{slug}/payment`, entitlements, paid unlock | **Deferred.** v1 is free access for every slug. |
| User profile / account password reset | No accounts in v1. Place password is `PUT /{slug}` only — no server reset. |
| **File blob upload under `/v1/notes/…/files`** | Use **global `/v1/files`** (below). |

Note may keep thin **compatibility aliases** that proxy to `/v1/files` if needed during migration. New work should call `/v1/files` directly.

---

## 2. Global Files API — `/v1/files`

**One object store for Kodama Note, Kodama Talk, and Kodama Place.**  
Not a Note feature. Products only store an object **id / URL** inside their own encrypted payloads.

```text
Note  ──►  /v1/files   ◄──  Talk
                ▲
                └──  Place
```

### Object model

The server stores an **opaque octet-stream**. It does not interpret bytes as an image, PDF, or message. Clients encrypt before upload (Note already does). Talk/Place may upload ciphertext or, if a product explicitly allows public media, plaintext — the store does not care.

| Field | Who sees it | Notes |
|-------|-------------|--------|
| `id` | public | UUID. |
| `url` | public | Canonical GET URL for the blob. This is what Note inserts in markdown. |
| `storage_path` | public | Object key in the bucket (`{product}/{place_id}/{random}.bin`). |
| `product` | public | `note` \| `talk` \| `place`. |
| `place_id` | public | Note: slug. Talk/Place: their place/room id. |
| `size` | public | Plaintext or ciphertext byte length as reported by the client. |
| `mime` | public | Client-declared (`image/png`, `application/octet-stream`, …). Not trusted for security. |
| `iv`, `filename_ciphertext`, `filename_iv` | public | Optional product metadata. Note sends these; Talk/Place may omit or send their own. Server must not try to decrypt the filename. |
| `created_at` | public | |
| checksum (optional) | public | Client-supplied SHA-256 of **stored bytes** for integrity, not confidentiality. |

v1 has no paid plans. Enforce a simple per-object max (**20 MiB**, what Note sends today) and a sane per-place byte cap if you need abuse protection. Plan tables come back with billing.

### Routes

Base: `https://api.kodama.com/v1/files`

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `POST` | `/` | product write capability | Create object metadata + receive upload target. |
| `PUT` | `/{id}` or signed upload URL | same | Upload raw bytes (`Content-Type: application/octet-stream`). |
| `GET` | `/{id}` | none | Download bytes. `404` if missing / expired / burned. |
| `GET` | `?product=&place_id=` | product read capability | List metadata for a place (no bytes). |
| `DELETE` | `/{id}` | product write capability | Delete metadata **and** the blob (S3/object store). `404` if already gone. |

**Preferred upload (two-step, works on S3):**

1. `POST /v1/files`  
   ```json
   {
     "product": "note",
     "place_id": "garden",
     "size": 184320,
     "mime": "image/png",
     "iv": "<b64>",
     "filename_ciphertext": "<b64>",
     "filename_iv": "<b64>"
   }
   ```  
   Response:
   ```json
   {
     "id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
     "url": "https://api.kodama.com/v1/files/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
     "storage_path": "note/garden/<random>.bin",
     "upload": {
       "method": "PUT",
       "url": "https://…presigned-s3…",
       "headers": { "Content-Type": "application/octet-stream" }
     },
     "created_at": "…"
   }
   ```
2. Client `PUT`s ciphertext to `upload.url` (S3 or the same API).
3. Client puts **`url`** (or `id`) into the product document (Note: markdown `![alt](url)`).

Direct `PUT https://api.kodama.com/v1/files/{id}` that the API proxies to S3 is also acceptable if presign is not ready. Do **not** nest blobs under `/v1/notes/{slug}/files/…` as the long-term contract.

### Auth for files

Same pattern as Note writes, scoped by product:

- **Note:** owner or editor signature for the slug (`place_id`). Readers may `GET` the blob (bytes are useless without the note key).
- **Talk / Place:** their own room/place capability (define when those products ship). Same routes, different `product` + verifier.

List/delete: only holders of the place write capability (Note owner/editor). Do not let a stolen file URL list sibling objects.

### Limits (v1, no plans)

Reject `POST`/`PUT` with `413` when over the object size cap (**20 MiB**). Optional: a per-place total-byte cap to stop abuse. No `402`, no entitlement lookup.

### Lifecycle / GC

- `DELETE /{id}` **must** remove the object from S3/storage, not only the row.
- Note client, on save, lists files for `product=note&place_id={slug}`, diffs against image URLs still in the workbook, and deletes unused ids. The API must make that safe and idempotent.
- When a Note place is burned / expired / deleted, **cascade-delete** all `/v1/files` objects with that `product` + `place_id`.
- Unused objects may also be GC’d server-side if `created_at` is old and nothing has referenced them — optional; client GC is required.

### CORS

Browser clients on `https://note.kodama.page`, Talk, and Place origins must be allowed to `PUT`/`GET`/`DELETE` `/v1/files` (and presigned S3 if used).

---

## 3. Storage & ops

- Object store (S3-compatible) for `/v1/files` blobs. Server-side encryption at rest is fine; it is **not** a substitute for client encryption.
- Postgres (or similar) for note rows, **public tab rows**, settings, file metadata.
- Slugs: unique, URL-safe; `POST /` is atomic (`409` if taken).
- One private ciphertext column per slug. `PUT /{slug}/private` replaces it. Last write wins. Public tabs are separate rows; publish/unpublish is transactional.
- No analytics that store IP tied to slug reads (Note privacy claim).

---

## 4. Out of scope for v1 backend

- Decrypting or transcoding images.
- Antivirus as a blocker for ciphertext (bytes are opaque).
- Per-device theme / zoom (client `localStorage`).
- Talk rooms / Place pages (products come later; they reuse `/v1/files`).
- Note version history (`POST /{slug}/versions`, snapshots, `expected_version`).
- **Payment:** `/v1/pay`, place payment bind, entitlements, paid unlock, donate destinations, invoices. Revisit when billing ships.
- SQL or edge functions in this client repo. Assume the Delivery Gate already implements the routes above.

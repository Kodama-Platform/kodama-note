# Kodama Note backend REST API

This repo is the trusted client. The backend is a separate service.

**Delivery Gate root:** `VITE_BACKEND_URL` (example `https://….supabase.co/functions/v1/delivery-gate`)

**Note base:** `{VITE_BACKEND_URL}/v1/notes` (or `VITE_NOTE_API_URL` if set)

A Place is **public tab documents plus one encrypted private-tab bundle**. The server never receives a password, CEK, reader secret, or **private** plaintext. Public tabs are an explicit exception: owner-signed Markdown that anyone may read.

JSON errors: `{ "error": "…" }` or `{ "reason": "slug_taken" }`.

Auth on writes is capability-signed (`owner_public_key` / editor key + Ed25519). No Kodama login.

v1 is overwrite-only (no version history). **Payment is deferred.**

---

## 1. Place + private bundle

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `GET` | `/{slug}` | none | Public place row: identity, settings, **public tabs**. Do not include private titles, counts, or ciphertext. |
| `GET` | `/{slug}/public` | none | Same public view if not nested on `GET /{slug}`. |
| `GET` | `/{slug}/private` | none | Opaque private envelope only (`ciphertext`, `salt`, `kdf_params`). `404` if the place is missing. |
| `POST` | `/` | owner signature | Create place. Body includes initial private envelope + public keys. `409` = slug taken. |
| `PUT` | `/{slug}/private` | owner or editor | Replace the private-tab ciphertext. Last write wins. |
| `PUT` | `/{slug}` | owner or editor | Legacy alias for private replace / password change. |
| `PATCH` | `/{slug}` | owner | Burn/expiry only. |

Attachment blobs use global `/v1/files` (`GET /v1/files?product=note&place_id={slug}` to list). There is no `/{slug}/attachments`.

### `GET /{slug}` / `GET /{slug}/public`

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
      "display_order": 0,
      "revision": 1
    }
  ]
}
```

Never return `private_tabs`, private titles, private counts, or the private envelope on this resource.

### `GET /{slug}/private`

```json
{
  "slug": "kodama",
  "ciphertext": "<base64>",
  "salt": "<base64>",
  "kdf_params": { "protocol": "knp-1", "storage_mode": "knp-envelope" },
  "private_revision": 7
}
```

---

## 2. Public tabs

Existence of a row means the tab is public. Visibility is **not** stored only inside the encrypted bundle.

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `POST` | `/{slug}/tabs` | owner or editor | Create a public tab (signed plaintext Markdown). |
| `PUT` | `/{slug}/tabs/{tab_id}` | owner or editor | Replace a public tab. |
| `DELETE` | `/{slug}/tabs/{tab_id}` | owner or editor | Remove a public tab. |
| `POST` | `/{slug}/tabs/{tab_id}/publish` | **owner** | Atomic: insert public row + replace private envelope. |
| `POST` | `/{slug}/tabs/{tab_id}/unpublish` | **owner** | Atomic: replace private envelope + delete public row. |

Signed `purpose` values: `knp-public-tab-create-1`, `knp-public-tab-put-1`, `knp-public-tab-delete-1`, `knp-public-tab-publish-1`, `knp-public-tab-unpublish-1`.

Publish/unpublish must be one transaction. Editors may edit public Markdown; only the owner may change confidentiality.

Public Markdown is an XSS boundary: disable raw HTML, sanitize on render, block `javascript:` URLs.

---

## 3. Place settings

Unchanged: `GET/PUT /{slug}/settings`. Public presentation, signed `knp-place-settings-1`, owner only.

---

## 4. Password change

Owner re-wraps keys in the browser, then `PUT /{slug}/private` (or `PUT /{slug}`) with new `salt`, `kdf_params`, and ciphertext. The server never receives the password. Editors must not change `salt` or `owner_public_key`.

---

## 5. What not to add

| Tempting route | Why not |
|----------------|---------|
| `POST /{slug}/decrypt` | Server must never see keys. |
| Private tab titles on `GET /public` | Titles are sensitive. |
| `/v1/pay` | Deferred. |
| `/{slug}/payment` or `/{slug}/entitlement` | Deferred. v1 is free access. |
| `/{slug}/files/…` | Use global `/v1/files`. |

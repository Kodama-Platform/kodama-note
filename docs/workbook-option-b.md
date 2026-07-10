# Workbook Option B — Per-Sheet Ciphertext (Design)

> **Status:** Design only (M4). Not implemented. Option A (single encrypted JSON workbook per version) ships through M2/M5.

## Motivation

Option A re-uploads the **entire workbook JSON** on every sheet edit. That is acceptable for small workbooks but becomes costly when:

- Individual sheets grow large (approaching 256 KB each)
- Users edit one sheet frequently while others are static
- Total workbook size approaches the 1 MB client limit

Option B splits storage into **per-sheet ciphertext blobs** plus an **encrypted manifest** so incremental edits upload only what changed.

## Plaintext shapes (inside encryption)

### Manifest (encrypted once per version snapshot)

```json
{
  "schema_version": 2,
  "primary_sheet_id": "<uuid>",
  "sheets": [
    {
      "sheet_id": "<uuid>",
      "title": "Main",
      "order": 0,
      "created_at": "ISO-8601",
      "updated_at": "ISO-8601"
    }
  ]
}
```

Sheet bodies are **not** embedded in the manifest.

### Sheet blob

Each sheet's markdown is encrypted independently:

```
AES-GCM( markdown UTF-8, AAD = "{slug}:{version}:note:sheet:{sheet_id}" )
```

Manifest ciphertext uses:

```
AAD = "{slug}:{version}:note:manifest"
```

## KSP / API changes (future)

| Operation | Option A (today) | Option B |
|-----------|------------------|----------|
| Read page | `GET /pages/:slug` → one ciphertext | `GET /pages/:slug` → manifest CT + sheet list |
| Read sheet | decrypt full workbook | `GET /sheets/:sheet_id` → sheet CT |
| Append edit | `appendVersion` whole blob | `POST /edits` with `sheet_id` + optional manifest patch |
| Version history | one row per snapshot | manifest row + per-sheet rows or content-addressed blobs |

New RPCs (illustrative):

- `GET /pages/:slug/manifest` — latest manifest ciphertext + IV
- `GET /pages/:slug/sheets/:sheet_id` — sheet ciphertext + IV for a version
- `POST /edits` — `{ edit_token, sheet_id?, manifest?, sheet_ciphertext?, sheet_iv? }`

## Client migration path

1. **Read:** If decrypted payload is JSON with `schema_version: 1`, treat as Option A workbook (current behavior).
2. **Write (transition):** On first save after Option B server is live, client may either:
   - Continue Option A until user opts in, or
   - Split workbook into manifest + sheet blobs in one transactional edit batch.
3. **Read (fallback):** Non-JSON plaintext still migrates to legacy single-sheet workbook (REQ-WB-MIG-02).

## Security notes

- Sheet IDs in URLs (`#sheet=`) remain **non-secret** identifiers; encryption keys stay password-derived.
- AAD binds ciphertext to slug, version, and sheet role — prevents swap/replay across sheets or pages.
- Attachments remain page-scoped; GC still scans all sheet markdown client-side.

## Open questions

- Version history UI: show manifest-only snapshots vs per-sheet deltas?
- Conflict resolution if two devices edit different sheets concurrently?
- Server-side orphan attachment GC vs client advisory only?

## When to implement

Track workbook sizes and p95 save payload in production. Start Option B when:

- Median encrypted payload exceeds ~200 KB, or
- Users report slow saves on multi-sheet workbooks, or
- KSP repo lands manifest/sheet RPCs (PRD §12).

Until then, Option A minimizes protocol churn and ships multi-sheet UX immediately.

# `kodama_delete_attachment` RPC

Client: [`src/lib/pages.ts`](../src/lib/pages.ts) `deleteAttachment()`.

## Contract

```sql
-- Illustrative — implement in KSP / Supabase project
kodama_delete_attachment(
  p_slug text,
  p_edit_token text,
  p_attachment_id uuid
) returns void
```

## Server behavior

1. Resolve `page_id` from `p_slug`; verify `p_edit_token` matches page `edit_token` (same gate as `kodama_register_attachment`).
2. Load `page_attachments` row where `id = p_attachment_id` and `page_id` matches.
3. Delete storage object at `storage_path` from `page-attachments` bucket.
4. Delete the `page_attachments` row.
5. Return success; raise on invalid token, missing row, or storage failure.

## Client usage

- Sheet delete: editor calls once per ID in the deleted sheet's `attachment_ids`.
- Workbook JSON is saved separately via `appendVersion` (no attachment IDs for removed sheet).

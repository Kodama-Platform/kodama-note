# `kodama_knp_delete_attachment` RPC

Client: [`src/lib/pages.ts`](../src/lib/pages.ts) `deleteAttachment()` via `NoteDeliveryClient.deleteEncryptedAttachment`.

## Contract

```sql
kodama_knp_delete_attachment(
    p_slug text,
    p_attachment_id uuid
) returns void
```

## Server behavior

1. Resolve `page_id` from `p_slug` for a `knp-1` place.
2. Delete the `page_attachments` row where `id = p_attachment_id` and `page_id` matches.
3. Raise on missing page, non-KNP protocol, or missing row.

This RPC does not change note ciphertext. The signed attachment manifest is updated on the next `saveState`.

## Client usage

- Sheet delete: editor calls once per ID in the deleted sheet's `attachment_ids`.
- Workbook JSON is saved separately via KNP append (no attachment IDs for a removed sheet).

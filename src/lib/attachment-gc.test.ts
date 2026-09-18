import { describe, expect, it } from "vitest";

import {
  collectMarkdownImageSrcs,
  pruneWorkbookAttachmentIds,
  unusedAttachmentIds,
} from "@/lib/attachment-gc";
import { attachmentStorageUrl } from "@/lib/note-api";
import type { AttachmentRow } from "@/lib/pages";
import { addSheetAttachment, migrateLegacyMarkdown } from "@/lib/workbook";

const ATT_1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ATT_2 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function row(id: string, storage_path: string): AttachmentRow {
  return {
    id,
    storage_path,
    iv: "iv",
    filename_ciphertext: "ct",
    filename_iv: "fiv",
    mime: "image/png",
    size: 10,
    created_at: new Date().toISOString(),
  };
}

describe("attachment-gc", () => {
  it("collects markdown image srcs", () => {
    expect(collectMarkdownImageSrcs(`![a](https://x/y.png)\n![b](kodama-att:${ATT_1})`)).toEqual([
      "https://x/y.png",
      `kodama-att:${ATT_1}`,
    ]);
  });

  it("keeps attachments still referenced by a storage URL", () => {
    const path = "garden/keep.bin";
    const url = attachmentStorageUrl("garden", path);
    const wb = migrateLegacyMarkdown(`![keep](${url})`);
    const rows = [row(ATT_1, path), row(ATT_2, "garden/gone.bin")];
    expect(unusedAttachmentIds(wb, rows).map((r) => r.id)).toEqual([ATT_2]);
  });

  it("prunes attachment_ids that are no longer in the markdown", () => {
    let wb = migrateLegacyMarkdown("just text");
    wb = addSheetAttachment(wb, wb.sheets[0].sheet_id, ATT_1);
    const next = pruneWorkbookAttachmentIds(wb, [row(ATT_1, "garden/x.bin")]);
    expect(next.sheets[0].attachment_ids).toBeUndefined();
  });
});

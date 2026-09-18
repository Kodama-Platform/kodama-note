import { utf8Decode, utf8Encode } from "@kodama.page/core";

import type { WorkbookPayload } from "@/lib/workbook";
import { parsePrivateBundle, serializePrivateBundle } from "@/lib/workbook";

/** Encrypt only the private-tab bundle. Public tabs never enter the envelope. */
export function serializeWorkbookBytes(workbook: WorkbookPayload): Uint8Array {
  return utf8Encode(serializePrivateBundle(workbook));
}

export function deserializeWorkbookBytes(bytes: Uint8Array): WorkbookPayload {
  return parsePrivateBundle(utf8Decode(bytes));
}

/** Minimal attachment manifest document stored beside the note envelope. */
export type NoteAttachmentManifestDoc = {
  readonly v: 1;
  readonly files: ReadonlyArray<{
    readonly attachmentId: string;
    readonly fileKeyB64: string;
    readonly transportManifestB64: string;
    readonly filename?: string;
    readonly mediaType?: string;
  }>;
};

export function serializeManifestDoc(doc: NoteAttachmentManifestDoc): Uint8Array {
  return utf8Encode(JSON.stringify(doc));
}

export function deserializeManifestDoc(bytes: Uint8Array): NoteAttachmentManifestDoc {
  const parsed = JSON.parse(utf8Decode(bytes)) as NoteAttachmentManifestDoc;
  if (parsed?.v !== 1 || !Array.isArray(parsed.files)) {
    throw new Error("invalid note attachment manifest");
  }
  return parsed;
}

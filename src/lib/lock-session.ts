import type { QueryClient } from "@tanstack/react-query";

import { invalidateAttachmentList } from "@/lib/attachment-list";
import { revokeKodamaBlobCache } from "@/lib/kodama-image";

export type LockReason = "manual" | "inactivity";

/** Drop decrypted in-memory material while keeping encrypted server/page caches. */
export function clearDecryptedSession(slug: string, queryClient?: QueryClient): void {
  revokeKodamaBlobCache(slug);
  invalidateAttachmentList(slug, queryClient);
}

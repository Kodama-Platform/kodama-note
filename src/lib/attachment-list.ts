import type { QueryClient } from "@tanstack/react-query";

import { listAttachments, type AttachmentRow } from "@/lib/pages";

export const attachmentsQueryKey = (slug: string) => ["attachments", slug] as const;

const rowsCache = new Map<string, AttachmentRow[]>();
const inflight = new Map<string, Promise<AttachmentRow[]>>();

/** Deduplicated attachment list fetch — shared by the panel and inline image resolver. */
export async function fetchAttachmentList(slug: string): Promise<AttachmentRow[]> {
  const cached = rowsCache.get(slug);
  if (cached) return cached;

  let pending = inflight.get(slug);
  if (!pending) {
    pending = listAttachments(slug)
      .then((rows) => {
        rowsCache.set(slug, rows);
        inflight.delete(slug);
        return rows;
      })
      .catch((err) => {
        inflight.delete(slug);
        throw err;
      });
    inflight.set(slug, pending);
  }
  return pending;
}

export function invalidateAttachmentList(slug: string, queryClient?: QueryClient): void {
  rowsCache.delete(slug);
  inflight.delete(slug);
  queryClient?.invalidateQueries({ queryKey: attachmentsQueryKey(slug) });
}

export function prefetchAttachmentList(slug: string, queryClient: QueryClient): void {
  void queryClient.prefetchQuery({
    queryKey: attachmentsQueryKey(slug),
    queryFn: () => fetchAttachmentList(slug),
    staleTime: 30_000,
  });
}

/** Enable attachment list queries only when the workbook may have server-side files. */
export function shouldFetchAttachmentList(attachmentIds: ReadonlySet<string>): boolean {
  return attachmentIds.size > 0;
}

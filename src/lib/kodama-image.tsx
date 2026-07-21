import { useEffect, useState } from "react";
import Image from "@tiptap/extension-image";
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";

import { fetchAttachmentList } from "@/lib/attachment-list";
import { decryptAttachmentBytes, attachmentContentType } from "@/lib/attachment-crypto";
import type { PlaceCryptoSession } from "@/lib/crypto-context";import { downloadAttachmentBlob } from "@/lib/pages";

export const KODAMA_ATT_PREFIX = "kodama-att:";

export function kodamaAttUrl(id: string): string {
  return `${KODAMA_ATT_PREFIX}${id}`;
}

export function parseKodamaAttUrl(src: string | null | undefined): string | null {
  if (!src?.startsWith(KODAMA_ATT_PREFIX)) return null;
  return src.slice(KODAMA_ATT_PREFIX.length);
}

type ResolverContext = {
  slug: string;
  crypto: PlaceCryptoSession;
  allowedAttachmentIds?: ReadonlySet<string>;
};

const blobCache = new Map<string, string>();

export async function resolveKodamaAttachmentUrl(
  attachmentId: string,
  ctx: ResolverContext,
): Promise<string | null> {
  if (ctx.allowedAttachmentIds && !ctx.allowedAttachmentIds.has(attachmentId.toLowerCase())) {
    return null;
  }
  const cacheKey = `${ctx.slug}:${attachmentId}`;
  const cached = blobCache.get(cacheKey);
  if (cached) return cached;

  const rows = await fetchAttachmentList(ctx.slug);
  const row = rows.find((r) => r.id === attachmentId);
  if (!row) return null;

  const blob = await downloadAttachmentBlob(row.storage_path);
  const ct = new Uint8Array(await blob.arrayBuffer());
  const pt = await decryptAttachmentBytes(ctx.crypto, row, ct);
  const url = URL.createObjectURL(
    new Blob([pt.buffer as ArrayBuffer], { type: attachmentContentType(row.mime) }),
  );  blobCache.set(cacheKey, url);
  return url;
}

export function revokeKodamaBlobCache(slug: string) {
  for (const [key, url] of blobCache.entries()) {
    if (key.startsWith(`${slug}:`)) {
      URL.revokeObjectURL(url);
      blobCache.delete(key);
    }
  }
}

function KodamaImageView({ node, extension }: NodeViewProps) {
  const ctx = extension.options.resolverContext as ResolverContext | undefined;
  const attId = parseKodamaAttUrl(node.attrs.src);
  const [displaySrc, setDisplaySrc] = useState<string | null>(
    attId ? null : (node.attrs.src as string),
  );

  useEffect(() => {
    if (!attId || !ctx) {
      setDisplaySrc(node.attrs.src as string);
      return;
    }
    let cancelled = false;
    resolveKodamaAttachmentUrl(attId, ctx).then((url) => {
      if (!cancelled) setDisplaySrc(url);
    });
    return () => {
      cancelled = true;
    };
  }, [attId, ctx, node.attrs.src]);

  return (
    <NodeViewWrapper className="kodama-image-wrapper">
      {displaySrc ? (
        <img
          src={displaySrc}
          alt={node.attrs.alt ?? ""}
          title={node.attrs.title ?? undefined}
          className="kodama-inline-image"
          draggable={false}
        />
      ) : (
        <div className="kodama-image-placeholder" aria-hidden="true" />
      )}
    </NodeViewWrapper>
  );
}

export function createKodamaImageExtension(resolverContext: ResolverContext) {
  return Image.extend({
    addOptions() {
      return {
        ...this.parent?.(),
        resolverContext,
        inline: false,
        allowBase64: false,
      };
    },
    addNodeView() {
      return ReactNodeViewRenderer(KodamaImageView);
    },
  });
}

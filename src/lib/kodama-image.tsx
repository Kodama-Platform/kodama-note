import { useEffect, useState } from "react";
import Image from "@tiptap/extension-image";
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";

import { fetchAttachmentList } from "@/lib/attachment-list";
import { decryptAttachmentBytes, attachmentContentType } from "@/lib/attachment-crypto";
import type { PlaceCryptoSession } from "@/lib/crypto-context";
import { parseAttachmentStorageUrl } from "@/lib/note-api";
import { downloadAttachmentBlob } from "@/lib/pages";

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
  const cacheKey = `${ctx.slug}:${attachmentId}`;
  const cached = blobCache.get(cacheKey);
  if (cached) return cached;
  if (ctx.allowedAttachmentIds && !ctx.allowedAttachmentIds.has(attachmentId.toLowerCase())) {
    return null;
  }

  const rows = await fetchAttachmentList(ctx.slug);
  const row = rows.find((r) => r.id === attachmentId);
  if (!row) return null;

  const blob = await downloadAttachmentBlob(row.storage_path);
  const ct = new Uint8Array(await blob.arrayBuffer());
  const pt = await decryptAttachmentBytes(ctx.crypto, row, ct);
  const url = URL.createObjectURL(
    new Blob([pt.buffer as ArrayBuffer], { type: attachmentContentType(row.mime) }),
  );
  cachePut(cacheKey, url);
  cachePut(`${ctx.slug}:path:${row.storage_path}`, url);
  return url;
}

function cachePut(key: string, url: string) {
  const existing = blobCache.get(key);
  if (existing && existing !== url) URL.revokeObjectURL(existing);
  blobCache.set(key, url);
}

/** Show a just-pasted file immediately, before the allowed-id set / download catch up. */
export function primeKodamaBlobCache(
  slug: string,
  attachmentId: string,
  file: Blob,
  storagePath?: string,
): string {
  const url = URL.createObjectURL(file);
  cachePut(`${slug}:${attachmentId}`, url);
  if (storagePath) cachePut(`${slug}:path:${storagePath}`, url);
  return url;
}

export async function resolveKodamaAttachmentByPath(
  storagePath: string,
  ctx: ResolverContext,
): Promise<string | null> {
  const pathKey = `${ctx.slug}:path:${storagePath}`;
  const cached = blobCache.get(pathKey);
  if (cached) return cached;
  const rows = await fetchAttachmentList(ctx.slug);
  const row = rows.find((r) => r.storage_path === storagePath);
  if (!row) return null;
  const url = await resolveKodamaAttachmentUrl(row.id, ctx);
  if (url) cachePut(pathKey, url);
  return url;
}

/** Resolve `kodama-att:` or a Note files URL to a displayable blob URL. */
export async function resolveKodamaImageSrc(
  src: string,
  ctx: ResolverContext,
): Promise<string | null> {
  const attId = parseKodamaAttUrl(src);
  if (attId) return resolveKodamaAttachmentUrl(attId, ctx);
  const path = parseAttachmentStorageUrl(src);
  if (path) return resolveKodamaAttachmentByPath(path, ctx);
  return src;
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
      } as unknown as ReturnType<NonNullable<typeof this.parent>>;
    },
    addStorage() {
      return {
        markdown: {
          serialize(
            state: {
              write: (text: string) => void;
              closeBlock: (node: unknown) => void;
              esc: (text: string) => string;
            },
            node: { attrs: { alt?: string | null; src?: string | null; title?: string | null } },
          ) {
            const alt = state.esc(node.attrs.alt || "");
            const src = (node.attrs.src || "").replace(/[()]/g, "\\$&");
            const title = node.attrs.title
              ? ` "${String(node.attrs.title).replace(/"/g, '\\"')}"`
              : "";
            state.write(`![${alt}](${src}${title})`);
            // Block images must close so the next block (e.g. a table) starts on a new line.
            state.closeBlock(node);
          },
          parse: {},
        },
      };
    },
    addNodeView() {
      return ReactNodeViewRenderer(KodamaImageView);
    },
  });
}

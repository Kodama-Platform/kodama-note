import { useEffect, useState } from "react";
import Image, { type ImageOptions } from "@tiptap/extension-image";
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";

import type { KodamaMediaAdapter } from "../types";

function isDirectSrc(src: string): boolean {
  return (
    src.startsWith("http://") ||
    src.startsWith("https://") ||
    src.startsWith("blob:") ||
    src.startsWith("data:") ||
    src.startsWith("/")
  );
}

function MediaImageView({ node, extension }: NodeViewProps) {
  const media = extension.options.media as KodamaMediaAdapter | undefined;
  const src = (node.attrs.src as string | null) ?? "";
  const [displaySrc, setDisplaySrc] = useState<string | null>(() =>
    src && isDirectSrc(src) ? src : null,
  );

  useEffect(() => {
    let cancelled = false;
    if (!src) {
      setDisplaySrc(null);
      return;
    }
    if (isDirectSrc(src) || !media?.resolveSrc) {
      setDisplaySrc(src && isDirectSrc(src) ? src : null);
      return;
    }
    Promise.resolve(media.resolveSrc(src)).then((url) => {
      if (!cancelled) setDisplaySrc(url);
    });
    return () => {
      cancelled = true;
    };
  }, [src, media]);

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

export function createMediaImageExtension(media?: KodamaMediaAdapter) {
  return Image.extend<ImageOptions & { media?: KodamaMediaAdapter }>({
    addOptions() {
      return {
        ...this.parent?.(),
        media,
        inline: false,
        allowBase64: false,
      } as ImageOptions & { media?: KodamaMediaAdapter };
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
            state.closeBlock(node);
          },
          parse: {},
        },
      };
    },
    addNodeView() {
      return ReactNodeViewRenderer(MediaImageView);
    },
  });
}
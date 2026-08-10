/**
 * Note-app adapter over shared `@kodama.page/editor`.
 * Keeps place crypto / attachment resolution in the product layer.
 */
import { forwardRef, useMemo } from "react";
import {
  KodamaEditor,
  type KodamaEditorHandle,
  type Editor,
} from "@kodama.page/editor";

import type { PlaceCryptoSession } from "@/lib/crypto-context";
import {
  parseKodamaAttUrl,
  resolveKodamaAttachmentUrl,
  revokeKodamaBlobCache,
} from "@/lib/kodama-image";

export type RichEditorHandle = KodamaEditorHandle;

type RichEditorProps = {
  initialContent: string;
  onMarkdownChange: (markdown: string) => void;
  /** Fired once after TipTap finishes parsing initial content — use to align save baseline. */
  onBaseline?: (markdown: string) => void;
  slug: string;
  crypto: PlaceCryptoSession;
  canEdit?: boolean;
  /** Existing image attachments may still render; upload is disabled for now. */
  allowedAttachmentIds?: ReadonlySet<string>;
  autoFocus?: boolean;
  focusMode?: boolean;
  /** TipTap empty-state placeholder (keep short when starters are shown below). */
  placeholder?: string;
  onEditorReady?: (editor: Editor | null) => void;
  /** Current heading under the caret / near viewport top (for outline highlight). */
  onActiveHeadingChange?: (heading: string | null) => void;
};

export const RichEditor = forwardRef<RichEditorHandle, RichEditorProps>(
  function RichEditor(
    {
      initialContent,
      onMarkdownChange,
      onBaseline,
      slug,
      crypto,
      canEdit,
      allowedAttachmentIds,
      autoFocus = true,
      focusMode = false,
      placeholder = "Start writing…",
      onEditorReady,
      onActiveHeadingChange,
    },
    ref,
  ) {
    const media = useMemo(
      () => ({
        resolveSrc: async (src: string) => {
          const attId = parseKodamaAttUrl(src);
          if (!attId) return src;
          return resolveKodamaAttachmentUrl(attId, {
            slug,
            crypto,
            allowedAttachmentIds,
          });
        },
        dispose: () => revokeKodamaBlobCache(slug),
      }),
      [slug, crypto, allowedAttachmentIds],
    );

    return (
      <KodamaEditor
        ref={ref}
        value={initialContent}
        onChange={onMarkdownChange}
        onBaseline={onBaseline}
        editable={canEdit ?? false}
        autoFocus={autoFocus}
        focusMode={focusMode}
        placeholder={placeholder}
        toolbar="floating"
        media={media}
        onReady={onEditorReady}
        onActiveHeadingChange={onActiveHeadingChange}
      />
    );
  },
);

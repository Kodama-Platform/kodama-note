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
  resolveKodamaImageSrc,
  revokeKodamaBlobCache,
} from "@/lib/kodama-image";

export type RichEditorHandle = KodamaEditorHandle;

type RichEditorProps = {
  initialContent: string;
  onMarkdownChange: (markdown: string) => void;
  /** Immediate signal that the user edited — do not wait for serialized markdown. */
  onDirty?: () => void;
  /** Fired once after TipTap finishes parsing initial content — use to align save baseline. */
  onBaseline?: (markdown: string) => void;
  slug: string;
  crypto: PlaceCryptoSession;
  canEdit?: boolean;
  /** Existing image attachments may still render; new pastes go through `onUploadImage`. */
  allowedAttachmentIds?: ReadonlySet<string>;
  /** Persist a pasted/dropped image and return the storage URL to insert. */
  onUploadImage?: (file: File) => Promise<string | null>;
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
      onDirty,
      onBaseline,
      slug,
      crypto,
      canEdit,
      allowedAttachmentIds,
      onUploadImage,
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
        resolveSrc: async (src: string) =>
          resolveKodamaImageSrc(src, {
            slug,
            crypto,
            allowedAttachmentIds,
          }),
        upload: onUploadImage,
        dispose: () => revokeKodamaBlobCache(slug),
      }),
      [slug, crypto, allowedAttachmentIds, onUploadImage],
    );

    return (
      <KodamaEditor
        ref={ref}
        value={initialContent}
        onChange={onMarkdownChange}
        onDirty={onDirty}
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

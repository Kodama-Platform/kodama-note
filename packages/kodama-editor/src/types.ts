import type { AnyExtension, Editor } from "@tiptap/core";

import type { EditorHeading } from "./lib/editor-headings";

/** Resolve a markdown image `src` to a displayable URL (blob:, https:, …). */
export type MediaResolveSrc = (src: string) => Promise<string | null> | string | null;

export type KodamaMediaAdapter = {
  /** Resolve non-http image srcs (e.g. product attachment schemes). */
  readonly resolveSrc?: MediaResolveSrc;
  /** Called when the editor unmounts — revoke blob URLs, clear caches. */
  readonly dispose?: () => void;
};

export type KodamaEditorToolbar = "floating" | "static" | "none";

export type KodamaEditorHandle = {
  getMarkdown: () => string;
  setMarkdown: (markdown: string) => void;
  focus: () => void;
  getEditor: () => Editor | null;
  openLinkDialog: () => void;
  countFindMatches: (query: string) => number;
  findMatchAt: (query: string, matchIndex: number) => boolean;
  replaceMatchAt: (query: string, replacement: string, matchIndex: number) => boolean;
  replaceAllMatches: (query: string, replacement: string) => void;
  getHeadings: () => EditorHeading[];
  scrollToHeading: (text: string) => void;
  scrollToHeadingAt: (pos: number) => void;
};

export type KodamaEditorProps = {
  /** Initial markdown (uncontrolled after mount unless setMarkdown is used). */
  readonly value?: string;
  /** @deprecated Prefer `value`. */
  readonly initialContent?: string;
  readonly onChange?: (markdown: string) => void;
  /** @deprecated Prefer `onChange`. */
  readonly onMarkdownChange?: (markdown: string) => void;
  /** Fired after TipTap finishes parsing initial content — align save baselines. */
  readonly onBaseline?: (markdown: string) => void;
  readonly editable?: boolean;
  readonly autoFocus?: boolean;
  readonly focusMode?: boolean;
  readonly placeholder?: string;
  readonly toolbar?: KodamaEditorToolbar;
  readonly slashMenu?: boolean;
  /** Product media adapter (attachments, encrypted blobs, …). */
  readonly media?: KodamaMediaAdapter;
  readonly className?: string;
  readonly onReady?: (editor: Editor | null) => void;
  /** @deprecated Prefer `onReady`. */
  readonly onEditorReady?: (editor: Editor | null) => void;
  readonly onActiveHeadingChange?: (heading: string | null) => void;
  /** Extra TipTap extensions merged after the default schema. */
  readonly extensions?: AnyExtension[];
};

export type { EditorHeading };
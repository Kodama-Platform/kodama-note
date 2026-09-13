import type { AnyExtension } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import Typography from "@tiptap/extension-typography";
import { Table, TableRow, TableCell, TableHeader } from "@tiptap/extension-table";
import { Markdown } from "tiptap-markdown";

import { createMediaImageExtension } from "./extensions/media-image";
import { ListTabExtension } from "./lib/list-tab-extension";
import { KodamaParagraph, KodamaHeading } from "./lib/kodama-aligned-blocks";
import { KodamaText } from "./lib/kodama-html-passthrough";
import { KodamaHighlight } from "./lib/kodama-highlight";
import { KodamaIndent } from "./lib/kodama-indent";
import { KodamaLink } from "./lib/kodama-link";
import { KodamaMarkdownHtml } from "./lib/kodama-markdown-html";
import {
  KodamaSubscript,
  KodamaSuperscript,
  KodamaUnderline,
} from "./lib/kodama-marks";
import {
  KodamaBulletList,
  KodamaTaskItem,
  KodamaTaskList,
} from "./lib/kodama-task-list";
import type { KodamaMediaAdapter } from "./types";

export type CreateKodamaExtensionsOptions = {
  readonly media?: KodamaMediaAdapter;
  readonly placeholder?: string;
  readonly onLinkShortcut?: () => void;
  readonly extraExtensions?: AnyExtension[];
  /** Placeholder + typography chrome. Default true for the live editor. */
  readonly includeChrome?: boolean;
};

/** Shared TipTap schema used by `KodamaEditor` and package tests. */
export function createKodamaExtensions(
  options: CreateKodamaExtensionsOptions = {},
): AnyExtension[] {
  const {
    media,
    placeholder = "Start writing…",
    onLinkShortcut,
    extraExtensions,
    includeChrome = true,
  } = options;

  return [
    StarterKit.configure({
      heading: false,
      paragraph: false,
      text: false,
      underline: false,
      link: false,
      bulletList: false,
      codeBlock: {
        enableTabIndentation: true,
        tabSize: 2,
      },
    }),
    KodamaText,
    KodamaParagraph,
    KodamaHeading.configure({ levels: [1, 2, 3] }),
    KodamaBulletList,
    KodamaTaskList,
    KodamaTaskItem.configure({ nested: true }),
    KodamaLink.configure({
      onLinkShortcut,
    }),
    KodamaUnderline,
    KodamaSubscript,
    KodamaSuperscript,
    KodamaHighlight,
    TextAlign.configure({
      types: ["heading", "paragraph"],
      alignments: ["left", "center", "right"],
    }),
    KodamaIndent,
    KodamaMarkdownHtml,
    Table.configure({ resizable: false }),
    TableRow,
    TableHeader,
    TableCell,
    createMediaImageExtension(media),
    Markdown.configure({
      html: false,
      linkify: true,
      transformPastedText: true,
      transformCopiedText: true,
      breaks: true,
    }),
    ListTabExtension,
    ...(includeChrome
      ? [Placeholder.configure({ placeholder }), Typography]
      : []),
    ...(extraExtensions ?? []),
  ];
}

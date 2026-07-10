import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { useEditor, EditorContent, generateJSON } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Typography from "@tiptap/extension-typography";
import { Table, TableRow, TableCell, TableHeader } from "@tiptap/extension-table";
import type { Editor } from "@tiptap/react";
import { Markdown } from "tiptap-markdown";
import { toast } from "sonner";

import { createKodamaImageExtension, revokeKodamaBlobCache } from "@/lib/kodama-image";
import { uploadEncryptedAttachment } from "@/lib/attachment-upload";
import { handleEditorTabKeydown, ListTabExtension } from "@/lib/list-tab-extension";
import {
  formatAttachmentLimit,
  maxAttachmentsPerSheet,
  type PlanTier,
} from "@/lib/plan-tier";
import {
  KodamaBulletList,
  KodamaTaskItem,
  TaskList,
} from "@/lib/kodama-task-list";
import {
  markdownLikelyHasTaskLists,
  normalizeTaskListMarkdown,
} from "@/lib/normalize-task-markdown";
import {
  assessLinkRisk,
  openExternalLink,
  type LinkRiskAssessment,
} from "@/lib/link-safety";
import { ExternalLinkWarning } from "@/components/external-link-warning";
import { LinkInsertDialog } from "@/components/link-insert-dialog";
import { KodamaLink } from "@/lib/kodama-link";
import {
  resolveHeadingElement,
  scheduleScrollBelowHeader,
  scrollElementBelowHeader,
  scrollViewportYToHeaderOffset,
} from "@/lib/scroll-to-heading";
import {
  collectTextMatches,
  replaceAllTextMatches,
  replaceTextMatch,
  selectTextMatch,
} from "@/lib/editor-find";

export type RichEditorHandle = {
  getMarkdown: () => string;
  setMarkdown: (markdown: string) => void;
  focus: () => void;
  countFindMatches: (query: string) => number;
  findMatchAt: (query: string, matchIndex: number) => boolean;
  replaceMatchAt: (query: string, replacement: string, matchIndex: number) => boolean;
  replaceAllMatches: (query: string, replacement: string) => void;
  scrollToHeading: (text: string) => void;
  insertImageFromFile: (file: File) => Promise<void>;
};

type RichEditorProps = {
  initialContent: string;
  onMarkdownChange: (markdown: string) => void;
  /** Fired once after TipTap finishes parsing initial content — use to align save baseline. */
  onBaseline?: (markdown: string) => void;
  slug: string;
  cryptoKey: CryptoKey;
  editToken: string | null;
  allowedAttachmentIds?: ReadonlySet<string>;
  planTier?: PlanTier;
  sheetAttachmentCount?: number;
  onAttachmentAdded?: (id: string) => void;
  autoFocus?: boolean;
  focusMode?: boolean;
};


function shouldParsePasteAsMarkdown(text: string): boolean {
  return (
    text.includes("\n") ||
    markdownLikelyHasTaskLists(text) ||
    /\[[^\]]+\]\([^)]+\)/.test(text) ||
    /^#{1,6}\s/m.test(text) ||
    /^\s*[-+*]\s+/m.test(text) ||
    /^\s*\d+\.\s+/m.test(text) ||
    /```/.test(text)
  );
}

function pasteMarkdownText(editor: Editor, text: string) {
  const normalized = normalizeTaskListMarkdown(text);
  const { from, to } = editor.state.selection;
  const html = editor.storage.markdown.parser.parse(normalized, { inline: false });
  const doc = generateJSON(html, editor.extensionManager.extensions);
  editor.chain().focus().deleteRange({ from, to }).insertContentAt(from, doc).run();
}

function linkTargetFromEvent(event: MouseEvent, root: HTMLElement): HTMLAnchorElement | null {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return null;
  const anchor = target.closest("a");
  if (!anchor || !root.contains(anchor)) return null;
  return anchor;
}

export const RichEditor = forwardRef<RichEditorHandle, RichEditorProps>(
  function RichEditor(
    { initialContent, onMarkdownChange, onBaseline, slug, cryptoKey, editToken, allowedAttachmentIds, planTier = "free", sheetAttachmentCount = 0, onAttachmentAdded, autoFocus = true, focusMode = false },
    ref,
  ) {
    const lastEmitted = useRef(initialContent);
    const skipUpdate = useRef(false);
    const baselineSet = useRef(false);
    const baselineUntil = useRef(0);
    const editorRef = useRef<Editor | null>(null);
    const outlineJumpRef = useRef(false);
    const openLinkDialogRef = useRef<() => void>(() => {});
    const [linkWarning, setLinkWarning] = useState<LinkRiskAssessment | null>(null);
    const [linkInsert, setLinkInsert] = useState<{
      url: string;
      selectedText: string;
    } | null>(null);

    openLinkDialogRef.current = () => {
      const ed = editorRef.current;
      if (!ed) return;

      const { from, to, empty } = ed.state.selection;
      const selectedText = empty ? "" : ed.state.doc.textBetween(from, to);
      let url = "";

      if (ed.isActive("link")) {
        url = (ed.getAttributes("link").href as string | undefined) ?? "";
        ed.chain().focus().extendMarkRange("link").run();
      }

      setLinkInsert({ url, selectedText });
    };

    const applyLinkInsert = useCallback((url: string) => {
      const ed = editorRef.current;
      if (!ed) return;

      const href = url.trim();
      if (!href) {
        setLinkInsert(null);
        return;
      }

      if (!ed.state.selection.empty || ed.isActive("link")) {
        ed.chain().focus().setLink({ href }).run();
      } else {
        ed
          .chain()
          .focus()
          .insertContent({
            type: "text",
            text: href,
            marks: [{ type: "link", attrs: { href } }],
          })
          .run();
      }

      setLinkInsert(null);
    }, []);

    const activateExternalLink = useCallback((rawHref: string) => {
      const assessment = assessLinkRisk(rawHref);
      if (assessment.level === "blocked") {
        setLinkWarning(assessment);
        return;
      }
      if (assessment.level === "caution") {
        setLinkWarning(assessment);
        return;
      }
      if (assessment.href) openExternalLink(assessment.href);
    }, []);

    const confirmExternalLink = useCallback(() => {
      if (linkWarning?.href) openExternalLink(linkWarning.href);
      setLinkWarning(null);
    }, [linkWarning]);

    async function insertImage(file: File) {
      const ed = editorRef.current;
      if (!ed || !editToken) {
        toast.error("You need the edit link on this device to insert images");
        return;
      }
      const limit = maxAttachmentsPerSheet(planTier);
      if (limit !== null && sheetAttachmentCount >= limit) {
        toast.error(
          limit === 1
            ? "Free plan allows 1 attachment per sheet"
            : `Maximum ${formatAttachmentLimit(planTier)} attachments per sheet on your plan`,
        );
        return;
      }
      try {
        const { id, url } = await uploadEncryptedAttachment({
          file,
          slug,
          editToken,
          cryptoKey,
        });
        onAttachmentAdded?.(id);
        ed.chain().focus().setImage({ src: url, alt: file.name }).run();
      } catch (e) {
        toast.error((e as Error).message);
      }
    }

    const editor = useEditor({
      extensions: [
        StarterKit.configure({
          heading: { levels: [1, 2, 3] },
          link: false,
          bulletList: false,
          codeBlock: {
            enableTabIndentation: true,
            tabSize: 2,
          },
        }),
        KodamaBulletList,
        TaskList,
        KodamaTaskItem.configure({ nested: true }),
        KodamaLink.configure({
          onLinkShortcut: () => openLinkDialogRef.current(),
        }),
        Typography,
        Table.configure({ resizable: false }),
        TableRow,
        TableHeader,
        TableCell,
        createKodamaImageExtension({ slug, cryptoKey, allowedAttachmentIds }),
        Placeholder.configure({
          placeholder: "Start writing…",
        }),
        Markdown.configure({
          html: false,
          linkify: true,
          transformPastedText: true,
          transformCopiedText: true,
          breaks: true,
        }),
        ListTabExtension,
      ],
      content: normalizeTaskListMarkdown(initialContent),
      editable: !!editToken,
      editorProps: {
        attributes: {
          class: "tiptap reading-mode min-h-[60vh] outline-none",
          "data-editor-surface": "true",
          spellcheck: "true",
        },
        handlePaste(view, event) {
          const items = event.clipboardData?.items;
          if (items && editToken) {
            for (const item of items) {
              if (item.type.startsWith("image/")) {
                const file = item.getAsFile();
                if (file) {
                  event.preventDefault();
                  void insertImage(file);
                  return true;
                }
              }
            }
          }

          const text = event.clipboardData?.getData("text/plain");
          const ed = editorRef.current;
          if (text?.trim() && ed?.storage.markdown?.parser && shouldParsePasteAsMarkdown(text)) {
            event.preventDefault();
            pasteMarkdownText(ed, text);
            return true;
          }
          return false;
        },
        handleDrop(view, event) {
          if (!editToken) return false;
          const file = event.dataTransfer?.files?.[0];
          if (file?.type.startsWith("image/")) {
            event.preventDefault();
            void insertImage(file);
            return true;
          }
          return false;
        },
        handleClick(view, _pos, event) {
          if (!(event.ctrlKey || event.metaKey)) return false;
          const anchor = linkTargetFromEvent(event, view.dom);
          const href = anchor?.getAttribute("href");
          if (!href) return false;
          event.preventDefault();
          activateExternalLink(href);
          return true;
        },
        handleScrollToSelection(view) {
          if (!outlineJumpRef.current) return false;
          const { from } = view.state.selection;
          const $pos = view.state.doc.resolve(from);
          for (let depth = $pos.depth; depth > 0; depth -= 1) {
            if ($pos.node(depth).type.name !== "heading") continue;
            const headingPos = $pos.before(depth);
            const el = resolveHeadingElement(view, headingPos);
            if (el) {
              scrollElementBelowHeader(el, "auto");
              return true;
            }
          }
          return false;
        },
      },
      onUpdate: ({ editor: ed, transaction }) => {
        const md = ed.storage.markdown.getMarkdown();
        const syncBaseline = () => {
          lastEmitted.current = md;
          onBaseline?.(md);
        };
        if (!baselineSet.current) {
          baselineSet.current = true;
          syncBaseline();
          return;
        }
        if (skipUpdate.current || !transaction.docChanged) return;
        const inBaselineWindow = Date.now() < baselineUntil.current;
        const isUserEdit = ed.isFocused && !inBaselineWindow;
        if (!isUserEdit) {
          syncBaseline();
          return;
        }
        lastEmitted.current = md;
        onMarkdownChange(md);
      },
      autofocus: autoFocus ? "end" : false,
      onCreate: ({ editor: ed }) => {
        editorRef.current = ed;
        baselineUntil.current = Date.now() + 150;
        if (!baselineSet.current) {
          baselineSet.current = true;
          const md = ed.storage.markdown.getMarkdown();
          lastEmitted.current = md;
          onBaseline?.(md);
        }
      },
      onDestroy: () => {
        editorRef.current = null;
      },
    });

    useEffect(() => {
      if (!editor) return;
      editor.setEditable(!!editToken);
    }, [editor, editToken]);

    useEffect(() => {
      if (!editor) return;
      const el = editor.view.dom;
      const onTab = (event: KeyboardEvent) => {
        handleEditorTabKeydown(event, editor);
      };
      el.addEventListener("keydown", onTab, true);
      return () => el.removeEventListener("keydown", onTab, true);
    }, [editor]);

    useEffect(() => {
      return () => revokeKodamaBlobCache(slug);
    }, [slug]);

    useEffect(() => {
      if (!focusMode) return;
      const onKeyUp = () => {
        const sel = window.getSelection();
        if (!sel?.rangeCount) return;
        const rect = sel.getRangeAt(0).getBoundingClientRect();
        const targetY = window.innerHeight / 2;
        const currentY = rect.top + rect.height / 2;
        window.scrollBy({ top: currentY - targetY, behavior: "smooth" });
      };
      document.addEventListener("keyup", onKeyUp);
      return () => document.removeEventListener("keyup", onKeyUp);
    }, [focusMode]);

    useEffect(() => {
      const onImageShortcut = (e: KeyboardEvent) => {
        const mod = e.metaKey || e.ctrlKey;
        if (!mod || !e.shiftKey || e.key.toLowerCase() !== "i") return;
        e.preventDefault();
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/*";
        input.onchange = () => {
          const file = input.files?.[0];
          if (file) void insertImage(file);
        };
        input.click();
      };
      window.addEventListener("keydown", onImageShortcut);
      return () => window.removeEventListener("keydown", onImageShortcut);
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        getMarkdown: () => editor?.storage.markdown.getMarkdown() ?? lastEmitted.current,
        setMarkdown: (markdown: string) => {
          if (!editor) return;
          const normalized = normalizeTaskListMarkdown(markdown);
          skipUpdate.current = true;
          editor.commands.setContent(normalized);
          lastEmitted.current = normalized;
          skipUpdate.current = false;
          onMarkdownChange(normalized);
        },
        focus: () => editor?.commands.focus(),
        countFindMatches: (query: string) => {
          if (!editor || !query) return 0;
          return collectTextMatches(editor.state.doc, query).length;
        },
        findMatchAt: (query: string, matchIndex: number) => {
          if (!editor || !query) return false;
          const matches = collectTextMatches(editor.state.doc, query);
          if (matches.length === 0) return false;
          const safeIdx = ((matchIndex % matches.length) + matches.length) % matches.length;
          selectTextMatch(editor, matches[safeIdx]);
          return true;
        },
        replaceMatchAt: (query: string, replacement: string, matchIndex: number) => {
          if (!editor || !query) return false;
          const matches = collectTextMatches(editor.state.doc, query);
          if (matches.length === 0) return false;
          const safeIdx = ((matchIndex % matches.length) + matches.length) % matches.length;
          replaceTextMatch(editor, matches[safeIdx], replacement);
          return true;
        },
        replaceAllMatches: (query: string, replacement: string) => {
          if (!editor || !query) return;
          replaceAllTextMatches(editor, query, replacement);
        },
        scrollToHeading: (text: string) => {
          if (!editor) return;
          let headingPos = -1;
          editor.state.doc.descendants((node, pos) => {
            if (headingPos !== -1) return false;
            if (node.type.name === "heading" && node.textContent === text) {
              headingPos = pos;
              return false;
            }
          });
          if (headingPos === -1) return;

          outlineJumpRef.current = true;
          editor
            .chain()
            .setTextSelection(headingPos + 1)
            .focus(headingPos + 1, { scrollIntoView: false })
            .run();

          scheduleScrollBelowHeader(() => {
            const el = resolveHeadingElement(editor.view, headingPos);
            if (el) scrollElementBelowHeader(el);
            else scrollViewportYToHeaderOffset(editor.view.coordsAtPos(headingPos + 1).top);
            outlineJumpRef.current = false;
          });
        },
        insertImageFromFile: insertImage,
      }),
      [editor, onMarkdownChange, slug, editToken, cryptoKey],
    );

    if (!editor) return null;

    return (
      <>
        <EditorContent editor={editor} />
        <ExternalLinkWarning
          open={linkWarning !== null}
          assessment={linkWarning}
          onConfirm={confirmExternalLink}
          onCancel={() => setLinkWarning(null)}
        />
        <LinkInsertDialog
          open={linkInsert !== null}
          selectedText={linkInsert?.selectedText ?? ""}
          initialUrl={linkInsert?.url ?? ""}
          onSubmit={applyLinkInsert}
          onCancel={() => setLinkInsert(null)}
        />
      </>
    );
  },
);

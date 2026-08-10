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
import TextAlign from "@tiptap/extension-text-align";
import Typography from "@tiptap/extension-typography";
import { Table, TableRow, TableCell, TableHeader } from "@tiptap/extension-table";
import type { Editor } from "@tiptap/react";
import { Markdown } from "tiptap-markdown";

import { EditorFormatToolbar } from "./components/format-toolbar";
import { EditorBlockInsertButton, EditorSlashMenu } from "./components/slash-menu";
import { LinkInsertDialog } from "./components/link-insert-dialog";
import { ExternalLinkWarning } from "./components/external-link-warning";
import { createMediaImageExtension } from "./extensions/media-image";
import { handleEditorTabKeydown, ListTabExtension } from "./lib/list-tab-extension";
import {
  KodamaBulletList,
  KodamaTaskItem,
  KodamaTaskList,
} from "./lib/kodama-task-list";
import {
  markdownLikelyHasTaskLists,
  normalizeTaskListMarkdown,
} from "./lib/normalize-task-markdown";
import {
  assessLinkRisk,
  openExternalLink,
  type LinkRiskAssessment,
} from "./lib/link-safety";
import { KodamaParagraph, KodamaHeading } from "./lib/kodama-aligned-blocks";
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
  collectEditorHeadings,
  normalizeHeadingText,
} from "./lib/editor-headings";
import {
  resolveHeadingElement,
  scrollElementBelowHeader,
} from "./lib/scroll-to-heading";
import {
  collectTextMatches,
  replaceAllTextMatches,
  replaceTextMatch,
  selectTextMatch,
} from "./lib/editor-find";
import type { KodamaEditorHandle, KodamaEditorProps } from "./types";

function shouldParsePasteAsMarkdown(text: string): boolean {
  return (
    text.includes("\n") ||
    markdownLikelyHasTaskLists(text) ||
    /\[[^\]]+\]\([^)]+\)/.test(text) ||
    /!\[[^\]]*\]\([^)]+\)/.test(text) ||
    /^#{1,6}\s/m.test(text) ||
    /^\s*[-+*]\s+/m.test(text) ||
    /^\s*\d+\.\s+/m.test(text) ||
    /```/.test(text) ||
    /^>\s?/m.test(text) ||
    /^(-{3,}|\*{3,}|_{3,})\s*$/m.test(text) ||
    /^\|.+\|/m.test(text) ||
    /~~.+~~/.test(text) ||
    /==[^=].*==/.test(text) ||
    /`[^`]+`/.test(text) ||
    /(\*\*|__).+\1/.test(text)
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

function flashHeading(el: HTMLElement) {
  el.classList.remove("outline-heading-flash");
  void el.offsetWidth;
  el.classList.add("outline-heading-flash");
  window.setTimeout(() => el.classList.remove("outline-heading-flash"), 1000);
}

function pinHeadingAtPos(
  editor: Editor,
  headingPos: number,
  outlineJumpRef: { current: boolean },
) {
  const applyScroll = () => {
    const el = resolveHeadingElement(editor.view, headingPos);
    if (!el) return;
    scrollElementBelowHeader(el, "auto");
    flashHeading(el);
    try {
      editor.chain().setTextSelection(headingPos + 1).run();
    } catch {
      /* ignore */
    }
  };
  outlineJumpRef.current = true;
  applyScroll();
  window.setTimeout(() => {
    applyScroll();
    outlineJumpRef.current = false;
  }, 80);
}

export const KodamaEditor = forwardRef<KodamaEditorHandle, KodamaEditorProps>(
  function KodamaEditor(props, ref) {
    const {
      value,
      initialContent,
      onChange,
      onMarkdownChange,
      onBaseline,
      editable: editableProp = true,
      autoFocus = true,
      focusMode = false,
      placeholder = "Start writing…",
      toolbar = "floating",
      slashMenu = true,
      media,
      className,
      onReady,
      onEditorReady,
      onActiveHeadingChange,
      extensions: extraExtensions,
    } = props;

    const seed = value ?? initialContent ?? "";
    const emitChange = onChange ?? onMarkdownChange;
    const emitReady = onReady ?? onEditorReady;
    const editable = editableProp;
    const lastEmitted = useRef(seed);
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
      if (assessment.level === "blocked" || assessment.level === "caution") {
        setLinkWarning(assessment);
        return;
      }
      if (assessment.href) openExternalLink(assessment.href);
    }, []);

    const confirmExternalLink = useCallback(() => {
      if (linkWarning?.href) openExternalLink(linkWarning.href);
      setLinkWarning(null);
    }, [linkWarning]);

    const editor = useEditor({
      extensions: [
        StarterKit.configure({
          heading: false,
          paragraph: false,
          underline: false,
          link: false,
          bulletList: false,
          codeBlock: {
            enableTabIndentation: true,
            tabSize: 2,
          },
        }),
        KodamaParagraph,
        KodamaHeading.configure({ levels: [1, 2, 3] }),
        KodamaBulletList,
        KodamaTaskList,
        KodamaTaskItem.configure({ nested: true }),
        KodamaLink.configure({
          onLinkShortcut: () => openLinkDialogRef.current(),
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
        Typography,
        Table.configure({ resizable: false }),
        TableRow,
        TableHeader,
        TableCell,
        createMediaImageExtension(media),
        Placeholder.configure({ placeholder }),
        Markdown.configure({
          html: false,
          linkify: true,
          transformPastedText: true,
          transformCopiedText: true,
          breaks: true,
        }),
        ListTabExtension,
        ...(extraExtensions ?? []),
      ],
      content: normalizeTaskListMarkdown(seed),
      editable,
      editorProps: {
        attributes: {
          class: ["tiptap", "reading-mode", "min-h-[50vh]", "outline-none", "sm:min-h-[60vh]", className]
            .filter(Boolean)
            .join(" "),
          "data-editor-surface": "true",
          spellcheck: "true",
        },
        handlePaste(_view, event) {
          const text = event.clipboardData?.getData("text/plain");
          const ed = editorRef.current;
          if (text?.trim() && ed?.storage.markdown?.parser && shouldParsePasteAsMarkdown(text)) {
            event.preventDefault();
            pasteMarkdownText(ed, text);
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
        emitChange?.(md);
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
      editor.setEditable(editable);
    }, [editor, editable]);

    useEffect(() => {
      emitReady?.(editor);
      return () => emitReady?.(null);
    }, [editor, emitReady]);

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
      return () => media?.dispose?.();
    }, [media]);

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
      if (!editor || !onActiveHeadingChange) return;
      const emitActiveHeading = () => {
        const { $from } = editor.state.selection;
        for (let depth = $from.depth; depth > 0; depth -= 1) {
          const node = $from.node(depth);
          if (node.type.name === "heading") {
            onActiveHeadingChange(normalizeHeadingText(node.textContent) || null);
            return;
          }
        }
        let found: string | null = null;
        const caret = $from.pos;
        editor.state.doc.descendants((node, pos) => {
          if (pos >= caret) return false;
          if (node.type.name === "heading") {
            found = normalizeHeadingText(node.textContent) || null;
          }
        });
        onActiveHeadingChange(found);
      };
      emitActiveHeading();
      editor.on("selectionUpdate", emitActiveHeading);
      editor.on("transaction", emitActiveHeading);
      return () => {
        editor.off("selectionUpdate", emitActiveHeading);
        editor.off("transaction", emitActiveHeading);
      };
    }, [editor, onActiveHeadingChange]);

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
          emitChange?.(normalized);
        },
        focus: () => editor?.commands.focus(),
        getEditor: () => editorRef.current,
        openLinkDialog: () => openLinkDialogRef.current(),
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
        getHeadings: () => (editor ? collectEditorHeadings(editor.state.doc) : []),
        scrollToHeadingAt: (pos: number) => {
          if (!editor) return;
          pinHeadingAtPos(editor, pos, outlineJumpRef);
        },
        scrollToHeading: (text: string) => {
          if (!editor) return;
          const needle = normalizeHeadingText(text);
          if (!needle) return;
          let headingPos = -1;
          editor.state.doc.descendants((node, pos) => {
            if (headingPos !== -1) return false;
            if (
              node.type.name === "heading" &&
              normalizeHeadingText(node.textContent) === needle
            ) {
              headingPos = pos;
              return false;
            }
          });
          if (headingPos === -1) {
            editor.state.doc.descendants((node, pos) => {
              if (headingPos !== -1) return false;
              if (
                node.type.name === "heading" &&
                normalizeHeadingText(node.textContent).includes(needle)
              ) {
                headingPos = pos;
                return false;
              }
            });
          }
          if (headingPos === -1) {
            const nodes = editor.view.dom.querySelectorAll("h1,h2,h3,h4,h5,h6");
            for (const node of nodes) {
              if (!(node instanceof HTMLElement)) continue;
              if (normalizeHeadingText(node.textContent ?? "") !== needle) continue;
              outlineJumpRef.current = true;
              scrollElementBelowHeader(node, "auto");
              flashHeading(node);
              window.setTimeout(() => {
                outlineJumpRef.current = false;
              }, 80);
              return;
            }
            return;
          }
          pinHeadingAtPos(editor, headingPos, outlineJumpRef);
        },
      }),
      [editor, emitChange],
    );

    if (!editor) return null;

    const showChrome = editable && toolbar !== "none";

    return (
      <>
        <EditorContent editor={editor} />
        {showChrome ? (
          <>
            {toolbar !== "none" ? (
              <EditorFormatToolbar
                editor={editor}
                placement={toolbar === "static" ? "static" : "floating"}
                onOpenLink={() => {
                  const { from, to } = editor.state.selection;
                  const selectedText = editor.state.doc.textBetween(from, to, " ");
                  setLinkInsert({
                    selectedText,
                    url: editor.getAttributes("link").href ?? "",
                  });
                }}
              />
            ) : null}
            {slashMenu ? (
              <>
                <EditorSlashMenu editor={editor} />
                <EditorBlockInsertButton editor={editor} />
              </>
            ) : null}
          </>
        ) : null}
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

/** @deprecated Use {@link KodamaEditor}. */
export const MarkdownEditor = KodamaEditor;
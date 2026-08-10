import Link, { isAllowedUri as defaultIsAllowedUri } from "@tiptap/extension-link";
import { InputRule, PasteRule } from "@tiptap/core";

/** `[label](url)` or `[label](url "title")` at end of typed text. */
export const markdownLinkInputRegex =
  /\[([^\]]+)\]\(([^)\s]+)(?:\s+"((?:[^"\\]|\\.)*)")?\)$/;

/** Same pattern for pasted markdown links (global). */
export const markdownLinkPasteRegex =
  /\[([^\]]+)\]\(([^)\s]+)(?:\s+"((?:[^"\\]|\\.)*)")?\)/g;

export type KodamaLinkOptions = {
  onLinkShortcut?: () => void;
};

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    kodamaLink: {
      openLinkDialog: () => ReturnType;
    };
  }
}

function linkAttrsFromMatch(match: RegExpMatchArray) {
  return {
    href: match[2],
    title: match[3] || null,
  };
}

function applyMarkdownLinkRule({
  tr,
  range,
  match,
  linkType,
}: {
  tr: import("@tiptap/pm/state").Transaction;
  range: { from: number; to: number };
  match: RegExpMatchArray;
  linkType: import("@tiptap/pm/model").MarkType;
}) {
  const label = match[1];
  const { href, title } = linkAttrsFromMatch(match);
  if (!label || !href) return false;

  tr.delete(range.from, range.to);
  tr.insertText(label, range.from);
  tr.addMark(range.from, range.from + label.length, linkType.create({ href, title }));
  return true;
}

export const KodamaLink = Link.extend<KodamaLinkOptions>({
  addOptions() {
    return {
      ...this.parent?.(),
      openOnClick: false,
      autolink: true,
      linkOnPaste: true,
      onLinkShortcut: undefined,
      HTMLAttributes: {
        class: "kodama-editor-link",
        rel: "noopener noreferrer nofollow",
      },
    };
  },

  addCommands() {
    return {
      ...this.parent?.(),
      openLinkDialog:
        () =>
        ({ editor }) => {
          this.options.onLinkShortcut?.();
          return editor.isEditable;
        },
    };
  },

  addInputRules() {
    const parentRules = this.parent?.() ?? [];
    const linkType = this.type;
    const { isAllowedUri, protocols, defaultProtocol } = this.options;

    return [
      ...parentRules,
      new InputRule({
        find: markdownLinkInputRegex,
        handler: ({ state, range, match }) => {
          const href = match[2];
          if (
            !href ||
            !isAllowedUri(href, {
              defaultValidate: (url) => !!defaultIsAllowedUri(url, protocols),
              protocols,
              defaultProtocol,
            })
          ) {
            return null;
          }

          const { tr } = state;
          if (!applyMarkdownLinkRule({ tr, range, match, linkType })) return null;
        },
      }),
    ];
  },

  addPasteRules() {
    const parentRules = this.parent?.() ?? [];
    const linkType = this.type;

    return [
      ...parentRules,
      new PasteRule({
        find: markdownLinkPasteRegex,
        handler: ({ state, range, match }) => {
          const { tr } = state;
          applyMarkdownLinkRule({ tr, range, match, linkType });
        },
      }),
    ];
  },

  addKeyboardShortcuts() {
    return {
      "Mod-k": () => this.editor.commands.openLinkDialog(),
    };
  },
});

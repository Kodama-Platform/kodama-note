import { Extension } from "@tiptap/core";

const MAX_INDENT = 8;
const INDENT_TYPES = ["paragraph", "heading"] as const;

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    kodamaIndent: {
      indent: () => ReturnType;
      outdent: () => ReturnType;
    };
  }
}

function clampIndent(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(MAX_INDENT, Math.floor(n));
}

/** List sink/lift when inside a list; otherwise bump paragraph/heading indent. */
export const KodamaIndent = Extension.create({
  name: "kodamaIndent",

  addGlobalAttributes() {
    return [
      {
        types: [...INDENT_TYPES],
        attributes: {
          indent: {
            default: 0,
            parseHTML: (element) => clampIndent(element.getAttribute("data-indent")),
            renderHTML: (attributes) => {
              const indent = clampIndent(attributes.indent);
              if (!indent) return {};
              // Use data-indent only so we don't fight TextAlign's style attr.
              return { "data-indent": String(indent) };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      indent:
        () =>
        ({ commands, editor, state }) => {
          if (editor.schema.nodes.listItem && editor.can().sinkListItem("listItem")) {
            return commands.sinkListItem("listItem");
          }
          if (editor.schema.nodes.taskItem && editor.can().sinkListItem("taskItem")) {
            return commands.sinkListItem("taskItem");
          }

          const type = INDENT_TYPES.find((name) => editor.isActive(name));
          if (!type) return false;
          const current = clampIndent(state.selection.$from.parent.attrs.indent);
          if (current >= MAX_INDENT) return true;
          return commands.updateAttributes(type, { indent: current + 1 });
        },
      outdent:
        () =>
        ({ commands, editor, state }) => {
          if (editor.schema.nodes.listItem && editor.can().liftListItem("listItem")) {
            return commands.liftListItem("listItem");
          }
          if (editor.schema.nodes.taskItem && editor.can().liftListItem("taskItem")) {
            return commands.liftListItem("taskItem");
          }

          const type = INDENT_TYPES.find((name) => editor.isActive(name));
          if (!type) return false;
          const current = clampIndent(state.selection.$from.parent.attrs.indent);
          if (current <= 0) return true;
          return commands.updateAttributes(type, { indent: current - 1 });
        },
    };
  },
});

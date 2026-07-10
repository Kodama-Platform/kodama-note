import { wrappingInputRule } from "@tiptap/core";
import { BulletList, TaskItem, TaskList } from "@tiptap/extension-list";

const TextStyleName = "textStyle";

/** GFM task list: `- [ ]` / `- [x]` and tolerant `[]` / `[ x ]` variants. */
export const dashTaskInputRegex = /^\s*([-+*])\s+\[\s*([xX]?)\s*\]\s$/;

export const KodamaTaskItem = TaskItem.extend({
  addInputRules() {
    const parentRules = this.parent?.() ?? [];
    return [
      ...parentRules,
      wrappingInputRule({
        find: dashTaskInputRegex,
        type: this.type,
        getAttributes: (match) => ({
          checked: match[2].trim().toLowerCase() === "x",
        }),
      }),
    ];
  },
});

/**
 * Auto bullets for `* ` and `+ ` only so `- [ ]` is not swallowed by `- ` → bullet.
 * Hyphen bullets still round-trip via markdown load/save.
 */
export const KodamaBulletList = BulletList.extend({
  addInputRules() {
    const starPlusRegex = /^\s*([+*])\s$/;
    const { keepMarks, keepAttributes } = this.options;
    let inputRule = wrappingInputRule({
      find: starPlusRegex,
      type: this.type,
    });
    if (keepMarks || keepAttributes) {
      inputRule = wrappingInputRule({
        find: starPlusRegex,
        type: this.type,
        keepMarks,
        keepAttributes,
        getAttributes: () => this.editor.getAttributes(TextStyleName),
        editor: this.editor,
      });
    }
    return [inputRule];
  },
});

export { TaskList };

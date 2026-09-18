import { describe, expect, it } from "vitest";

import { getMountedEditorDom, posAtEditorCoords } from "./editor-view";

describe("getMountedEditorDom", () => {
  it("returns null when the TipTap view is not mounted yet", () => {
    const editor = {
      isDestroyed: false,
      get view() {
        throw new Error(
          "[tiptap error]: The editor view is not available. Cannot access view['dom']. The editor may not be mounted yet.",
        );
      },
    } as never;

    expect(getMountedEditorDom(editor)).toBeNull();
    expect(getMountedEditorDom(null)).toBeNull();
    expect(posAtEditorCoords(editor, 0, 0)).toBeUndefined();
  });

  it("returns the live element when the view exists", () => {
    const dom = document.createElement("div");
    const editor = {
      isDestroyed: false,
      view: { dom, posAtCoords: () => ({ pos: 4 }) },
    } as never;

    expect(getMountedEditorDom(editor)).toBe(dom);
    expect(posAtEditorCoords(editor, 1, 2)).toBe(4);
  });
});

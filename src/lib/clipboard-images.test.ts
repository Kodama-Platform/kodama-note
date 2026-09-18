import { describe, expect, it } from "vitest";
import {
  asImageFile,
  clipboardLikelyHasImage,
  collectClipboardImages,
  dataUrlToFile,
  imageAltFromFile,
} from "@kodama.page/editor";

function transferWith(
  files: File[],
  extra: { html?: string; types?: string[]; itemTypes?: string[] } = {},
): DataTransfer {
  const list = {
    length: files.length,
    item: (i: number) => files[i] ?? null,
    *[Symbol.iterator]() {
      yield* files;
    },
  };
  const items = files.map((file, i) => ({
    kind: "file" as const,
    type: extra.itemTypes?.[i] ?? file.type,
    getAsFile: () => file,
  }));
  return {
    files: list as unknown as FileList,
    items: items as unknown as DataTransferItemList,
    types: extra.types ?? (files.length ? ["Files"] : []),
    getData: (type: string) => (type === "text/html" ? (extra.html ?? "") : ""),
  } as DataTransfer;
}

describe("collectClipboardImages", () => {
  it("collects image files and ignores non-images", () => {
    const png = new File([new Uint8Array([1, 2, 3])], "shot.png", { type: "image/png" });
    const txt = new File(["hi"], "note.txt", { type: "text/plain" });
    expect(collectClipboardImages(transferWith([png, txt])).map((f) => f.name)).toEqual([
      "shot.png",
    ]);
  });

  it("accepts a file whose type is empty when the clipboard item is image/png", () => {
    const raw = new File([new Uint8Array([1, 2, 3])], "image.png", { type: "" });
    const files = collectClipboardImages(transferWith([raw], { itemTypes: ["image/png"] }));
    expect(files).toHaveLength(1);
    expect(files[0].type).toBe("image/png");
  });

  it("collects a data-URL image from clipboard HTML", () => {
    const dataUrl =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const files = collectClipboardImages(
      transferWith([], { html: `<img src="${dataUrl}">`, types: ["text/html"] }),
    );
    expect(files).toHaveLength(1);
    expect(files[0].type).toBe("image/png");
  });

  it("returns empty when the clipboard has no files", () => {
    expect(collectClipboardImages(transferWith([]))).toEqual([]);
    expect(collectClipboardImages(null)).toEqual([]);
  });

  it("treats a Files clipboard as an image paste even before files are read", () => {
    expect(clipboardLikelyHasImage(transferWith([], { types: ["Files"] }))).toBe(true);
  });
});

describe("asImageFile / dataUrlToFile", () => {
  it("wraps an untyped file using the mime hint", () => {
    const raw = new File([new Uint8Array([9])], "", { type: "" });
    const file = asImageFile(raw, "image/jpeg");
    expect(file?.type).toBe("image/jpeg");
    expect(file?.name).toMatch(/\.jpeg$/);
  });

  it("parses a PNG data URL", () => {
    const file = dataUrlToFile(
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    );
    expect(file?.type).toBe("image/png");
    expect(file?.size).toBeGreaterThan(0);
  });
});

describe("imageAltFromFile", () => {
  it("uses a meaningful filename and ignores generic screenshot names", () => {
    expect(imageAltFromFile(new File([], "Trail map.PNG", { type: "image/png" }))).toBe(
      "Trail map",
    );
    expect(imageAltFromFile(new File([], "image.png", { type: "image/png" }))).toBe("");
  });
});

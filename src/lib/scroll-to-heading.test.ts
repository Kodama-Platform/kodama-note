import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getEditorHeaderOffset,
  scrollViewportYToHeaderOffset,
} from "@/lib/scroll-to-heading";

describe("scroll-to-heading", () => {
  beforeEach(() => {
    vi.stubGlobal("scrollTo", vi.fn());
    Object.defineProperty(window, "scrollY", { value: 400, writable: true });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.querySelectorAll("header").forEach((el) => el.remove());
  });

  it("uses the fixed editor header height when present", () => {
    const header = document.createElement("header");
    header.dataset.editorChrome = "true";
    Object.defineProperty(header, "getBoundingClientRect", {
      value: () => ({ height: 96 }),
    });
    document.body.appendChild(header);

    expect(getEditorHeaderOffset()).toBe(108);
  });

  it("scrolls so the target sits below the header", () => {
    const header = document.createElement("header");
    header.dataset.editorChrome = "true";
    Object.defineProperty(header, "getBoundingClientRect", {
      value: () => ({ height: 72 }),
    });
    document.body.appendChild(header);

    scrollViewportYToHeaderOffset(300, "auto");

    expect(window.scrollTo).toHaveBeenCalledWith({
      top: 400 + 300 - 84,
      behavior: "auto",
    });
  });
});

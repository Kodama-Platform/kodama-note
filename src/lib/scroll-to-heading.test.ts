import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  findNearestScrollable,
  getEditorHeaderOffset,
  getEditorScrollContainer,
  scrollElementBelowHeader,
  scrollViewportYToHeaderOffset,
} from "@/lib/scroll-to-heading";

describe("scroll-to-heading", () => {
  beforeEach(() => {
    vi.stubGlobal("scrollTo", vi.fn());
    Object.defineProperty(window, "scrollY", { value: 400, writable: true });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
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

  it("finds the nearest ancestor that actually scrolls", () => {
    const stage = document.createElement("div");
    Object.defineProperty(stage, "scrollHeight", { value: 2000 });
    Object.defineProperty(stage, "clientHeight", { value: 400 });
    vi.spyOn(window, "getComputedStyle").mockImplementation(
      (el) =>
        ({
          overflowY: el === stage ? "auto" : "visible",
        }) as CSSStyleDeclaration,
    );

    const heading = document.createElement("h2");
    stage.appendChild(heading);
    document.body.appendChild(stage);

    expect(findNearestScrollable(heading)).toBe(stage);
    expect(getEditorScrollContainer(heading)).toBe(stage);
  });

  it("pins a heading to the top of the stage scroller", () => {
    const header = document.createElement("header");
    header.dataset.editorChrome = "true";
    Object.defineProperty(header, "getBoundingClientRect", {
      value: () => ({ height: 52 }),
    });
    document.body.appendChild(header);

    const stage = document.createElement("div");
    stage.dataset.editorStage = "true";
    Object.defineProperty(stage, "scrollTop", { value: 200, writable: true });
    Object.defineProperty(stage, "scrollHeight", { value: 2000 });
    Object.defineProperty(stage, "clientHeight", { value: 400 });
    let headingTop = 320;
    stage.scrollTo = vi.fn(function (this: HTMLElement, opts: ScrollToOptions) {
      this.scrollTop = Number(opts.top ?? 0);
      headingTop = 80 + 12;
    }) as unknown as HTMLElement["scrollTo"];
    Object.defineProperty(stage, "getBoundingClientRect", {
      value: () => ({ top: 80 }),
    });
    vi.spyOn(window, "getComputedStyle").mockImplementation(
      (el) =>
        ({
          overflowY: el === stage ? "auto" : "visible",
          zoom: "normal",
        }) as CSSStyleDeclaration,
    );
    document.body.appendChild(stage);

    const heading = document.createElement("h2");
    Object.defineProperty(heading, "getBoundingClientRect", {
      value: () => ({ top: headingTop }),
    });
    stage.appendChild(heading);

    scrollElementBelowHeader(heading, "auto");

    expect(stage.scrollTo).toHaveBeenCalledWith({
      top: 200 + (320 - 80) - 12,
      behavior: "auto",
    });
  });

  it("falls back to window scroll when the stage cannot move", () => {
    vi.stubGlobal("scrollBy", vi.fn());
    const header = document.createElement("header");
    header.dataset.editorChrome = "true";
    Object.defineProperty(header, "getBoundingClientRect", {
      value: () => ({ height: 52 }),
    });
    document.body.appendChild(header);

    const stage = document.createElement("div");
    stage.dataset.editorStage = "true";
    Object.defineProperty(stage, "scrollTop", { value: 0, writable: true });
    Object.defineProperty(stage, "scrollHeight", { value: 400 });
    Object.defineProperty(stage, "clientHeight", { value: 400 });
    stage.scrollTo = vi.fn();
    Object.defineProperty(stage, "getBoundingClientRect", {
      value: () => ({ top: 52 }),
    });
    document.body.appendChild(stage);

    let headingTop = 400;
    const heading = document.createElement("h2");
    Object.defineProperty(heading, "getBoundingClientRect", {
      value: () => ({ top: headingTop }),
    });
    heading.scrollIntoView = vi.fn(() => {
      headingTop = 52;
    });
    stage.appendChild(heading);

    scrollElementBelowHeader(heading, "auto");

    expect(window.scrollTo).toHaveBeenCalled();
  });
});

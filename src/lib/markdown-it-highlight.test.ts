import { describe, it, expect } from "vitest";
import markdownit from "markdown-it";

import { markdownItHighlight } from "@/lib/markdown-it-highlight";

describe("markdownItHighlight", () => {
  it("renders ==text== as <mark>", () => {
    const md = markdownit({ html: false });
    md.use(markdownItHighlight as never);
    expect(md.renderInline("a ==hi== b")).toBe("a <mark>hi</mark> b");
  });

  it("allows nested emphasis inside highlights", () => {
    const md = markdownit({ html: false });
    md.use(markdownItHighlight as never);
    expect(md.renderInline("==**bold**==")).toContain("<mark>");
    expect(md.renderInline("==**bold**==")).toContain("<strong>bold</strong>");
  });
});

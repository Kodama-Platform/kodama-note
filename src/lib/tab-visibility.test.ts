import { describe, expect, it } from "vitest";

import { createEmptyWorkbook, parseWorkbook, serializePrivateBundle } from "@/lib/workbook";
import {
  canMakeSheetPublic,
  mergePublicAndPrivate,
  parsePlacePublicView,
  privateWorkbookFrom,
  publicPayloadLeaksPrivate,
  publicTabsToWorkbook,
  setSheetVisibility,
  slugifyTabTitle,
  uniquePublicSlug,
} from "@/lib/tab-visibility";

describe("public / private tab model", () => {
  it("treats legacy sheets as private", () => {
    const wb = parseWorkbook(JSON.stringify({
      schema_version: 1,
      primary_sheet_id: "a",
      sheets: [{ sheet_id: "a", title: "Main", order: 0, markdown: "hi" }],
    }));
    expect(wb.sheets[0].visibility).toBe("private");
  });

  it("strips public tabs from the encrypted bundle", () => {
    let wb = createEmptyWorkbook();
    wb = {
      ...wb,
      sheets: [
        { ...wb.sheets[0], visibility: "private", markdown: "secret" },
        {
          sheet_id: "pub",
          title: "Welcome",
          order: 1,
          markdown: "hello world",
          visibility: "public",
          public_slug: "welcome",
        },
      ],
    };
    const json = serializePrivateBundle(wb);
    expect(json).toContain("secret");
    expect(json).not.toContain("hello world");
    expect(json).not.toContain("welcome");
    expect(json).not.toContain("public");
  });

  it("merges public server tabs with a private bundle", () => {
    const publicWb = publicTabsToWorkbook([
      {
        id: "tab-1",
        public_slug: "welcome",
        title: "Welcome",
        content_markdown: "Hi",
        display_order: 0,
        revision: 1,
      },
    ]);
    const privateWb = parseWorkbook(JSON.stringify({
      schema_version: 1,
      primary_sheet_id: "p",
      sheets: [{ sheet_id: "p", title: "Roadmap", order: 1, markdown: "soon" }],
    }));
    const merged = mergePublicAndPrivate(publicWb, privateWb);
    expect(merged.sheets.map((s) => s.title)).toEqual(["Welcome", "Roadmap"]);
    expect(merged.sheets[0].visibility).toBe("public");
    expect(merged.sheets[1].visibility).toBe("private");
  });

  it("does not leak private titles from a public GET body", () => {
    const view = parsePlacePublicView({
      slug: "kodama",
      title: "Kodama",
      tabs: [{ tab_id: "t1", title: "Welcome", content_markdown: "x", public_slug: "welcome" }],
    });
    expect(view.tabs).toHaveLength(1);
    expect(publicPayloadLeaksPrivate({ slug: "kodama", tabs: view.tabs })).toEqual([]);
    expect(publicPayloadLeaksPrivate({
      slug: "kodama",
      private_tabs: [{ title: "Investor Notes" }],
    })).toContain("private_tabs");
  });

  it("blocks publish when the tab still has encrypted attachments", () => {
    const sheet = {
      sheet_id: "a",
      title: "Deck",
      order: 0,
      markdown: "![x](kodama-att:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa)",
      visibility: "private" as const,
    };
    expect(canMakeSheetPublic(sheet)).toBe(false);
  });

  it("assigns unique public slugs", () => {
    expect(slugifyTabTitle("Security Philosophy")).toBe("security-philosophy");
    const wb = {
      schema_version: 1 as const,
      primary_sheet_id: "a",
      sheets: [
        {
          sheet_id: "a",
          title: "Welcome",
          order: 0,
          markdown: "",
          visibility: "public" as const,
          public_slug: "welcome",
        },
      ],
    };
    expect(uniquePublicSlug(wb, "Welcome", "b")).toBe("welcome-2");
  });

  it("keeps private workbook empty after publishing the last private tab", () => {
    const empty = createEmptyWorkbook();
    const wb = setSheetVisibility(empty, empty.sheets[0].sheet_id, "public");
    const priv = privateWorkbookFrom(wb);
    expect(priv.sheets).toHaveLength(0);
  });
});

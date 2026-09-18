import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/place-meta-sign", () => ({
  signPlaceWrite: vi.fn(async () => ({
    writer_public_key: "pub",
    state_signature: "sig",
  })),
  signPlaceDocument: vi.fn(async () => ({
    owner_public_key: "pub",
    state_signature: "sig",
  })),
}));

import { putPublicTab } from "@/lib/note-tabs-api";
import type { WorkbookSheet } from "@/lib/workbook";

const sheet = {
  sheet_id: "2008d973-4ac1-4dfc-9c99-005ab990f8b2",
  title: "Sheet 2",
  markdown: "",
  public_slug: "sheet-2",
  order: 1,
} as WorkbookSheet;

describe("putPublicTab", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not send mutation_id", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            id: sheet.sheet_id,
            public_slug: "sheet-2",
            title: "Sheet 2",
            content_markdown: "",
            display_order: 1,
            revision: 1,
          }),
          { status: 201, headers: { "Content-Type": "application/json" } },
        ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await putPublicTab({
      slug: "itcvmaster",
      sheet,
      displayOrder: 1,
      session: { role: "owner", ownerSignKey: {} } as never,
    });

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body ?? "{}")) as Record<
      string,
      unknown
    >;
    expect(body).not.toHaveProperty("mutation_id");
    expect(body.visibility).toBe("public");
    expect(body.tab_id).toBe(sheet.sheet_id);
    expect(body.issued_at).toEqual(expect.any(String));
    expect(body.writer_public_key).toBe("pub");
  });
});

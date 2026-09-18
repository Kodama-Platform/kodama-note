import { describe, expect, it } from "vitest";

import { canSignPlaceDocument, placeDocumentSignPayload } from "@/lib/place-meta-sign";

describe("place-meta-sign", () => {
  it("builds a canonical sign payload", () => {
    expect(
      placeDocumentSignPayload("garden", "knp-place-settings-1", { preset: "paper" }),
    ).toEqual({
      document: { preset: "paper" },
      purpose: "knp-place-settings-1",
      slug: "garden",
    });
  });

  it("requires an owner signing key", () => {
    expect(
      canSignPlaceDocument({
        role: "reader",
      } as never),
    ).toBe(false);
  });
});

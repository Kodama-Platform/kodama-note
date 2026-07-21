import { describe, expect, it } from "vitest";

import {
  mimeWithPlaceVersion,
  placeVersionFromMime,
  stripPlaceVersion,
} from "@/lib/attachment-meta";

describe("attachment-meta", () => {
  it("round-trips place version in mime", () => {
    const mime = mimeWithPlaceVersion("image/png", 3);
    expect(placeVersionFromMime(mime)).toBe(3);
    expect(stripPlaceVersion(mime)).toBe("image/png");
  });

  it("returns null when version is absent", () => {
    expect(placeVersionFromMime("image/png")).toBeNull();
  });
});

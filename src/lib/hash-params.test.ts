import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getSheetIdFromHash, setSheetHash } from "@/lib/hash-params";

describe("hash-params sheet deep links", () => {
  const original = window.location.href;

  beforeEach(() => {
    history.replaceState(null, "", "/wallet");
  });

  afterEach(() => {
    history.replaceState(null, "", original);
  });

  it("returns null when sheet param is absent", () => {
    expect(getSheetIdFromHash()).toBeNull();
  });

  it("parses sheet id from hash", () => {
    history.replaceState(null, "", "/wallet#sheet=abc-123");
    expect(getSheetIdFromHash()).toBe("abc-123");
  });

  it("setSheetHash preserves edit token", () => {
    history.replaceState(null, "", "/wallet#edit=secret&sheet=old");
    setSheetHash("new-sheet");
    expect(window.location.hash).toBe("#edit=secret&sheet=new-sheet");
  });
});

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getSheetIdFromHash, setSheetHash, stripSensitiveHashParams } from "@/lib/hash-params";

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

  it("setSheetHash preserves other hash params", () => {
    history.replaceState(null, "", "/wallet#editor=secret&sheet=old");
    setSheetHash("new-sheet");
    expect(window.location.hash).toBe("#editor=secret&sheet=new-sheet");
  });

  it("stripSensitiveHashParams removes keys but keeps sheet", () => {
    history.replaceState(null, "", "/wallet#editor=secret&read=cap&sheet=abc");
    stripSensitiveHashParams("editor", "read");
    expect(window.location.hash).toBe("#sheet=abc");
  });
});

import { describe, expect, it } from "vitest";

import {
  buildEditorCapabilityExport,
  buildEditorShareUrl,
  buildReadOnlyUrl,
  parseEditorCapabilityImport,
} from "@/lib/ksp-fragment";

describe("ksp-fragment", () => {
  it("builds read-only URLs with #read= fragment", () => {
    const url = buildReadOnlyUrl("https://note.example/wallet", "read-cap-abc");
    expect(url).toBe("https://note.example/wallet#read=read-cap-abc");
  });

  it("builds editor URLs with #read= and #editor= fragments", () => {
    const url = buildEditorShareUrl("https://note.example/wallet", "read-key", "editor-key");
    const params = new URL(url).hash.replace(/^#/, "");
    expect(new URLSearchParams(params).get("read")).toBe("read-key");
    expect(new URLSearchParams(params).get("editor")).toBe("editor-key");
  });

  it("round-trips editor capability export", () => {
    const raw = buildEditorCapabilityExport({
      slug: "wallet",
      readerCapability: "read-key",
      editorPrivateKey: "editor-key",
    });
    const parsed = parseEditorCapabilityImport(raw);
    expect(parsed).toEqual({ read: "read-key", editor: "editor-key" });
  });

  it("rejects invalid editor capability JSON", () => {
    expect(parseEditorCapabilityImport("{}")).toBeNull();
    expect(parseEditorCapabilityImport("not json")).toBeNull();
  });
});

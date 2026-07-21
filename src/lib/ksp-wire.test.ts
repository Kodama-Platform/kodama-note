import { describe, expect, it } from "vitest";

import {
  bundleToWireItems,
  parseKspWire,
  primaryIvFromWire,
  serializeKspWire,
  wireItemsToBundle,
} from "@/lib/ksp-wire";

describe("ksp-wire", () => {
  it("round-trips bundle wire payloads", () => {
    const bundle = {
      notes: [{ id: "workbook", iv: "iv1", ciphertext: new Uint8Array([1, 2, 3]) }],
      attachments: [],
    };
    const wire = {
      format: "ksp-v1" as const,
      storage_mode: "bundle" as const,
      version: 2,
      bundle: bundleToWireItems(bundle),
      edit: {
        signature: "sig",
        editor_public_key: "pk",
        old_version: 1,
        new_version: 2,
      },
    };
    const serialized = serializeKspWire(wire);
    const parsed = parseKspWire(serialized);
    expect(parsed).toEqual(wire);
    expect(wireItemsToBundle(parsed!.bundle!)).toEqual(bundle);
    expect(primaryIvFromWire(wire)).toBe("iv1");
  });

  it("returns null for non-wire ciphertext", () => {
    expect(parseKspWire("not-json")).toBeNull();
    expect(parseKspWire('{"format":"other"}')).toBeNull();
  });
});

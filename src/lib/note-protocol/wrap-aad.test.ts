import { describe, expect, it } from "vitest";

import { deriveOwnerWrapKeyBytes, deriveReaderWrapKeyBytes, encodeWrapAad } from "./wrap-aad";

describe("wrap-aad", () => {
  it("encodes wrap AAD with protocol fields", () => {
    const aad = encodeWrapAad({
      placeId: "p1",
      noteId: "workbook",
      epoch: 0,
      capabilityId: "cap",
      role: "owner",
      ownerId: "oid",
    });
    expect(aad.byteLength).toBeGreaterThan(8);
  });

  it("derives distinct owner and reader wrap keys", async () => {
    const ikm = new Uint8Array(32).fill(7);
    const owner = await deriveOwnerWrapKeyBytes(ikm, "place", "workbook");
    const reader = await deriveReaderWrapKeyBytes(ikm, "workbook", "cap-1");
    expect(owner).toHaveLength(32);
    expect(reader).toHaveLength(32);
    expect(owner).not.toEqual(reader);
  });
});

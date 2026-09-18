import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/pages", () => ({
  listAttachments: vi.fn(async () => [
    {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      storage_path: "slug/x.bin",
      iv: "iv",
      filename_ciphertext: "ct",
      filename_iv: "fiv",
      mime: "image/png",
      size: 100,
      created_at: new Date().toISOString(),
    },
  ]),
  downloadAttachmentBlob: vi.fn(async () => ({
    arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
  })),
}));

vi.mock("@/lib/attachment-crypto", () => ({
  decryptAttachmentBytes: vi.fn(async () => new Uint8Array([1, 2, 3])),
  attachmentContentType: vi.fn((mime: string) => mime),
}));

import { primeKodamaBlobCache, resolveKodamaAttachmentUrl } from "@/lib/kodama-image";

const knpCrypto = { kind: "knp" as const, session: {} as never };

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("URL", {
    ...URL,
    createObjectURL: vi.fn(() => "blob:mock"),
  });
});

describe("resolveKodamaAttachmentUrl", () => {
  const attId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

  it("returns null when id is not in allowed set", async () => {
    const url = await resolveKodamaAttachmentUrl(attId, {
      slug: "test",
      crypto: knpCrypto,
      allowedAttachmentIds: new Set(["bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"]),
    });
    expect(url).toBeNull();
  });

  it("returns a primed blob even when the id is not yet in the allowed set", async () => {
    const pendingId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    primeKodamaBlobCache("test", pendingId, new Blob(["x"], { type: "image/png" }));
    const url = await resolveKodamaAttachmentUrl(pendingId, {
      slug: "test",
      crypto: knpCrypto,
      allowedAttachmentIds: new Set(),
    });
    expect(url).toMatch(/^blob:/);
  });

  it("resolves when id is in allowed set", async () => {
    const url = await resolveKodamaAttachmentUrl(attId, {
      slug: "test",
      crypto: knpCrypto,
      allowedAttachmentIds: new Set([attId]),
    });
    expect(url).toMatch(/^blob:/);
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_NOTE_API_URL,
  NoteApiError,
  attachmentStorageUrl,
  backendRootUrl,
  filesApiBaseUrl,
  isMissingPlaceError,
  noteApiBaseUrl,
  noteApiJson,
  noteApiUrl,
  noteResourceUrl,
  parseAttachmentStorageUrl,
} from "./note-api";

describe("note-api", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("defaults to the Kodama Note Delivery Gate", () => {
    vi.stubEnv("VITE_NOTE_API_URL", "");
    vi.stubEnv("VITE_BACKEND_URL", "");
    expect(noteApiBaseUrl()).toBe(DEFAULT_NOTE_API_URL);
    expect(noteApiUrl("/hello")).toBe(`${DEFAULT_NOTE_API_URL}/hello`);
  });

  it("derives /v1/notes from VITE_BACKEND_URL", () => {
    vi.stubEnv(
      "VITE_BACKEND_URL",
      "https://wmztojyiakhmtgekykdi.supabase.co/functions/v1/delivery-gate/",
    );
    vi.stubEnv("VITE_NOTE_API_URL", "");
    expect(backendRootUrl()).toBe(
      "https://wmztojyiakhmtgekykdi.supabase.co/functions/v1/delivery-gate",
    );
    expect(noteApiBaseUrl()).toBe(
      "https://wmztojyiakhmtgekykdi.supabase.co/functions/v1/delivery-gate/v1/notes",
    );
    expect(filesApiBaseUrl()).toBe(
      "https://wmztojyiakhmtgekykdi.supabase.co/functions/v1/delivery-gate/v1/files",
    );
    expect(noteResourceUrl("garden")).toBe(
      "https://wmztojyiakhmtgekykdi.supabase.co/functions/v1/delivery-gate/v1/notes/garden",
    );
  });

  it("round-trips attachment storage URLs", () => {
    vi.stubEnv("VITE_BACKEND_URL", "");
    vi.stubEnv("VITE_NOTE_API_URL", "");
    const path = "garden/abc.bin";
    const url = attachmentStorageUrl("garden", path);
    expect(url).toContain("/garden/files/");
    expect(parseAttachmentStorageUrl(url)).toBe(path);
    expect(parseAttachmentStorageUrl("https://example.com/pic.png")).toBeNull();
  });

  it("encodes slug and file path segments", () => {
    vi.stubEnv("VITE_BACKEND_URL", "");
    vi.stubEnv("VITE_NOTE_API_URL", "");
    expect(noteResourceUrl("my note", "files", "dir/a.bin")).toBe(
      `${DEFAULT_NOTE_API_URL}/my%20note/files/dir%2Fa.bin`,
    );
  });

  it("maps 409 to slug_taken", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ reason: "slug_taken" }), {
          status: 409,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    await expect(noteApiJson("POST", noteApiUrl("/"), { slug: "x" })).rejects.toMatchObject({
      reason: "slug_taken",
    } satisfies Partial<NoteApiError>);
  });

  it("maps 402 to paid_unlock_required and keeps payload", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ reason: "paid_unlock_required", access: "paid" }), {
          status: 402,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    await expect(noteApiJson("GET", noteApiUrl("/garden"))).rejects.toMatchObject({
      status: 402,
      reason: "paid_unlock_required",
      payload: { reason: "paid_unlock_required", access: "paid" },
    } satisfies Partial<NoteApiError>);
  });

  it("unwraps { ok, data } envelopes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ ok: true, data: { slug: "garden", ciphertext: "YQ==" } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    await expect(noteApiJson("GET", noteApiUrl("/garden"))).resolves.toEqual({
      slug: "garden",
      ciphertext: "YQ==",
    });
  });

  it("maps structured NOT_FOUND envelopes to 404", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({ ok: false, error: { code: "NOT_FOUND", message: "No route" } }),
          { status: 404, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );
    await expect(noteApiJson("GET", noteApiUrl("/x/tabs"))).rejects.toMatchObject({
      status: 404,
      reason: "not_found",
    });
  });

  it("forwards writer signature headers from the body", async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ ok: true, data: {} }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await noteApiJson("POST", noteApiUrl("/"), {
      slug: "x",
      owner_public_key: "pub",
      state_signature: "sig",
      mutation_id: "mut-1",
    });
    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Record<string, string>;
    expect(headers["x-kodama-writer-key"]).toBe("pub");
    expect(headers["x-kodama-signature"]).toBe("sig");
    expect(headers["idempotency-key"]).toBe("mut-1");
  });

  it("treats Delivery Gate missing-place 500 as a missing place", () => {
    expect(
      isMissingPlaceError(new NoteApiError("Unable to load place", 500, "internal_error")),
    ).toBe(true);
    expect(isMissingPlaceError(new NoteApiError("not found", 404))).toBe(true);
    expect(isMissingPlaceError(new NoteApiError("boom", 500, "other"))).toBe(false);
  });
});

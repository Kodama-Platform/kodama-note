import { afterEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_NOTE_API_URL } from "@/lib/note-api";
import { getPlaceEntitlement, getPlacePayment, getPlaceSettings } from "@/lib/place-public-api";

describe("place-public-api", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("GETs settings, payment, and entitlement", async () => {
    vi.stubEnv("VITE_BACKEND_URL", "");
    vi.stubEnv("VITE_NOTE_API_URL", "");
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/garden/settings")) {
        return new Response(JSON.stringify({ preset: "paper", font: "serif", font_size: 100 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url.endsWith("/garden/payment")) {
        return new Response(JSON.stringify({ access: "free", bound: false }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url.endsWith("/garden/entitlement")) {
        return new Response(JSON.stringify({ plan: "pro", max_attachments_per_sheet: 50 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response("no", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(getPlaceSettings("garden")).resolves.toMatchObject({ preset: "paper" });
    await expect(getPlacePayment("garden")).resolves.toMatchObject({ access: "free", slug: "garden" });
    await expect(getPlaceEntitlement("garden")).resolves.toMatchObject({
      plan: "pro",
      max_attachments_per_sheet: 50,
    });
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(`${DEFAULT_NOTE_API_URL}/garden/settings`);
  });

  it("returns defaults when settings are missing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 404 })),
    );
    await expect(getPlaceSettings("missing")).resolves.toMatchObject({ preset: "default" });
  });
});

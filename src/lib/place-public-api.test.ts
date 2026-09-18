import { afterEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_NOTE_API_URL } from "@/lib/note-api";
import { getPlaceEntitlement, getPlacePayment, getPlaceSettings } from "@/lib/place-public-api";

describe("place-public-api", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("GETs settings from the Gate and uses local free payment defaults", async () => {
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
      return new Response("no", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(getPlaceSettings("garden")).resolves.toMatchObject({ preset: "paper" });
    await expect(getPlacePayment("garden")).resolves.toMatchObject({ access: "free", slug: "garden" });
    await expect(getPlaceEntitlement("garden")).resolves.toMatchObject({
      plan: "free",
      paid_unlock_required: false,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
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

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_PAY_API_URL,
  fetchPayCatalog,
  parsePayAccount,
  parsePayCatalog,
  payApiUrl,
  startPayCheckout,
} from "@/lib/kodama-pay";

describe("kodama-pay", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("defaults to the ecosystem pay base", () => {
    vi.stubEnv("VITE_PAY_API_URL", "");
    expect(payApiUrl("/catalog")).toBe(`${DEFAULT_PAY_API_URL}/catalog`);
  });

  it("parses account and catalog payloads", () => {
    expect(parsePayAccount({ account_id: "acc_1", plan: "starter" })).toEqual({
      account_id: "acc_1",
      plan: "starter",
    });
    expect(parsePayCatalog({ items: [{ id: "sku_pro", kind: "plan", plan: "pro", label: "Pro" }] })).toEqual([
      { id: "sku_pro", product: "note", kind: "plan", plan: "pro", label: "Pro" },
    ]);
  });

  it("posts checkout and lists catalog", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/catalog")) {
        return new Response(JSON.stringify([{ id: "sku_note", label: "Note unlock" }]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url.endsWith("/checkout") && init?.method === "POST") {
        return new Response(JSON.stringify({ checkout_url: "https://pay.kodama.com/c/1" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response("no", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchPayCatalog("note")).resolves.toMatchObject([{ id: "sku_note" }]);
    await expect(
      startPayCheckout({ product: "note", place_slug: "garden" }),
    ).resolves.toEqual({ checkout_url: "https://pay.kodama.com/c/1" });
  });
});

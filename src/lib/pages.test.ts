import { afterEach, describe, expect, it, vi } from "vitest";

import { getPage } from "@/lib/pages";

describe("getPage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("hydrates nested settings, payment, and entitlement", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            slug: "garden",
            ciphertext: "YQ==",
            salt: "cw==",
            kdf_params: { protocol: "knp-1" },
            burn_mode: "never",
            expires_at: null,
            updated_at: "2026-01-01T00:00:00.000Z",
            settings: { preset: "paper", font: "serif" },
            payment: { access: "donation", donate: { visible: true, destination: "https://x" } },
            entitlement: { plan: "starter", max_attachments_per_sheet: 5 },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    const page = await getPage("garden");
    expect(page.exists).toBe(true);
    if (!page.exists) return;
    expect(page.settings?.preset).toBe("paper");
    expect(page.payment?.access).toBe("donation");
    expect(page.entitlement?.plan).toBe("starter");
    expect(page.paid_unlock_required).toBe(false);
    expect(page.public_tabs).toEqual([]);
  });

  it("hydrates public tabs without requiring unlock", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            slug: "kodama",
            title: "Kodama",
            settings: { preset: "paper" },
            tabs: [
              {
                tab_id: "tab-001",
                public_slug: "welcome",
                title: "Welcome",
                content_markdown: "Hello",
                display_order: 0,
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    const page = await getPage("kodama");
    expect(page.exists).toBe(true);
    if (!page.exists) return;
    expect(page.public_tabs).toHaveLength(1);
    expect(page.public_tabs?.[0]?.title).toBe("Welcome");
    expect(page.ciphertext).toBe("");
  });

  it("treats 402 as a paid-unlock place", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ reason: "paid_unlock_required", access: "paid" }), {
          status: 402,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    const page = await getPage("garden");
    expect(page.exists).toBe(true);
    if (!page.exists) return;
    expect(page.paid_unlock_required).toBe(true);
    expect(page.ciphertext).toBe("");
  });

  it("treats Delivery Gate 500 Unable to load place as missing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ error: "Unable to load place", reason: "internal_error" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    await expect(getPage("missing")).resolves.toEqual({ exists: false });
  });
});

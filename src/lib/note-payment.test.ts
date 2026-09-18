import { describe, expect, it } from "vitest";

import {
  donateDestinationUrl,
  parseNoteEntitlement,
  parseNotePaymentOwner,
  parseNotePaymentPublic,
} from "@/lib/note-payment";

describe("note-payment", () => {
  it("parses a public payment summary", () => {
    const parsed = parseNotePaymentPublic(
      {
        bound: true,
        access: "donation",
        donate: { visible: true, destination: "https://ko-fi.com/x" },
      },
      "garden",
    );
    expect(parsed).toMatchObject({
      slug: "garden",
      bound: true,
      access: "donation",
    });
    expect(donateDestinationUrl(parsed)).toBe("https://ko-fi.com/x");
  });

  it("parses owner payment and entitlement", () => {
    expect(
      parseNotePaymentOwner({
        access: "paid",
        account_id: "acc_1",
        plan_override: "pro",
        pay_product_id: "sku_note",
        donate: { visible: false },
      }),
    ).toMatchObject({
      access: "paid",
      account_id: "acc_1",
      plan_override: "pro",
    });
    expect(
      parseNoteEntitlement({ plan: "starter", max_attachments_per_sheet: 5 }, "garden"),
    ).toEqual({
      product: "note",
      slug: "garden",
      plan: "starter",
      max_attachments_per_sheet: 5,
      paid_unlock_required: false,
    });
  });

  it("treats unlimited attachment cap as null", () => {
    expect(
      parseNoteEntitlement({ plan: "premium", max_attachments_per_sheet: "unlimited" }, "x")
        ?.max_attachments_per_sheet,
    ).toBeNull();
  });
});

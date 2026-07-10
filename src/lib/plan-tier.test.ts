import { describe, it, expect } from "vitest";
import { formatAttachmentLimit, getPlanTier, maxAttachmentsPerSheet } from "@/lib/plan-tier";

describe("plan-tier", () => {
  it("defaults to free", () => {
    expect(getPlanTier()).toBe("free");
  });

  it("maps tier limits per sheet", () => {
    expect(maxAttachmentsPerSheet("free")).toBe(1);
    expect(maxAttachmentsPerSheet("starter")).toBe(5);
    expect(maxAttachmentsPerSheet("pro")).toBe(50);
    expect(maxAttachmentsPerSheet("premium")).toBeNull();
  });

  it("formats limits for UI", () => {
    expect(formatAttachmentLimit("free")).toBe("1");
    expect(formatAttachmentLimit("premium")).toBe("unlimited");
  });
});

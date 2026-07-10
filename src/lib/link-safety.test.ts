import { describe, it, expect } from "vitest";
import { assessLinkRisk } from "@/lib/link-safety";

describe("assessLinkRisk", () => {
  it("treats https URLs as safe", () => {
    const result = assessLinkRisk("https://example.com/path");
    expect(result.level).toBe("safe");
    expect(result.href).toBe("https://example.com/path");
  });

  it("flags http URLs as caution", () => {
    const result = assessLinkRisk("http://example.com");
    expect(result.level).toBe("caution");
    expect(result.reasons.some((r) => r.includes("HTTP"))).toBe(true);
  });

  it("blocks javascript URLs", () => {
    const result = assessLinkRisk("javascript:alert(1)");
    expect(result.level).toBe("blocked");
    expect(result.href).toBeNull();
  });

  it("flags IP addresses as caution", () => {
    const result = assessLinkRisk("https://192.168.0.1/login");
    expect(result.level).toBe("caution");
    expect(result.reasons.some((r) => r.includes("IP"))).toBe(true);
  });

  it("flags embedded credentials as caution", () => {
    const result = assessLinkRisk("https://user:pass@example.com");
    expect(result.level).toBe("caution");
    expect(result.reasons.some((r) => r.includes("password"))).toBe(true);
  });
});

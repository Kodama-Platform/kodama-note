export type PlanTier = "free" | "starter" | "pro" | "premium";

export function isPlanTier(value: unknown): value is PlanTier {
  return value === "free" || value === "starter" || value === "pro" || value === "premium";
}

/** Resolve plan from place entitlement. Missing entitlement → free. */
export function getPlanTier(entitlement?: { plan?: unknown } | null): PlanTier {
  return isPlanTier(entitlement?.plan) ? entitlement.plan : "free";
}

/** `null` means unlimited (premium). */
export function maxAttachmentsPerSheet(tier: PlanTier): number | null {
  switch (tier) {
    case "free":
      return 1;
    case "starter":
      return 5;
    case "pro":
      return 50;
    case "premium":
      return null;
  }
}

export function formatAttachmentLimit(tier: PlanTier): string {
  const limit = maxAttachmentsPerSheet(tier);
  return limit === null ? "unlimited" : String(limit);
}

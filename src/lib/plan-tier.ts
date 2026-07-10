export type PlanTier = "free" | "starter" | "pro" | "premium";

/** Stub — wire to billing / account when available. */
export function getPlanTier(): PlanTier {
  return "free";
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

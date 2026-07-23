/** UI gating for the opt-in legacy → KSP upgrade banner. */
export type MigrateToKspGate =
  | { status: "hidden" }
  | { status: "blocked_attachments" }
  | { status: "blocked_no_token" }
  | { status: "ready" };

export function resolveMigrateToKspGate(args: {
  isLegacy: boolean;
  isReader: boolean;
  hasEditToken: boolean;
  hasAttachments: boolean;
}): MigrateToKspGate {
  if (!args.isLegacy || args.isReader) return { status: "hidden" };
  if (args.hasAttachments) return { status: "blocked_attachments" };
  if (!args.hasEditToken) return { status: "blocked_no_token" };
  return { status: "ready" };
}

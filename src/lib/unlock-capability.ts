export type UnlockCapability = "owner" | "editor" | "reader";

export function resolveUnlockCapability(args: {
  hasEditorSecrets?: boolean;
  hasReadCapability?: boolean;
  unlockedWithPassword?: boolean;
}): UnlockCapability {
  if (args.hasEditorSecrets || args.unlockedWithPassword) return "editor";
  if (args.hasReadCapability) return "reader";
  return "owner";
}

export function lockedBadgeLabel(capability: UnlockCapability): string {
  switch (capability) {
    case "editor":
      return "Locked · editable";
    case "reader":
      return "Locked · read-only";
    default:
      return "Locked";
  }
}

export function lockedDescription(capability: UnlockCapability): string {
  switch (capability) {
    case "editor":
      return "Enter your password to unlock editing, or import an editor capability you received out-of-band.";
    case "reader":
      return "Re-open your read-only share link, or enter the place password if you have it.";
    default:
      return "Enter the password to unlock this place.";
  }
}

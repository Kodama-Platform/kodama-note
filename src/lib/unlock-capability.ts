export type UnlockCapability = "owner" | "editor" | "reader";

export function resolveUnlockCapability(
  editToken: string | null,
  unlockedViaShareLink: boolean,
): UnlockCapability {
  if (editToken) return "editor";
  if (unlockedViaShareLink) return "reader";
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
      return "Enter your password to unlock. Edit access on this device is restored from your saved share link.";
    case "reader":
      return "Re-open your share link or enter the password from the link to read this place again.";
    default:
      return "Enter the password to unlock this place.";
  }
}

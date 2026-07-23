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
      return "Ready to edit";
    case "reader":
      return "Read-only link";
    default:
      return "Encrypted place";
  }
}

export function lockedDescription(capability: UnlockCapability): string {
  switch (capability) {
    case "editor":
      return "Enter the place password to unlock. Your password stays on this device.";
    case "reader":
      return "This link can open the note for reading. Use the place password if you need to edit.";
    default:
      return "Enter the place password to decrypt and open your notes.";
  }
}

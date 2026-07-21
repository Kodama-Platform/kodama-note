import { base64ToBytes, bytesToBase64, type PlaceBundle } from "@kodama.page/ksp-core";

/** JSON envelope stored in `pages.ciphertext` for KSP places (version + signed edits). */
export type KspWirePayload = {
  format: "ksp-v1";
  storage_mode: "legacy" | "bundle";
  version: number;
  legacy?: {
    iv: string;
    ciphertext: string;
  };
  bundle?: {
    notes: Array<{ id: string; iv: string; ciphertext: string }>;
    attachments: Array<{ id: string; iv: string; ciphertext: string }>;
  };
  edit?: {
    signature: string;
    editor_public_key: string;
    old_version: number;
    new_version: number;
  };
};

export function isKspWirePayload(raw: unknown): raw is KspWirePayload {
  return (
    !!raw &&
    typeof raw === "object" &&
    (raw as KspWirePayload).format === "ksp-v1" &&
    typeof (raw as KspWirePayload).version === "number"
  );
}

export function parseKspWire(ciphertext: string): KspWirePayload | null {
  const trimmed = ciphertext.trim();
  if (!trimmed.startsWith("{")) return null;
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    return isKspWirePayload(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function serializeKspWire(payload: KspWirePayload): string {
  return JSON.stringify(payload);
}

export function bundleToWireItems(bundle: PlaceBundle): NonNullable<KspWirePayload["bundle"]> {
  return {
    notes: bundle.notes.map((n) => ({
      id: n.id,
      iv: n.iv,
      ciphertext: bytesToBase64(n.ciphertext),
    })),
    attachments: bundle.attachments.map((a) => ({
      id: a.id,
      iv: a.iv,
      ciphertext: bytesToBase64(a.ciphertext),
    })),
  };
}

export function wireItemsToBundle(items: NonNullable<KspWirePayload["bundle"]>): PlaceBundle {
  return {
    notes: items.notes.map((n) => ({
      id: n.id,
      iv: n.iv,
      ciphertext: base64ToBytes(n.ciphertext),
    })),
    attachments: items.attachments.map((a) => ({
      id: a.id,
      iv: a.iv,
      ciphertext: base64ToBytes(a.ciphertext),
    })),
  };
}

export function primaryIvFromWire(wire: KspWirePayload): string {
  if (wire.storage_mode === "bundle" && wire.bundle?.notes[0]) {
    return wire.bundle.notes[0].iv;
  }
  return wire.legacy?.iv ?? "";
}

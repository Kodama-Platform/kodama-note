import { base64ToBytes, type PlaceBundle } from "@kodama.page/ksp-core";

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

export type KspPlaceMeta = {
  protocol: "ksp-v1";
  kdf: "argon2id" | "pbkdf2";
  version: number;
  product_type: string;
  storage_mode: "legacy" | "bundle";
  owner_public_key: string;
  editor_public_keys: string[];
  owner_signature: string;
};

export function isKspPlaceMeta(raw: unknown): raw is KspPlaceMeta {
  return (
    !!raw &&
    typeof raw === "object" &&
    (raw as KspPlaceMeta).protocol === "ksp-v1" &&
    typeof (raw as KspPlaceMeta).owner_public_key === "string"
  );
}

export function parseKspWire(ciphertext: string): KspWirePayload | null {
  const trimmed = ciphertext.trim();
  if (!trimmed.startsWith("{")) return null;
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (
      !parsed ||
      typeof parsed !== "object" ||
      (parsed as KspWirePayload).format !== "ksp-v1" ||
      typeof (parsed as KspWirePayload).version !== "number"
    ) {
      return null;
    }
    return parsed as KspWirePayload;
  } catch {
    return null;
  }
}

export function wireItemsToBundle(
  items: NonNullable<KspWirePayload["bundle"]>,
): PlaceBundle {
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

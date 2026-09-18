/**
 * Trusted anti-rollback pin (KNP-1 §7). This is not a secret: hashes and
 * version numbers only. Persisting in localStorage is intentional so a device
 * can detect Delivery Gate rollback after a reload.
 */
export type NoteCheckpoint = {
  readonly noteId: string;
  readonly epoch: number;
  readonly version: number;
  readonly stateHashB64: string;
  readonly policyHashB64: string;
};

const PREFIX = "kodama.knp.checkpoint.v1:";

export function checkpointStorageKey(noteId: string): string {
  return `${PREFIX}${noteId}`;
}

export function loadCheckpoint(noteId: string): NoteCheckpoint | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(checkpointStorageKey(noteId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as NoteCheckpoint;
    if (
      !parsed ||
      parsed.noteId !== noteId ||
      typeof parsed.version !== "number" ||
      typeof parsed.stateHashB64 !== "string"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveCheckpoint(cp: NoteCheckpoint): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(checkpointStorageKey(cp.noteId), JSON.stringify(cp));
}

export function clearCheckpoint(noteId: string): void {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(checkpointStorageKey(noteId));
}

/** Reject older or unrelated states vs trusted checkpoint (KNP-1 §7). */
export function assertCheckpointAccepts(input: {
  readonly checkpoint: NoteCheckpoint | null;
  readonly epoch: number;
  readonly version: number;
  readonly previousStateHashB64: string | null;
  readonly stateHashB64: string;
}): void {
  const cp = input.checkpoint;
  if (!cp) return;
  if (input.epoch < cp.epoch) {
    throw new Error("rollback: epoch older than trusted checkpoint");
  }
  if (input.epoch === cp.epoch && input.version < cp.version) {
    throw new Error("rollback: version older than trusted checkpoint");
  }
  if (
    input.epoch === cp.epoch &&
    input.version === cp.version + 1 &&
    input.previousStateHashB64 !== cp.stateHashB64
  ) {
    throw new Error("fork: previous state hash does not match trusted checkpoint");
  }
  if (input.epoch === cp.epoch && input.version === cp.version) {
    if (input.stateHashB64 !== cp.stateHashB64) {
      throw new Error("fork: conflicting state at trusted version");
    }
  }
}

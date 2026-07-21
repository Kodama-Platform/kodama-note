/** Keys that must never be sent to the backend — passwords and decrypted content stay in the browser. */
const FORBIDDEN_PAYLOAD_KEY =
  /password|plaintext|^text$|^content$|^body$|^pw$|^secret$|private[_-]?key|read[_-]?key|reader[_-]?capability|owner[_-]?private|editor[_-]?private|master[_-]?secret/i;

/** Guard every write RPC so passwords / plaintext cannot be sent to Supabase by mistake. */
export function assertNoSecretsInPayload(payload: Record<string, unknown>, context: string): void {
  for (const [key, value] of Object.entries(payload)) {
    if (FORBIDDEN_PAYLOAD_KEY.test(key)) {
      throw new Error(
        `[${context}] Refusing to send "${key}" to the server. Encrypt in the browser first; the database stores ciphertext only.`,
      );
    }
    if (value && typeof value === "object" && !Array.isArray(value)) {
      assertNoSecretsInPayload(value as Record<string, unknown>, context);
    }
  }
}

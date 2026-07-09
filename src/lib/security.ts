import { DEFAULT_KDF_PARAMS } from "@/lib/crypto";

/** Core threat-model flow — answers "Can Kodama read my pages?" */
export const THREAT_MODEL_STEPS = [
  { label: "You write", detail: "Plaintext stays in your browser tab." },
  { label: "Encrypted in your browser", detail: "Argon2id + AES-256-GCM before any network request." },
  { label: "Only ciphertext reaches Kodama", detail: "We store blobs we cannot decrypt." },
  { label: "Readers decrypt locally with the password", detail: "The server never sees the password or key." },
] as const;

export const VISIBILITY = {
  canSee: [
    "Page slug (the URL path you chose)",
    "Encrypted ciphertext blob",
    "Salt, IV, and KDF parameters",
    "Creation and update timestamps",
    "Approximate ciphertext size",
    "Expiry / burn-after-read settings",
  ],
  cannotSee: [
    "Page contents (plaintext)",
    "Your password",
    "Derived encryption key",
    "Attachment filenames or file bytes (also encrypted)",
    "Who reads a page or when",
    "IP addresses for analytics (we don't run analytics)",
  ],
} as const;

export const CRYPTO_SPEC_STEPS = [
  "Password",
  "Argon2id",
  "256-bit key",
  "AES-256-GCM",
  "Ciphertext",
  "Server",
] as const;

export const LIMITATIONS = [
  {
    title: "Lost passwords cannot be recovered",
    body: "We never receive your password. If you lose it, the page is permanently unreadable — by design.",
  },
  {
    title: "We cannot reset passwords",
    body: "There is no password-reset flow because we have nothing to reset. Only someone with the password can decrypt.",
  },
  {
    title: "Slug names are public",
    body: "Anyone can see that note.kodama.page/your-slug exists. They cannot read the contents without the password.",
  },
  {
    title: "Browser security matters",
    body: "If malware or a malicious extension reads your screen or memory while you type, encryption cannot help. Use a trusted device and browser.",
  },
] as const;

export const KDF_SPEC = {
  algorithm: "Argon2id",
  memoryKiB: DEFAULT_KDF_PARAMS.m,
  memoryMiB: DEFAULT_KDF_PARAMS.m / 1024,
  iterations: DEFAULT_KDF_PARAMS.t,
  parallelism: DEFAULT_KDF_PARAMS.p,
  hashLength: 256,
  saltBytes: 16,
} as const;

export const CIPHER_SPEC = {
  algorithm: "AES-256-GCM",
  ivBytes: 12,
  api: "Web Crypto API (SubtleCrypto)",
} as const;

export const PRIVACY_PRINCIPLES = [
  "No accounts unless strictly necessary",
  "No analytics, cookies, or behavioral tracking on Note",
  "No ads or data resale",
  "Encryption before upload — not after",
  "Honest about what metadata we retain",
] as const;

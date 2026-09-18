import { assertNoSecretsInPayload } from "@/lib/server-payload";

export const DEFAULT_BACKEND_URL = "https://api.kodama.com";
export const DEFAULT_NOTE_API_URL = "https://api.kodama.com/v1/notes";

function envUrl(name: "VITE_BACKEND_URL" | "VITE_NOTE_API_URL"): string {
  const raw = (import.meta.env[name] as string | undefined)?.trim();
  return raw ? raw.replace(/\/+$/, "") : "";
}

/** Delivery Gate root (`…/delivery-gate` or `https://api.kodama.com`). */
export function backendRootUrl(): string {
  const backend = envUrl("VITE_BACKEND_URL");
  if (backend) {
    return backend.replace(/\/v1\/notes$/i, "") || backend;
  }
  const notes = envUrl("VITE_NOTE_API_URL");
  if (notes) {
    const stripped = notes.replace(/\/v1\/notes$/i, "");
    return stripped || notes;
  }
  return DEFAULT_BACKEND_URL;
}

/** Notes product base: `{backend}/v1/notes`. */
export function noteApiBaseUrl(): string {
  const explicit = envUrl("VITE_NOTE_API_URL");
  if (explicit) return explicit;
  const backend = envUrl("VITE_BACKEND_URL");
  if (backend) {
    if (/\/v1\/notes$/i.test(backend)) return backend;
    return `${backend}/v1/notes`;
  }
  return DEFAULT_NOTE_API_URL;
}

export function filesApiBaseUrl(): string {
  return `${backendRootUrl()}/v1/files`;
}

export function noteApiUrl(path: string): string {
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${noteApiBaseUrl()}${suffix}`;
}

export function noteResourceUrl(slug: string, ...segments: string[]): string {
  const parts = [encodeURIComponent(slug), ...segments.map((s) => encodeURIComponent(s))];
  return noteApiUrl(`/${parts.join("/")}`);
}

/** GET/PUT URL for an encrypted attachment blob. */
export function attachmentStorageUrl(slug: string, storagePath: string): string {
  return noteResourceUrl(slug, "files", storagePath);
}

/** Extract `storage_path` from a Note files URL, or null if it is not ours. */
export function parseAttachmentStorageUrl(src: string | null | undefined): string | null {
  if (!src) return null;
  let url: URL;
  try {
    url = new URL(src);
  } catch {
    return null;
  }
  let base: URL;
  try {
    base = new URL(noteApiBaseUrl());
  } catch {
    return null;
  }
  if (url.origin !== base.origin) return null;
  const prefix = base.pathname.replace(/\/+$/, "");
  if (prefix && !url.pathname.startsWith(`${prefix}/`)) return null;
  const rest = (prefix ? url.pathname.slice(prefix.length) : url.pathname).replace(/^\/+/, "");
  const parts = rest.split("/").filter(Boolean).map((p) => decodeURIComponent(p));
  const filesAt = parts.indexOf("files");
  if (filesAt < 1 || filesAt === parts.length - 1) return null;
  return parts.slice(filesAt + 1).join("/");
}

export class NoteApiError extends Error {
  readonly status: number;
  readonly reason?: string;
  readonly payload?: Record<string, unknown>;

  constructor(message: string, status: number, reason?: string, payload?: Record<string, unknown>) {
    super(message);
    this.name = "NoteApiError";
    this.status = status;
    this.reason = reason;
    this.payload = payload;
  }
}

export type NoteApiJsonOptions = {
  authorization?: string;
  writerPublicKey?: string;
  signature?: string;
};

export function fileResourceUrl(id: string): string {
  return `${filesApiBaseUrl()}/${encodeURIComponent(id)}`;
}

export function filesListUrl(placeId: string): string {
  const params = new URLSearchParams({ product: "note", place_id: placeId });
  return `${filesApiBaseUrl()}?${params.toString()}`;
}

function isEnvelope(value: unknown): value is {
  ok?: boolean;
  data?: unknown;
  error?: unknown;
  reason?: unknown;
  meta?: unknown;
} {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function unwrapSuccess<T>(payload: Record<string, unknown>): T {
  if (payload.ok === true && "data" in payload) {
    return payload.data as T;
  }
  return payload as T;
}

function errorFields(payload: Record<string, unknown>): { message?: string; reason?: string } {
  const nested = payload.error;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    const obj = nested as Record<string, unknown>;
    const message = typeof obj.message === "string" ? obj.message : undefined;
    const code = typeof obj.code === "string" ? obj.code : undefined;
    return { message, reason: code?.toLowerCase() };
  }
  return {
    message: typeof payload.error === "string" ? payload.error : undefined,
    reason: typeof payload.reason === "string" ? payload.reason : undefined,
  };
}

async function readJsonObject(res: Response): Promise<Record<string, unknown>> {
  try {
    const raw = (await res.json()) as unknown;
    return isEnvelope(raw) ? (raw as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

async function throwHttpError(res: Response, payload?: Record<string, unknown>): Promise<never> {
  const body = payload ?? (await readJsonObject(res));
  const { message, reason } = errorFields(body);
  const status =
    res.status === 200 && (reason === "not_found" || body.ok === false) ? 404 : res.status;
  if (status === 409 || reason === "slug_taken") {
    throw new NoteApiError(message || "slug_taken", status, "slug_taken", body);
  }
  if (status === 402 || reason === "paid_unlock_required") {
    throw new NoteApiError(message || "paid unlock required", status, reason || "paid_unlock_required", body);
  }
  if (status === 404 || reason === "not_found") {
    throw new NoteApiError(message || "not found", 404, reason || "not_found", body);
  }
  throw new NoteApiError(message || res.statusText || "request failed", status, reason, body);
}

function writerHeaders(body?: Record<string, unknown>): Record<string, string> {
  if (!body) return {};
  const writer =
    (typeof body.writer_public_key === "string" && body.writer_public_key) ||
    (typeof body.owner_public_key === "string" && body.owner_public_key) ||
    "";
  const signature = typeof body.state_signature === "string" ? body.state_signature : "";
  const mutation = typeof body.mutation_id === "string" ? body.mutation_id : "";
  const headers: Record<string, string> = {};
  if (writer) headers["x-kodama-writer-key"] = writer;
  if (signature) headers["x-kodama-signature"] = signature;
  if (mutation) headers["idempotency-key"] = mutation;
  return headers;
}

export async function noteApiJson<T>(
  method: string,
  url: string,
  body?: Record<string, unknown>,
  options?: NoteApiJsonOptions,
): Promise<T> {
  if (body) assertNoSecretsInPayload(body, `${method} ${url}`);
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...writerHeaders(body),
  };
  if (body) headers["Content-Type"] = "application/json";
  if (options?.authorization) headers.Authorization = options.authorization;
  if (options?.writerPublicKey) headers["x-kodama-writer-key"] = options.writerPublicKey;
  if (options?.signature) headers["x-kodama-signature"] = options.signature;
  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await readJsonObject(res);
  if (res.status === 404) {
    throw new NoteApiError("not found", 404, "not_found", payload);
  }
  if (!res.ok || payload.ok === false) {
    await throwHttpError(res, payload);
  }
  if (res.status === 204) return undefined as T;
  return unwrapSuccess<T>(payload);
}

export async function noteApiPutBlob(url: string, blob: Blob): Promise<void> {
  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/octet-stream" },
    body: blob,
  });
  if (!res.ok) {
    await throwHttpError(res);
  }
}

export async function noteApiGetBlob(url: string): Promise<Blob> {
  const res = await fetch(url, { method: "GET" });
  if (!res.ok) {
    await throwHttpError(res);
  }
  return res.blob();
}

/** The live Delivery Gate returns 500 "Unable to load place" for a missing slug. */
export function isMissingPlaceError(error: unknown): boolean {
  if (!(error instanceof NoteApiError)) return false;
  if (error.status === 404 || error.reason === "not_found") return true;
  return (
    error.status === 500 &&
    (error.reason === "internal_error" || /unable to load place/i.test(error.message))
  );
}

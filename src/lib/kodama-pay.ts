import { getKodamaAccountToken } from "@/lib/kodama-account-session";
import { NoteApiError, noteApiJson } from "@/lib/note-api";
import { parseNoteEntitlement, type NotePlaceEntitlement } from "@/lib/note-payment";
import type { PlanTier } from "@/lib/plan-tier";

export const DEFAULT_PAY_API_URL = "https://api.kodama.com/v1/pay";

export function payApiBaseUrl(): string {
  const raw = (import.meta.env.VITE_PAY_API_URL as string | undefined)?.trim();
  return (raw || DEFAULT_PAY_API_URL).replace(/\/+$/, "");
}

export function payApiUrl(path: string): string {
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${payApiBaseUrl()}${suffix}`;
}

function payAuth(): { authorization?: string } {
  const token = getKodamaAccountToken();
  return token ? { authorization: `Bearer ${token}` } : {};
}

export type KodamaPayAccount = {
  account_id: string;
  plan: PlanTier;
};

export type KodamaPayCatalogItem = {
  id: string;
  product: string;
  kind: "plan" | "unlock" | string;
  plan?: PlanTier;
  label: string;
};

export type KodamaPayCheckoutRequest = {
  account_id?: string;
  product: "note";
  sku?: string;
  place_slug: string;
};

export type KodamaPayCheckoutResponse = {
  checkout_url?: string;
  client_secret?: string;
};

export type KodamaPayBinding = {
  product: "note";
  slug: string;
  account_id?: string;
};

const PLANS: PlanTier[] = ["free", "starter", "pro", "premium"];

function asPlan(value: unknown): PlanTier {
  return typeof value === "string" && (PLANS as string[]).includes(value)
    ? (value as PlanTier)
    : "free";
}

export function parsePayAccount(raw: unknown): KodamaPayAccount | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const id =
    (typeof row.account_id === "string" && row.account_id) ||
    (typeof row.id === "string" && row.id) ||
    "";
  if (!id) return null;
  return { account_id: id, plan: asPlan(row.plan) };
}

export function parsePayCatalog(raw: unknown): KodamaPayCatalogItem[] {
  const list = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object"
      ? ((raw as { items?: unknown[]; catalog?: unknown[] }).items ??
        (raw as { items?: unknown[]; catalog?: unknown[] }).catalog ??
        [])
      : [];
  return list.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const id = typeof row.id === "string" ? row.id : "";
    if (!id) return [];
    return [
      {
        id,
        product: typeof row.product === "string" ? row.product : "note",
        kind: typeof row.kind === "string" ? row.kind : "plan",
        plan: typeof row.plan === "string" ? asPlan(row.plan) : undefined,
        label: typeof row.label === "string" ? row.label : id,
      },
    ];
  });
}

export async function fetchPayAccountMe(): Promise<KodamaPayAccount | null> {
  try {
    const row = await noteApiJson<unknown>("GET", payApiUrl("/accounts/me"), undefined, payAuth());
    return parsePayAccount(row);
  } catch (error) {
    if (error instanceof NoteApiError && (error.status === 401 || error.status === 404)) {
      return null;
    }
    throw error;
  }
}

export async function fetchPayCatalog(product = "note"): Promise<KodamaPayCatalogItem[]> {
  const url = `${payApiUrl("/catalog")}?product=${encodeURIComponent(product)}`;
  const row = await noteApiJson<unknown>("GET", url, undefined, payAuth());
  return parsePayCatalog(row);
}

export async function startPayCheckout(
  request: KodamaPayCheckoutRequest,
): Promise<KodamaPayCheckoutResponse> {
  return noteApiJson<KodamaPayCheckoutResponse>("POST", payApiUrl("/checkout"), request, payAuth());
}

export async function fetchPayEntitlement(slug: string): Promise<NotePlaceEntitlement | null> {
  const url = `${payApiUrl("/entitlements")}?product=note&slug=${encodeURIComponent(slug)}`;
  try {
    const row = await noteApiJson<unknown>("GET", url, undefined, payAuth());
    return parseNoteEntitlement(row, slug);
  } catch (error) {
    if (error instanceof NoteApiError && (error.status === 404 || error.status === 401)) {
      return null;
    }
    throw error;
  }
}

export async function fetchPayBinding(slug: string): Promise<KodamaPayBinding | null> {
  try {
    const row = await noteApiJson<Record<string, unknown>>(
      "GET",
      payApiUrl(`/bindings/note/${encodeURIComponent(slug)}`),
      undefined,
      payAuth(),
    );
    return {
      product: "note",
      slug: typeof row.slug === "string" ? row.slug : slug,
      account_id: typeof row.account_id === "string" ? row.account_id : undefined,
    };
  } catch (error) {
    if (error instanceof NoteApiError && (error.status === 404 || error.status === 401)) {
      return null;
    }
    throw error;
  }
}

export async function putPayBinding(
  slug: string,
  body: Record<string, unknown>,
): Promise<KodamaPayBinding | null> {
  const row = await noteApiJson<Record<string, unknown>>(
    "PUT",
    payApiUrl(`/bindings/note/${encodeURIComponent(slug)}`),
    body,
    payAuth(),
  );
  return {
    product: "note",
    slug: typeof row.slug === "string" ? row.slug : slug,
    account_id: typeof row.account_id === "string" ? row.account_id : undefined,
  };
}

export async function fetchPayInvoices(accountId?: string): Promise<unknown[]> {
  const query = accountId ? `?account_id=${encodeURIComponent(accountId)}` : "";
  const row = await noteApiJson<unknown[] | { items?: unknown[] }>(
    "GET",
    `${payApiUrl("/invoices")}${query}`,
    undefined,
    payAuth(),
  );
  return Array.isArray(row) ? row : (row.items ?? []);
}

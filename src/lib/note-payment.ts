/** Public per-slug payment bind + entitlement (Kodama ecosystem pay). */

import { maxAttachmentsPerSheet, type PlanTier } from "@/lib/plan-tier";

export const NOTE_PLACE_PAYMENT_SCHEMA = "kodama-place-payment-1" as const;

export type NotePaymentAccess = "free" | "paid" | "donation";

export type NotePlaceDonate = {
  visible: boolean;
  destination?: string;
};

/** Public-safe GET /{slug}/payment */
export type NotePlacePaymentPublic = {
  schema: typeof NOTE_PLACE_PAYMENT_SCHEMA;
  product: "note";
  slug: string;
  bound: boolean;
  access: NotePaymentAccess;
  donate: NotePlaceDonate;
};

/** Owner PUT /{slug}/payment */
export type NotePlacePaymentOwner = {
  schema: typeof NOTE_PLACE_PAYMENT_SCHEMA;
  account_id?: string | null;
  access: NotePaymentAccess;
  plan_override: PlanTier | null;
  pay_product_id: string | null;
  donate: NotePlaceDonate;
};

export type NotePlaceEntitlement = {
  product: "note";
  slug: string;
  plan: PlanTier;
  max_attachments_per_sheet: number | null;
  paid_unlock_required: boolean;
};

const ACCESS: NotePaymentAccess[] = ["free", "paid", "donation"];
const PLANS: PlanTier[] = ["free", "starter", "pro", "premium"];

function isAccess(value: unknown): value is NotePaymentAccess {
  return typeof value === "string" && (ACCESS as string[]).includes(value);
}

function isPlan(value: unknown): value is PlanTier {
  return typeof value === "string" && (PLANS as string[]).includes(value);
}

function parseDonate(raw: unknown): NotePlaceDonate {
  if (!raw || typeof raw !== "object") return { visible: false };
  const row = raw as Record<string, unknown>;
  const destination = typeof row.destination === "string" ? row.destination.trim() : "";
  return {
    visible: row.visible === true,
    destination: destination || undefined,
  };
}

export function defaultNotePaymentPublic(slug: string): NotePlacePaymentPublic {
  return {
    schema: NOTE_PLACE_PAYMENT_SCHEMA,
    product: "note",
    slug,
    bound: false,
    access: "free",
    donate: { visible: false },
  };
}

export function defaultNoteEntitlement(slug: string, plan: PlanTier = "free"): NotePlaceEntitlement {
  return {
    product: "note",
    slug,
    plan,
    max_attachments_per_sheet: maxAttachmentsPerSheet(plan),
    paid_unlock_required: false,
  };
}

export function parseNotePaymentPublic(raw: unknown, slug: string): NotePlacePaymentPublic | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  return {
    schema: NOTE_PLACE_PAYMENT_SCHEMA,
    product: "note",
    slug: typeof row.slug === "string" && row.slug ? row.slug : slug,
    bound: row.bound === true,
    access: isAccess(row.access) ? row.access : "free",
    donate: parseDonate(row.donate),
  };
}

export function parseNotePaymentOwner(raw: unknown): NotePlacePaymentOwner | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const account =
    typeof row.account_id === "string" && row.account_id.trim() ? row.account_id.trim() : null;
  return {
    schema: NOTE_PLACE_PAYMENT_SCHEMA,
    account_id: account,
    access: isAccess(row.access) ? row.access : "free",
    plan_override: isPlan(row.plan_override) ? row.plan_override : null,
    pay_product_id:
      typeof row.pay_product_id === "string" && row.pay_product_id.trim()
        ? row.pay_product_id.trim()
        : null,
    donate: parseDonate(row.donate),
  };
}

export function parseNoteEntitlement(raw: unknown, slug: string): NotePlaceEntitlement | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const plan = isPlan(row.plan) ? row.plan : "free";
  let max = row.max_attachments_per_sheet;
  if (max === undefined || max === null) {
    max = maxAttachmentsPerSheet(plan);
  } else if (typeof max === "string") {
    max = max === "unlimited" ? null : Number(max);
  }
  const parsedMax = max === null || max === undefined ? null : Number(max);
  return {
    product: "note",
    slug: typeof row.slug === "string" && row.slug ? row.slug : slug,
    plan,
    max_attachments_per_sheet: Number.isFinite(parsedMax as number) ? (parsedMax as number) : null,
    paid_unlock_required: row.paid_unlock_required === true,
  };
}

export function normalizeNotePaymentOwner(input: NotePlacePaymentOwner): NotePlacePaymentOwner {
  return parseNotePaymentOwner(input) ?? {
    schema: NOTE_PLACE_PAYMENT_SCHEMA,
    account_id: null,
    access: "free",
    plan_override: null,
    pay_product_id: null,
    donate: { visible: false },
  };
}

export function donateDestinationUrl(payment: NotePlacePaymentPublic | null | undefined): string | null {
  if (!payment?.donate.visible) return null;
  const dest = payment.donate.destination?.trim();
  return dest || null;
}

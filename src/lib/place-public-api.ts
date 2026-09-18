import { NoteApiError, isMissingPlaceError, noteApiJson, noteResourceUrl } from "@/lib/note-api";
import {
  defaultNoteEntitlement,
  defaultNotePaymentPublic,
  parseNotePaymentOwner,
  NOTE_PLACE_PAYMENT_SCHEMA,
  type NotePlaceEntitlement,
  type NotePlacePaymentOwner,
  type NotePlacePaymentPublic,
} from "@/lib/note-payment";
import {
  DEFAULT_NOTE_PLACE_SETTINGS,
  NOTE_PLACE_SETTINGS_SCHEMA,
  normalizeNotePlaceSettings,
  parseNotePlaceSettings,
  type NotePlaceSettings,
} from "@/lib/note-place-settings";
import { signPlaceDocument } from "@/lib/place-meta-sign";
import type { NoteSession } from "@/lib/note-protocol";

function settingsDocument(settings: NotePlaceSettings): Record<string, unknown> {
  const next = normalizeNotePlaceSettings(settings);
  return {
    schema: next.schema,
    preset: next.preset,
    ...(next.background ? { background: next.background } : {}),
    ...(next.text ? { text: next.text } : {}),
    font: next.font,
    font_family: next.font_family,
    font_size: next.font_size,
    line_height: next.line_height,
    letter_spacing: next.letter_spacing,
    paragraph_spacing: next.paragraph_spacing,
    view_width: next.view_width,
  };
}

export async function getPlaceSettings(slug: string): Promise<NotePlaceSettings> {
  try {
    const row = await noteApiJson<unknown>("GET", noteResourceUrl(slug, "settings"));
    return parseNotePlaceSettings(row) ?? DEFAULT_NOTE_PLACE_SETTINGS;
  } catch (error) {
    if (error instanceof NoteApiError && (error.status === 404 || isMissingPlaceError(error))) {
      return DEFAULT_NOTE_PLACE_SETTINGS;
    }
    throw error;
  }
}

export async function putPlaceSettings(args: {
  slug: string;
  settings: NotePlaceSettings;
  session: NoteSession;
}): Promise<NotePlaceSettings> {
  const document = settingsDocument(args.settings);
  const signed = await signPlaceDocument({
    session: args.session,
    slug: args.slug,
    purpose: NOTE_PLACE_SETTINGS_SCHEMA,
    document,
  });
  const row = await noteApiJson<unknown>("PUT", noteResourceUrl(args.slug, "settings"), {
    ...document,
    ...signed,
  });
  return parseNotePlaceSettings(row) ?? normalizeNotePlaceSettings(args.settings);
}

/** v1 Gate has no /payment. Free access until /v1/pay ships. */
export async function getPlacePayment(slug: string): Promise<NotePlacePaymentPublic> {
  return defaultNotePaymentPublic(slug);
}

/** Local-only until place payment is a Gate route. */
export async function putPlacePayment(args: {
  slug: string;
  payment: NotePlacePaymentOwner;
  session: NoteSession;
}): Promise<NotePlacePaymentPublic> {
  return {
    ...defaultNotePaymentPublic(args.slug),
    access: args.payment.access,
    donate: args.payment.donate,
  };
}

/** v1 Gate has no /entitlement. Every place is free. */
export async function getPlaceEntitlement(slug: string): Promise<NotePlaceEntitlement> {
  return defaultNoteEntitlement(slug);
}

export function paymentOwnerFromPublic(
  payment: NotePlacePaymentPublic,
  extras?: Partial<NotePlacePaymentOwner>,
): NotePlacePaymentOwner {
  return {
    schema: NOTE_PLACE_PAYMENT_SCHEMA,
    account_id: extras?.account_id ?? null,
    access: extras?.access ?? payment.access,
    plan_override: extras?.plan_override ?? null,
    pay_product_id: extras?.pay_product_id ?? null,
    donate: extras?.donate ?? payment.donate,
  };
}

export { parseNotePaymentOwner };

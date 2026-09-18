import { getKodamaAccountToken } from "@/lib/kodama-account-session";
import { NoteApiError, isMissingPlaceError, noteApiJson, noteResourceUrl } from "@/lib/note-api";
import {
  defaultNoteEntitlement,
  defaultNotePaymentPublic,
  normalizeNotePaymentOwner,
  parseNoteEntitlement,
  parseNotePaymentOwner,
  parseNotePaymentPublic,
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

function ownerAuth(): { authorization?: string } {
  const token = getKodamaAccountToken();
  return token ? { authorization: `Bearer ${token}` } : {};
}

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

function paymentDocument(input: NotePlacePaymentOwner): Record<string, unknown> {
  const next = normalizeNotePaymentOwner(input);
  return {
    schema: next.schema,
    account_id: next.account_id,
    access: next.access,
    plan_override: next.plan_override,
    pay_product_id: next.pay_product_id,
    donate: {
      visible: next.donate.visible,
      ...(next.donate.destination ? { destination: next.donate.destination } : {}),
    },
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

export async function getPlacePayment(slug: string): Promise<NotePlacePaymentPublic> {
  try {
    const row = await noteApiJson<unknown>("GET", noteResourceUrl(slug, "payment"));
    return parseNotePaymentPublic(row, slug) ?? defaultNotePaymentPublic(slug);
  } catch (error) {
    if (error instanceof NoteApiError && error.status === 404) {
      return defaultNotePaymentPublic(slug);
    }
    throw error;
  }
}

export async function putPlacePayment(args: {
  slug: string;
  payment: NotePlacePaymentOwner;
  session: NoteSession;
}): Promise<NotePlacePaymentPublic> {
  const document = paymentDocument(args.payment);
  const signed = await signPlaceDocument({
    session: args.session,
    slug: args.slug,
    purpose: NOTE_PLACE_PAYMENT_SCHEMA,
    document,
  });
  const row = await noteApiJson<unknown>(
    "PUT",
    noteResourceUrl(args.slug, "payment"),
    { ...document, ...signed },
    ownerAuth(),
  );
  return parseNotePaymentPublic(row, args.slug) ?? defaultNotePaymentPublic(args.slug);
}

export async function getPlaceEntitlement(slug: string): Promise<NotePlaceEntitlement> {
  try {
    const row = await noteApiJson<unknown>("GET", noteResourceUrl(slug, "entitlement"));
    return parseNoteEntitlement(row, slug) ?? defaultNoteEntitlement(slug);
  } catch (error) {
    if (error instanceof NoteApiError && error.status === 404) {
      return defaultNoteEntitlement(slug);
    }
    throw error;
  }
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

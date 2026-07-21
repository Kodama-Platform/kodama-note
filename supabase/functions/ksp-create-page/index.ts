import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { verifyCreatePlaceBundlePayload } from "@kodama.page/ksp-core";
import { handleCors, jsonResponse } from "../_shared/cors.ts";
import {
  isKspPlaceMeta,
  parseKspWire,
  wireItemsToBundle,
  type KspPlaceMeta,
} from "../_shared/ksp-wire.ts";
import { createServiceClient } from "../_shared/supabase-admin.ts";

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== "POST") {
    return jsonResponse({ error: "method not allowed" }, 405);
  }

  try {
    const body = await req.json();
    const slug = body?.slug as string | undefined;
    const ciphertext = body?.ciphertext as string | undefined;
    const salt = body?.salt as string | undefined;
    const iv = body?.iv as string | undefined;
    const kdf_params = body?.kdf_params as unknown;
    const burn_mode = (body?.burn_mode as string | undefined) ?? "never";

    if (!slug || !ciphertext || !salt || !iv || !kdf_params) {
      return jsonResponse({ error: "missing required fields" }, 400);
    }

    if (!isKspPlaceMeta(kdf_params)) {
      return jsonResponse({ error: "kdf_params must be ksp-v1 metadata" }, 400);
    }

    const wire = parseKspWire(ciphertext);
    if (!wire || wire.storage_mode !== "bundle" || !wire.bundle) {
      return jsonResponse({ error: "invalid ksp wire payload" }, 400);
    }

    if (wire.version !== 1 || wire.edit) {
      return jsonResponse({ error: "create payload must be version 1 without edit block" }, 400);
    }

    const meta = kdf_params as KspPlaceMeta;
    const ok = await verifyCreatePlaceBundlePayload(
      {
        slug,
        product_type: meta.product_type,
        version: 1,
        kdf: meta.kdf,
        salt,
        owner_public_key: meta.owner_public_key,
        editor_public_keys: meta.editor_public_keys,
        owner_signature: meta.owner_signature,
        storage_mode: "bundle",
        notes: wire.bundle.notes.map((n) => ({ id: n.id, iv: n.iv })),
        attachments: wire.bundle.attachments.map((a) => ({ id: a.id, iv: a.iv })),
      },
      wireItemsToBundle(wire.bundle),
    );

    if (!ok) {
      return jsonResponse({ error: "invalid create signature" }, 403);
    }

    const supabase = createServiceClient();
    const { data, error } = await supabase.rpc("kodama_create_page", {
      p_slug: slug,
      p_ciphertext: ciphertext,
      p_salt: salt,
      p_iv: iv,
      p_kdf_params: kdf_params,
      p_burn_mode: burn_mode,
    });

    if (error) {
      if (error.code === "23505" || /duplicate|unique/i.test(error.message)) {
        return jsonResponse({ ok: false, reason: "slug_taken" }, 409);
      }
      return jsonResponse({ error: error.message }, 400);
    }

    const row = data as { expires_at: string | null };
    return jsonResponse({ ok: true, expires_at: row.expires_at });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});

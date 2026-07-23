import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { createServiceClient } from "../_shared/supabase-admin.ts";
import { verifyKspCreateWirePayload } from "../_shared/verify-create-wire.ts";

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== "POST") {
    return jsonResponse({ error: "method not allowed" }, 405);
  }

  try {
    const body = await req.json();
    const slug = body?.slug as string | undefined;
    const edit_token = body?.edit_token as string | undefined;
    const ciphertext = body?.ciphertext as string | undefined;
    const salt = body?.salt as string | undefined;
    const iv = body?.iv as string | undefined;
    const kdf_params = body?.kdf_params as unknown;

    if (!slug || !edit_token || !ciphertext || !salt || !iv || !kdf_params) {
      return jsonResponse({ error: "missing required fields" }, 400);
    }

    const verified = await verifyKspCreateWirePayload({ slug, ciphertext, salt, kdf_params });
    if (!verified.ok) {
      return jsonResponse({ error: verified.error }, verified.status);
    }

    const supabase = createServiceClient();
    const { data, error } = await supabase.rpc("kodama_migrate_page_to_ksp", {
      p_slug: slug,
      p_edit_token: edit_token,
      p_ciphertext: ciphertext,
      p_salt: salt,
      p_iv: iv,
      p_kdf_params: kdf_params,
    });

    if (error) {
      return jsonResponse({ error: error.message }, 400);
    }

    return jsonResponse({ ok: true, ...(data as Record<string, unknown>) });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});

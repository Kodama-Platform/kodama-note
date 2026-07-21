import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { verifyEditBundlePayload } from "@kodama.page/ksp-core";
import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { parseKspWire, wireItemsToBundle, type KspPlaceMeta } from "../_shared/ksp-wire.ts";
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
    const iv = body?.iv as string | undefined;

    if (!slug || !ciphertext || !iv) {
      return jsonResponse({ error: "missing slug, ciphertext, or iv" }, 400);
    }

    const wire = parseKspWire(ciphertext);
    if (!wire || wire.storage_mode !== "bundle" || !wire.bundle || !wire.edit) {
      return jsonResponse({ error: "invalid ksp wire payload" }, 400);
    }

    const supabase = createServiceClient();
    const { data: page, error: pageError } = await supabase
      .from("pages")
      .select("id, slug, kdf_params, burned")
      .eq("slug", slug)
      .maybeSingle();

    if (pageError) {
      return jsonResponse({ error: pageError.message }, 500);
    }
    if (!page || page.burned) {
      return jsonResponse({ error: "page not found" }, 404);
    }

    const meta = page.kdf_params as KspPlaceMeta;
    if (meta?.protocol !== "ksp-v1") {
      return jsonResponse({ error: "not a ksp place" }, 400);
    }

    const currentVersion = meta.version ?? 1;
    const ok = await verifyEditBundlePayload(
      {
        slug,
        old_version: wire.edit.old_version,
        new_version: wire.edit.new_version,
        editor_public_key: wire.edit.editor_public_key,
        signature: wire.edit.signature,
        notes: wire.bundle.notes.map((n) => ({ id: n.id, iv: n.iv })),
        attachments: wire.bundle.attachments.map((a) => ({ id: a.id, iv: a.iv })),
        storage_mode: "bundle",
      },
      wireItemsToBundle(wire.bundle),
      meta.editor_public_keys ?? [],
      currentVersion,
    );

    if (!ok) {
      return jsonResponse({ error: "invalid edit signature" }, 403);
    }

    const { data, error } = await supabase.rpc("kodama_ksp_append_version", {
      p_slug: slug,
      p_ciphertext: ciphertext,
      p_iv: iv,
    });

    if (error) {
      return jsonResponse({ error: error.message }, 400);
    }

    return jsonResponse(data);
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});

-- KSP write authorization: cryptographic edits verified by version monotonicity in wire payload.
-- Replaces edit_token gate for places where kdf_params.protocol = 'ksp-v1'.
-- Signature verification is performed client-side on read; server enforces version chain.

create or replace function public.kodama_ksp_append_version(
  p_slug text,
  p_ciphertext text,
  p_iv text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_page pages%rowtype;
  v_wire jsonb;
  v_old_version int;
  v_new_version int;
begin
  select * into v_page from pages where slug = p_slug and not burned for update;
  if not found then
    raise exception 'page not found';
  end if;

  if coalesce(v_page.kdf_params->>'protocol', '') <> 'ksp-v1' then
    raise exception 'not a ksp place';
  end if;

  begin
    v_wire := p_ciphertext::jsonb;
  exception when others then
    raise exception 'invalid ksp wire payload';
  end;

  if v_wire->>'format' is distinct from 'ksp-v1' then
    raise exception 'invalid ksp wire format';
  end if;

  v_new_version := (v_wire->>'version')::int;
  v_old_version := coalesce((v_page.kdf_params->>'version')::int, 1);

  if v_wire->'edit' is null then
    raise exception 'missing edit signature block';
  end if;

  if (v_wire->'edit'->>'old_version')::int <> v_old_version then
    raise exception 'version mismatch';
  end if;

  if (v_wire->'edit'->>'new_version')::int <> v_new_version then
    raise exception 'invalid new version';
  end if;

  if v_new_version <> v_old_version + 1 then
    raise exception 'version must increment by 1';
  end if;

  insert into page_versions (page_id, ciphertext, iv)
  values (v_page.id, p_ciphertext, p_iv);

  update pages
  set
    ciphertext = p_ciphertext,
    iv = p_iv,
    kdf_params = jsonb_set(v_page.kdf_params, '{version}', to_jsonb(v_new_version)),
    updated_at = now()
  where id = v_page.id;

  return json_build_object(
    'id', v_page.id,
    'created_at', now(),
    'version', v_new_version
  );
end;
$$;

create or replace function public.kodama_ksp_register_attachment(
  p_slug text,
  p_storage_path text,
  p_iv text,
  p_filename_ciphertext text,
  p_filename_iv text,
  p_mime text,
  p_size int
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_page pages%rowtype;
  v_id uuid;
begin
  select * into v_page from pages where slug = p_slug and not burned;
  if not found then
    raise exception 'page not found';
  end if;

  if coalesce(v_page.kdf_params->>'protocol', '') <> 'ksp-v1' then
    raise exception 'not a ksp place';
  end if;

  insert into page_attachments (
    page_id, storage_path, iv, filename_ciphertext, filename_iv, mime, size
  )
  values (
    v_page.id, p_storage_path, p_iv, p_filename_ciphertext, p_filename_iv, p_mime, p_size
  )
  returning id into v_id;

  return json_build_object('id', v_id, 'created_at', now());
end;
$$;

create or replace function public.kodama_ksp_delete_attachment(
  p_slug text,
  p_attachment_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_page pages%rowtype;
begin
  select * into v_page from pages where slug = p_slug and not burned;
  if not found then
    raise exception 'page not found';
  end if;

  if coalesce(v_page.kdf_params->>'protocol', '') <> 'ksp-v1' then
    raise exception 'not a ksp place';
  end if;

  delete from page_attachments
  where id = p_attachment_id and page_id = v_page.id;

  if not found then
    raise exception 'attachment not found';
  end if;
end;
$$;

create or replace function public.kodama_ksp_update_expiry(
  p_slug text,
  p_burn_mode text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_page pages%rowtype;
  v_expires timestamptz;
begin
  select * into v_page from pages where slug = p_slug and not burned for update;
  if not found then
    raise exception 'page not found';
  end if;

  if coalesce(v_page.kdf_params->>'protocol', '') <> 'ksp-v1' then
    raise exception 'not a ksp place';
  end if;

  v_expires := case p_burn_mode
    when '1h' then now() + interval '1 hour'
    when '24h' then now() + interval '24 hours'
    when '7d' then now() + interval '7 days'
    when 'after_read' then null
    else null
  end;

  update pages
  set burn_mode = p_burn_mode, expires_at = v_expires, updated_at = now()
  where id = v_page.id;

  return json_build_object('burn_mode', p_burn_mode, 'expires_at', v_expires);
end;
$$;

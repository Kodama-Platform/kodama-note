-- One-time legacy → KSP place migration.
-- Replaces ciphertext/salt/iv/full kdf_params after edge verifies create signature.
-- Authorized by legacy edit_token; callable only via service_role (edge function).

create or replace function public.kodama_migrate_page_to_ksp(
  p_slug text,
  p_edit_token text,
  p_ciphertext text,
  p_salt text,
  p_iv text,
  p_kdf_params jsonb
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_page pages%rowtype;
begin
  select * into v_page from pages where slug = p_slug and not burned for update;
  if not found then
    raise exception 'page not found';
  end if;

  if v_page.edit_token is distinct from p_edit_token then
    raise exception 'invalid edit token';
  end if;

  if coalesce(v_page.kdf_params->>'protocol', '') = 'ksp-v1' then
    raise exception 'already a ksp place';
  end if;

  if coalesce(p_kdf_params->>'protocol', '') <> 'ksp-v1' then
    raise exception 'kdf_params must be ksp-v1 metadata';
  end if;

  if jsonb_typeof(p_kdf_params->'editor_public_keys') is distinct from 'array'
     or jsonb_array_length(p_kdf_params->'editor_public_keys') < 1 then
    raise exception 'editor_public_keys required';
  end if;

  if coalesce(p_kdf_params->>'owner_public_key', '') = '' then
    raise exception 'owner_public_key required';
  end if;

  -- Archive pre-migration ciphertext for forensics (not restored by client yet).
  insert into page_versions (page_id, ciphertext, iv)
  values (v_page.id, v_page.ciphertext, v_page.iv);

  update pages
  set
    ciphertext = p_ciphertext,
    salt = p_salt,
    iv = p_iv,
    kdf_params = p_kdf_params,
    updated_at = now()
  where id = v_page.id;

  return json_build_object(
    'id', v_page.id,
    'slug', v_page.slug,
    'created_at', now(),
    'version', coalesce((p_kdf_params->>'version')::int, 1)
  );
end;
$$;

revoke execute on function public.kodama_migrate_page_to_ksp(text, text, text, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.kodama_migrate_page_to_ksp(text, text, text, text, text, jsonb)
  to service_role;

comment on function public.kodama_migrate_page_to_ksp is
  'Legacy→KSP migrate — call only from ksp-migrate-page edge after create-signature verify.';

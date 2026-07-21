-- Restrict KSP version append RPC to service_role (edge function verifies Ed25519 first).
-- Other KSP RPCs (attachments, expiry) remain client-callable until owner/editor-signed edge functions exist.

revoke execute on function public.kodama_ksp_append_version(text, text, text) from public, anon, authenticated;
grant execute on function public.kodama_ksp_append_version(text, text, text) to service_role;

-- Reject direct KSP page inserts from anon/authenticated (edge functions use service_role).
create or replace function public.kodama_reject_ksp_direct_insert()
returns trigger
language plpgsql
as $$
declare
  v_role text;
begin
  if coalesce(new.kdf_params->>'protocol', '') <> 'ksp-v1' then
    return new;
  end if;

  v_role := coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    current_user
  );
  if v_role = 'service_role' then
    return new;
  end if;

  raise exception 'ksp places must be created via ksp-create-page edge function';
end;
$$;

drop trigger if exists reject_ksp_direct_insert on public.pages;
create trigger reject_ksp_direct_insert
  before insert on public.pages
  for each row
  execute function public.kodama_reject_ksp_direct_insert();

-- Service role bypasses RLS; edge functions use service role for kodama_create_page after verify.
comment on function public.kodama_ksp_append_version is
  'KSP version append — call only from edge functions after Ed25519 verification.';

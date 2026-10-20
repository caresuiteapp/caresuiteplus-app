-- Atomically finish a claimed OAuth state and consume it permanently. Deleting
-- pending states during disconnect serializes with this row lock, so a callback
-- cannot recreate a connection after the state has been invalidated.
create or replace function public.complete_google_workspace_connection(p_state_id uuid, p_connection jsonb)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_state public.google_workspace_oauth_states%rowtype;
  v_id uuid;
  v_role text;
begin
  select * into v_state from public.google_workspace_oauth_states where id = p_state_id for update;
  if not found or v_state.consumed_at is null or v_state.expires_at <= now() then
    raise exception 'Google authorization state is no longer valid';
  end if;
  select r.key into v_role from public.profiles p join public.roles r on r.id = p.role_id
    where p.id = v_state.initiated_by and p.tenant_id = v_state.tenant_id;
  if v_role is null or v_role not in ('business_admin','business_manager','owner','admin','system','support','developer_admin','management','office','quality_management') then
    raise exception 'Google authorization is no longer permitted';
  end if;
  if coalesce(p_connection->>'google_subject','') = '' or coalesce(p_connection->>'refresh_token_cipher','') = '' then
    raise exception 'Google account or refresh token missing';
  end if;
  insert into public.google_workspace_connections (
    tenant_id, connected_user_id, google_subject, primary_email, hosted_domain, display_name,
    connection_status, granted_scopes, access_token_cipher, refresh_token_cipher, token_expires_at,
    capabilities, connected_at, last_health_check_at, last_sync_at, revoked_at, last_error_code, last_error_message, updated_at
  ) values (
    v_state.tenant_id, v_state.initiated_by, p_connection->>'google_subject', p_connection->>'primary_email',
    p_connection->>'hosted_domain', p_connection->>'display_name', 'connected',
    array(select jsonb_array_elements_text(coalesce(p_connection->'granted_scopes','[]'::jsonb))),
    p_connection->>'access_token_cipher', p_connection->>'refresh_token_cipher', (p_connection->>'token_expires_at')::timestamptz,
    coalesce(p_connection->'capabilities','{}'::jsonb), now(), now(), null, null, null, null, now()
  ) on conflict (tenant_id) do update set
    connected_user_id = excluded.connected_user_id, google_subject = excluded.google_subject,
    primary_email = excluded.primary_email, hosted_domain = excluded.hosted_domain, display_name = excluded.display_name,
    connection_status = 'connected', granted_scopes = excluded.granted_scopes,
    access_token_cipher = excluded.access_token_cipher, refresh_token_cipher = excluded.refresh_token_cipher,
    token_expires_at = excluded.token_expires_at, capabilities = excluded.capabilities,
    connected_at = excluded.connected_at, last_health_check_at = excluded.last_health_check_at,
    last_sync_at = null, revoked_at = null, last_error_code = null, last_error_message = null, updated_at = now()
  returning id into v_id;
  delete from public.google_workspace_oauth_states where id = p_state_id;
  return v_id;
end;
$$;
revoke all on function public.complete_google_workspace_connection(uuid,jsonb) from public, anon, authenticated;
grant execute on function public.complete_google_workspace_connection(uuid,jsonb) to service_role;

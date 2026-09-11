-- Google Workspace runs through authenticated Edge Functions with a server-only
-- service_role client. RLS bypass does not replace PostgreSQL table privileges.
-- Explicit grants are required even when project default privileges omit CRUD.
-- Keep encrypted tokens and OAuth states inaccessible to browser/portal roles.

REVOKE ALL ON TABLE
  public.google_workspace_connections,
  public.google_workspace_oauth_states
FROM PUBLIC, anon, authenticated;

REVOKE ALL ON TABLE public.google_workspace_audit_events
FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.google_workspace_audit_events TO authenticated;

REVOKE ALL ON TABLE
  public.google_workspace_connections,
  public.google_workspace_oauth_states,
  public.google_workspace_audit_events
FROM service_role;

GRANT SELECT, INSERT, UPDATE ON TABLE
  public.google_workspace_connections
TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.google_workspace_oauth_states
TO service_role;

GRANT SELECT, INSERT ON TABLE
  public.google_workspace_audit_events
TO service_role;

-- Existing row-level security and the tenant/admin audit policy stay active.

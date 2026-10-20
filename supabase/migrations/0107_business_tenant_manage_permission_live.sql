-- ==========================================================================
-- CareSuite+ — Migration 0107: business.tenant.manage für Mandanten-UI
-- /settings/tenant — Frontend-Guard + RLS (0078) erwarten diese Permission
-- Pattern: 0083_owner_clients_permissions_live.sql
-- ==========================================================================

INSERT INTO public.role_permissions (role_id, permission_key)
SELECT r.id, 'business.tenant.manage'
FROM public.roles r
WHERE r.key IN (
  'business_admin',
  'owner',
  'admin',
  'management',
  'geschaeftsfuehrung'
)
ON CONFLICT (role_id, permission_key) DO NOTHING;

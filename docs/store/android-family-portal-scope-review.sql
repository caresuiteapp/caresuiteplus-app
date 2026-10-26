-- REVIEW ONLY, NOT APPLIED. Restore the actively called missing family scope
-- RPC from W-05 without activating its historical RLS/Storage migration.
-- Read-only catalog proof: android-family-portal-scope-metadata-20261026.json.
-- The RPC returns only the exact authenticated active relative account and its
-- own latest server permissions. No business rows or access grants are seeded.
BEGIN;
DO $review$
BEGIN
 IF to_regprocedure('public.current_family_portal_access_scope()') IS NOT NULL THEN
   RAISE EXCEPTION 'Family scope RPC already exists; review its source before replacing it.' USING ERRCODE='55000';
 END IF;
 IF encode(sha256(convert_to(pg_get_functiondef('public.current_portal_type()'::regprocedure),'UTF8')),'hex') IS DISTINCT FROM '0fb99f15f806cfa1e1dce0121d7e14458695a8e2fb9aefa7213868c232142dcb' THEN
   RAISE EXCEPTION 'Reviewed helper source changed: current_portal_type' USING ERRCODE='55000';
 END IF;
 IF encode(sha256(convert_to(pg_get_functiondef('public.current_portal_account_id()'::regprocedure),'UTF8')),'hex') IS DISTINCT FROM '7977fea6427a2b3d146b912cbc7d69cefc3c3b033d01cf890fbb50c918172df6' THEN
   RAISE EXCEPTION 'Reviewed helper source changed: current_portal_account_id' USING ERRCODE='55000';
 END IF;
END;
$review$;
CREATE OR REPLACE FUNCTION public.current_family_portal_access_scope()
RETURNS TABLE (
  tenant_id uuid,
  account_id uuid,
  client_id uuid,
  relative_contact_id uuid,
  valid_from text,
  expires_at text,
  can_view_appointments boolean,
  can_view_documents boolean,
  can_view_messages boolean,
  can_send_messages boolean,
  can_view_service_records boolean,
  can_view_invoices boolean,
  can_download_documents boolean,
  can_confirm_appointments boolean,
  can_sign_records boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT rpc.tenant_id, rpc.id, rpc.client_id, rpc.relative_contact_id,
         to_char(rpc.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
         CASE WHEN rpc.expires_at IS NULL THEN NULL
              ELSE to_char(rpc.expires_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
         END,
         pap.can_view_appointments, pap.can_view_documents,
         pap.can_view_messages, pap.can_send_messages,
         pap.can_view_service_records, pap.can_view_invoices,
         pap.can_download_documents, pap.can_confirm_appointments,
         pap.can_sign_records
  FROM public.relative_portal_codes rpc
  JOIN LATERAL (
    SELECT p.*
    FROM public.portal_access_permissions p
    WHERE p.tenant_id = rpc.tenant_id
      AND p.portal_type = 'relative'
      AND p.portal_account_id = rpc.id
    ORDER BY p.updated_at DESC, p.id DESC
    LIMIT 1
  ) pap ON true
  WHERE (auth.jwt()->'app_metadata'->>'portal_type') = 'relative'
    AND rpc.id = public.current_portal_account_id()
    AND rpc.auth_user_id = auth.uid()
    AND rpc.tenant_id = public.current_tenant_id()
    AND rpc.status = 'active'
    AND rpc.created_at <= CURRENT_TIMESTAMP
    AND (rpc.expires_at IS NULL OR rpc.expires_at > CURRENT_TIMESTAMP)
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.current_family_portal_access_scope() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_family_portal_access_scope() TO authenticated;

COMMENT ON FUNCTION public.current_family_portal_access_scope() IS 'Active exact authenticated relative account, tenant, contact and current capability scope; no W-05 bulk activation.';
COMMIT;

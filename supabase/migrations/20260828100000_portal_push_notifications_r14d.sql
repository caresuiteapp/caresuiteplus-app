-- CareSuite HealthOS R14-D — native portal push devices and auditable delivery.

CREATE TABLE IF NOT EXISTS public.portal_push_devices (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  auth_user_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  portal_account_id   UUID        NOT NULL,
  portal_type         TEXT        NOT NULL CHECK (portal_type IN ('employee', 'client', 'relative')),
  employee_id         UUID        REFERENCES public.employees(id) ON DELETE CASCADE,
  client_id           UUID        REFERENCES public.clients(id) ON DELETE CASCADE,
  expo_push_token     TEXT        NOT NULL UNIQUE,
  platform            TEXT        NOT NULL CHECK (platform IN ('android', 'ios')),
  app_version         TEXT,
  permission_status   TEXT        NOT NULL DEFAULT 'granted'
                                  CHECK (permission_status IN ('granted', 'denied', 'undetermined')),
  enabled             BOOLEAN     NOT NULL DEFAULT TRUE,
  last_registered_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  invalidated_at      TIMESTAMPTZ,
  last_error          TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT portal_push_devices_actor_link CHECK (
    (portal_type = 'employee' AND employee_id IS NOT NULL AND client_id IS NULL)
    OR (portal_type IN ('client', 'relative') AND client_id IS NOT NULL AND employee_id IS NULL)
  )
);

DROP TRIGGER IF EXISTS set_portal_push_devices_updated_at ON public.portal_push_devices;
CREATE TRIGGER set_portal_push_devices_updated_at
  BEFORE UPDATE ON public.portal_push_devices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_portal_push_devices_recipient
  ON public.portal_push_devices (tenant_id, auth_user_id)
  WHERE enabled = TRUE;

CREATE INDEX IF NOT EXISTS idx_portal_push_devices_employee
  ON public.portal_push_devices (tenant_id, employee_id)
  WHERE enabled = TRUE AND employee_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_portal_push_devices_client
  ON public.portal_push_devices (tenant_id, client_id)
  WHERE enabled = TRUE AND client_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.office_push_deliveries (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  broadcast_id        UUID        NOT NULL REFERENCES public.notification_broadcasts(id) ON DELETE CASCADE,
  device_id           UUID        NOT NULL REFERENCES public.portal_push_devices(id) ON DELETE CASCADE,
  auth_user_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requested_by_user_id UUID       NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  expo_ticket_id      TEXT,
  ticket_status       TEXT        NOT NULL CHECK (ticket_status IN ('ok', 'error')),
  receipt_status      TEXT        CHECK (receipt_status IN ('ok', 'error')),
  error_code          TEXT,
  error_message       TEXT,
  sent_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  receipt_checked_at  TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (broadcast_id, device_id)
);

DROP TRIGGER IF EXISTS set_office_push_deliveries_updated_at ON public.office_push_deliveries;
CREATE TRIGGER set_office_push_deliveries_updated_at
  BEFORE UPDATE ON public.office_push_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_office_push_deliveries_broadcast
  ON public.office_push_deliveries (tenant_id, broadcast_id, ticket_status);

CREATE INDEX IF NOT EXISTS idx_office_push_deliveries_receipts
  ON public.office_push_deliveries (sent_at)
  WHERE expo_ticket_id IS NOT NULL AND receipt_checked_at IS NULL;

ALTER TABLE public.portal_push_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.office_push_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS portal_push_devices_own_select ON public.portal_push_devices;
CREATE POLICY portal_push_devices_own_select ON public.portal_push_devices
  FOR SELECT TO authenticated
  USING (
    auth_user_id = auth.uid()
    AND tenant_id = public.current_tenant_id()
  );

DROP POLICY IF EXISTS portal_push_devices_office_select ON public.portal_push_devices;
CREATE POLICY portal_push_devices_office_select ON public.portal_push_devices
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.has_permission('messages.broadcast.create')
  );

DROP POLICY IF EXISTS office_push_deliveries_office_select ON public.office_push_deliveries;
CREATE POLICY office_push_deliveries_office_select ON public.office_push_deliveries
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.has_permission('messages.broadcast.create')
  );

GRANT SELECT ON public.portal_push_devices TO authenticated;
GRANT SELECT ON public.office_push_deliveries TO authenticated;

COMMENT ON TABLE public.portal_push_devices IS
  'Native Expo push tokens for authenticated employee/client portal installations. Writes are service-only through Edge Functions.';
COMMENT ON TABLE public.office_push_deliveries IS
  'Auditable Expo push tickets and receipts for Office broadcasts; notification contents remain in CareSuite.';

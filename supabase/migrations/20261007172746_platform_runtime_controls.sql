SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';

-- Preserve both existing operational switches. Only add the absent, empty notice.
INSERT INTO public.platform_system_settings (setting_key,value,description)
VALUES ('platform_notice','""'::jsonb,'Öffentlicher Hinweis auf Website und Websoftware; leer bedeutet ausgeblendet')
ON CONFLICT (setting_key) DO NOTHING;

ALTER TABLE public.platform_system_settings ADD CONSTRAINT platform_runtime_setting_types CHECK (
  CASE WHEN setting_key IN ('maintenance_mode','allow_new_tenant_signup','registration_enabled')
    THEN jsonb_typeof(value)='boolean'
  WHEN setting_key='platform_notice'
    THEN jsonb_typeof(value)='string' AND char_length(value#>>'{}')<=2000
  ELSE true END
);

-- Only the service can read this fixed projection. No new table/column access,
-- secret configuration, company data or personal identity is exposed.
CREATE OR REPLACE FUNCTION public.platform_get_runtime_settings()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF current_setting('role',true) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'platform_forbidden' USING ERRCODE='42501';
  END IF;
  RETURN jsonb_build_object(
    'release','caresuite-platform-runtime-controls-20261007',
    'maintenanceMode',coalesce((SELECT value='true'::jsonb FROM public.platform_system_settings WHERE setting_key='maintenance_mode'),false),
    'registrationEnabled',coalesce(
      (SELECT value='true'::jsonb FROM public.platform_system_settings WHERE setting_key='allow_new_tenant_signup'),
      (SELECT value='true'::jsonb FROM public.platform_system_settings WHERE setting_key='registration_enabled'),true),
    'notice',coalesce((SELECT value#>>'{}' FROM public.platform_system_settings WHERE setting_key='platform_notice'),'')
  );
END;
$$;
REVOKE ALL ON FUNCTION public.platform_get_runtime_settings() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.platform_get_runtime_settings() TO service_role;
NOTIFY pgrst,'reload schema';

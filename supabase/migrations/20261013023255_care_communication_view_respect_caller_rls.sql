BEGIN;
ALTER VIEW public.v_communication_provider_configs_safe SET (security_invoker=true);
COMMIT;

-- The server collector needs only verified identifiers and access state.
-- No contact data, platform roles or customer record content is exposed.
GRANT SELECT (user_id,status) ON public.platform_users TO service_role;
GRANT SELECT (tenant_id,status) ON public.platform_tenants TO service_role;

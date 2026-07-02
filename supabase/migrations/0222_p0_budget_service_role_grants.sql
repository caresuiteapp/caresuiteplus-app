-- P0.1 — service_role grants for audit bootstrap + SECURITY DEFINER budget paths.
-- Root cause: 0175 grants authenticated only; 0215 added SELECT-only for service_role.
-- Scope: minimal table grants for bootstrap scripts (service_role bypasses RLS).

DO $$
BEGIN
  IF to_regclass('public.client_budget_accounts') IS NOT NULL THEN
    GRANT SELECT, INSERT, UPDATE ON public.client_budget_accounts TO service_role;
  END IF;

  IF to_regclass('public.client_budget_transactions') IS NOT NULL THEN
    GRANT SELECT, INSERT, UPDATE ON public.client_budget_transactions TO service_role;
  END IF;
END $$;

-- Idempotent: 0221 already defines RPC + authenticated EXECUTE; re-assert for drift safety.
DO $$
BEGIN
  IF to_regprocedure('public.mark_assist_visit_budget_executed(uuid,uuid,uuid)') IS NOT NULL THEN
    GRANT EXECUTE ON FUNCTION public.mark_assist_visit_budget_executed(UUID, UUID, UUID) TO authenticated;
  END IF;
END $$;

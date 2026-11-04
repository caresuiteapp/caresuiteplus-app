-- The authenticated Edge handler records an immutable upload receipt with
-- INSERT ... ON CONFLICT (id) DO NOTHING. BYPASSRLS alone does not grant table
-- access: this operation needs SELECT and INSERT for its conflict target.
-- Preserve all client grants and RLS policies; no UPDATE/DELETE grant is needed.
BEGIN;
GRANT SELECT, INSERT ON TABLE public.document_render_jobs TO service_role;
COMMIT;

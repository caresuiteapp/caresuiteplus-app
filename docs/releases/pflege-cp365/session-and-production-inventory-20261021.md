# Pflege CP365: session checks and production inventory

21 October 2026. Five isolated database checks passed against care_private.require_workspace_session in staging: matching profile/tenant with unexpired synthetic JWT claims and a matching auth.sessions row; rejection of foreign tenant; rejection of foreign profile; rejection of expired JWT claims; rejection of expired auth.sessions.not_after. The transaction deliberately rolled back its synthetic tenant, auth user and session. A separate query confirmed zero residual tenants from these tests.

These are SQL-level guard checks with synthetic claims, not an Auth-server login, browser test, full RLS test or proof of the complete clinical visit workflow. The larger six-case authenticated visit-context test returned connector error Invalid or expired requestState and remains unproven. No production records or privileges were changed.

The 132 RPC names previously recorded as absent were rechecked against the production public pg_proc catalog: all remain absent. This checks names only, not signatures or dynamic RPC completeness.

The prepared visit execution patch now uses the same optional admission-field lookup as the applied staging correction. Tenant/client/date matching and the exactly-one admission and care-plan checks remain unchanged. No public/private grants were widened.

Production deployment and global Pflege activation remain outstanding. The PR is currently a draft and GitHub reports it is not mergeable; it requires a fresh main integration and release checks after the database work.

# Pflege CP365: Staging source repair, 21 October 2026

Applied staging migration 20261021030640 (pflege_visit_sources_native_admission_compatibility). Production unchanged.

The native care_tour_stops row has no admission_id. The existing optional binding now reads the optional JSON field instead of dereferencing a missing composite attribute. If the native field exists it must match the selected admission; otherwise exactly one admission for the same tenant/client/tour date is still required. The existing unique care-plan requirement remains. This does not add an admission binding to historical native rows.

Verified in staging: obsolete attribute references absent; both uniqueness guards present; anon and authenticated cannot execute the private helper directly; ACL unchanged; the corrected admission SQL executes against the native row type. care_plans.status is text in current staging, not an enum. No patient data or production schema changed. No complete positive role/session/record workflow has been established by these checks.

Outstanding: positive and negative authenticated end-to-end tests, current production RPC inventory and reviewed migrations, Office intake contract compatibility, final production release. The successful Web build 518db0f6 is not a clinical approval.

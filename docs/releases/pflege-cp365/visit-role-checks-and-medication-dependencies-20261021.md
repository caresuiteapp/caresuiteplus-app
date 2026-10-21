# Pflege database release verification, 21 October 2026

## Passed live in staging

The visit-context RPC returned the matching tenant, stop and at least four source originals under SET LOCAL ROLE authenticated. The five independent rollback scripts also load the valid context before verifying rejection of: a foreign tenant; a foreign actor; expired JWT claims; an expired auth.sessions row; withdrawal of the actor's role. Each script asserts its synthetic tenant and auth user were rolled back. A separate query found zero tenants named CP365 isolated visit test. The initial fixture was corrected to provide the required care_admissions.created_by. The larger combined script hit Invalid or expired requestState; the smaller independent scripts completed successfully.

Scope: database-role/RPC checks with synthetic JWT claims and sessions, not HTTP authentication, browser/UI verification, clinical writes, parallel requests, idempotent recovery or professional approval. No production schema, grants or records changed.

## Medication packet dependency blockers

The prepared ambulatory_medication_safety_packet.sql references twelve columns absent in current staging: medications.status, active_ingredient, strength, form, route, prescribed_by, start_date, end_date, indication, is_prn; medication_administrations.occurred_at and creation_payload. Native administrations instead have administered_at and no structured creation_payload. Native medications contain only the base identity/name/dosage/frequency/active/time fields. No values or clinical provenance were invented to populate these gaps.

Additional review findings before installation: medication_json_fingerprint uses unqualified digest under an empty search_path; pagination uses an unassigned record and min(uuid); packet authorization lacks the shared expiry/profile-status check; SQL NULL handling in packet validation needs review. The packet has not been installed or publicly enabled by this verification.

The read-only preflight query and six passed SQL scripts are committed here. Production still lacks the previously inventoried 132 RPC names. Next work is the native medication foundation and server validation, then isolated write/retry/parallel tests; other missing packages and Office intake compatibility remain release requirements.

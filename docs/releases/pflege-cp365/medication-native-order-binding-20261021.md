# Native medication order binding — staging, 2026-10-21

Confirmed safety packets previously bound the current source fingerprint but could still carry different client-supplied order facts. The validator now compares all 16 order properties with a strict projection of the current database row. Only open reconciliation/order-capture proposals with an unresolved/rejected decision may retain candidate facts independently.

## Implementation

- Six nullable, default-free fields on medications: prescribed_dose, dose_unit, minimum_interval_minutes, maximum_dose, maximum_dose_unit, maximum_period_hours. No data backfill or free-text parsing. Native strings preserve exact decimal representations.
- Private medication_native_order validates required source values, positive structured decimals, dates and PRN limits, and returns the canonical packet order. A matching order is an integrity check, not evidence of medical approval.
- Existing table-level UPDATE privileges would include the new fields. A SECURITY INVOKER trigger therefore rejects direct application-role changes to those fields, including clearing and insert claims. Existing legacy-field updates remain subject to their existing policies. Only postgres/service_role contexts can populate structured facts; no new server writer or application grant is introduced. Existing privileged RPCs still require separate review before future activation.
- Native changes invalidate old captured source snapshots. Existing exact request replay remains a historical receipt, not a new clinical write.
- PRN execution, witnesses, order-status authorizations and corrections remain blocked by the previous validator. Source-document verification and a trusted, permission-bound ingestion/approval writer remain outstanding. This change does not activate Pflege.

## Staging migrations

Applied only to shwpweerzsfkqaivmaoc:
- 20261021210520_pflege_medication_native_order_binding_quarantined.sql
- 20261021210737_pflege_medication_structured_order_client_guard.sql

## Verification

- Native-order SQL suite: 35 assertions passed, including changes to all 16 packet order fields, all 16 missing native fields, unknown structured dose rejection, unresolved open candidate retention and completion denial.
- Existing strict validator and write/receipt suites passed with explicit structured synthetic native facts. Added rejection of forged packet dose and stale source after an intervening native dose change. Revision/replay/immutability tests remain intact.
- Authenticated SQL-role guard test passed: a legacy dosage update reached the synthetic row; all six direct new-field changes, clearing a populated dose and direct structured insertion were denied by the exact new trigger error. No policy was relaxed. The initial fixture lacked Office row permissions and was corrected to test the reachable policy path.
- All synthetic tenant/user/clinical records are rolled back; fixture cleanup is asserted.
- 73 existing medication and locked-deployment Node checks passed. git diff --check passed.
- Helper and safety-writer EXECUTE remain denied to authenticated. Security advisors reported no findings naming the two new functions; existing unrelated project findings are not represented as a clean project-wide audit.

These are privileged and synthetic authenticated SQL tests, not an Auth-server login, browser test, complete ingestion workflow or medical approval. No production database migration or application activation occurred.

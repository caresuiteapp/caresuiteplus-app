# Medication write validation — staging, 2026-10-21

Implemented strict server-side packet validation and quarantined commit/confirmation functions. Applied only to staging `shwpweerzsfkqaivmaoc`. Application EXECUTE remains revoked for anon and authenticated on both private functions and public wrappers; production and release locks are unchanged.

## Changes

- Exact required keys and explicit rejection of SQL NULL, missing values, invalid identities, timestamps, decimal strings, source snapshots and source revisions.
- Actual administrations require an existing matching native administration (tenant/client/medication, performer, actual occurrence, structured dose, route and unit). The safety packet does not execute a native administration.
- Effect observations must follow a referenced actual administration. Unsupported external approvals, witnesses, order status changes and corrections are rejected, including claims hidden in unrelated packet sections.
- PRN entries remain blocked because the current authoritative source contract lacks structured, confirmed limits. Client-supplied limits are not accepted as authority.
- Stock receipts require an actual prior balance, with initial balance zero; consumption/preparation recomputes the balance in the same unit. Unknown prior balances are not invented.
- Fixed ambiguous request_id lookup, exact request replay identity, revision CAS, event-kind continuity and append-only event/receipt guards.
- Historical receipts now include only history through their own revision, so later revisions do not mutate an earlier receipt. New event times use clock_timestamp rather than transaction-start timestamps.
- Prepared packet SQL also remains quarantined; activation requires a separate change.

## Applied migrations

- 20261021172414_pflege_medication_strict_validator_quarantined.sql
- 20261021172429_pflege_medication_write_receipts_quarantined.sql
- 20261021172535_pflege_medication_append_only_guards.sql
- 20261021172626_pflege_medication_stable_receipt_history.sql

## Verification

- 68 existing medication lifecycle Node tests passed.
- `pflege_medication_strict_validator_staging.sql` passed: valid reconciliation, every missing top-level/nested key, unsupported/unproven clinical actions, hidden stock/approval claims, valid initial receipt and consumption, invented prior balance, arithmetic error, valid effect observation and observation preceding actual administration.
- `pflege_medication_write_receipts_staging.sql` passed: synthetic current session and active Pflege assignment; create, identical replay, confirmation, conflicting replay rejection, kind-change rejection, valid append, stale CAS rejection, stable old receipt after append, event/receipt update denial, delete-trigger catalog verification, exact event/receipt counts, and replay after permission withdrawal denied. All fixture data rolls back and tenant/auth-user cleanup is asserted.
- ACL query confirmed anon/authenticated cannot execute the validator, commit or confirmation functions/wrappers.
- `git diff --check` passed.

These are privileged SQL tests using synthetic JWT claims, not an Auth HTTP login or browser end-to-end test. Delete protection was verified through enabled trigger event flags; no destructive deletion test was issued. Simultaneous multi-connection race tests and positive native-administration fixture coverage remain outstanding. Structured authoritative prescription limits, clinical approval evidence, complete medication order-field binding, native writer integration and application/browser verification remain release blockers. This work does not grant clinical approval or establish production readiness.

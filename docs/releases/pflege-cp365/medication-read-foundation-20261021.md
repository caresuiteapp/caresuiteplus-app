# CP365 medication read foundation: staging only

Applied staging migrations: 20261021151201 adds nullable native prerequisites; 20261021151216 installs eight read-support functions with all application EXECUTE privileges revoked; 20261021151603 binds the actor and client to the shared session guard and the current native care assignment. No production changes.

Ten medication fields and the two missing administration fields were added without default values, backfill, conversion of active flags, or derivation of actual event times. Existing native writers, triggers, constraints and records were not replaced. Unknown status, PRN applicability, administration event time and structured dose unit stay unknown. The old native medication migration's blanket active defaults were deliberately not replayed.

The prepared packet SQL now qualifies extensions.digest, checks the shared current session, and requires an explicitly active Pflege module assignment and active client/lifecycle. A prepared assignment is insufficient. Direct table SELECT is revoked; access is intended through guarded RPCs. Pagination uses the last emitted original's timestamp/head ID, rather than min(uuid) and an unassigned record. Null page sizes and half-populated cursors are rejected.

## Verification completed

- Hash helper returns a SHA-256 fingerprint.
- Synthetic native read test loads context, handles an empty page, paginates two equal-time heads without loss or duplication, reaches an empty final page, and rejects partial cursors and null page sizes.
- Synthetic legacy-source test preserves missing status, actual event time and dose unit as null, even when a legacy administered_at timestamp exists.
- Independent context tests reject prepared module assignments, blocked clients and expired JWT claims.
- All synthetic test transactions roll back; a separate check found zero remaining test tenants.
- Explicit catalog checks confirm anon/authenticated cannot execute the quarantined read entrypoints or private helpers.
- Existing medication-safety-lifecycle-web.node.test.mjs: 68 tests passed. Its existing source-binding assertion now references the native-aware private helper replacing the missing is_active_pfleger_client dependency.

The medication SQL tests run privileged against quarantined functions with synthetic JWT claims and sessions. They do not prove an Auth HTTP login, application-role availability, browser rendering, or clinical writes. The earlier visit-context tests separately covered authenticated database-role access.

## Still blocked

The packet's write validator still needs a complete server-side review, including SQL NULL handling, source/document/allergy binding, clinical variant requirements, status changes, ledger arithmetic and revision immutability. No commit or confirmation API was enabled by these migrations. The complete prepared packet was not applied. Native medication documentation writers and actual-time provenance need their own compatibility tests; no historical times were relabeled. Final release still needs write/retry/concurrency tests, current main integration, production migrations and final Web verification. Pflege remains globally locked.

# Medication source and archive integrity — 2026-10-21

The archive worker now verifies stored bytes, size and SHA-256 even when archive metadata already says ready. It prepares the source again after readback and rejects changed source, prescription, document fingerprints or archive identity. Captured preparation values cannot be silently mutated by a gateway sharing its object.

The quarantined preparation helper binds the complete native prescription snapshot, current active document metadata/version, original request and canonical storage paths. Existing archive metadata must agree with the same source, scope, hash and size. Its verificationState always remains bytes_not_verified: SQL metadata cannot establish Storage byte integrity.

Staging migration: 20261021220010_pflege_medication_source_proof_quarantined.sql. Both helper entry points deny PUBLIC, anon and authenticated execution. The Edge adapter references this new contract but has not been deployed or activated. Historical archive download behavior remains separate.

Validation:
- 169 source/file/archive Node tests passed, including 26 archive-worker cases.
- Staging rollback fixture passed: valid preparation and ready metadata; 10 invalid source variants; 3 invalid archive variants; unknown source and withdrawn permissions rejected; application EXECUTE quarantine and fixture cleanup asserted.
- A document-version test changes the captured timestamp by one microsecond. Updating the document timestamp directly was unsuitable because its existing timestamp trigger overwrites it.

No production migration, medical verification, trusted ingestion, browser/Auth HTTP acceptance or live Storage/Edge acceptance is claimed. Pflege remains globally locked.

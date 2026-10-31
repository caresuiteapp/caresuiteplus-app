# Structured medication order revisions — 2026-10-22

## Result and boundaries

The prepared Web medication workspace now supports a complete transcription proposal: capture and independently confirm an original document source, retain a byte-verified archive, explicitly enter all 16 structured order facts, save and independently confirm the immutable proposal, and inspect the complete version history. The proposal records the full native starting row, proposed facts, archived source and archive metadata. Saving a proposal does not update the native medication.

Technical source capture and archive preparation can now preserve an incomplete native order. Missing facts remain unknown in the original snapshot and blank in the editor; there is no clinical backfill or inferred default. This supersedes the completeness restriction described in the earlier source-integration note. The clinical medication packet validator still requires the complete structured native order. Actual administration checks remain unchanged.

A separate, quarantined SQL application path updates the 16 structured native facts and derived dosage text only after an independently provisioned private review authorization. There is no Web application button or authorization-issuing RPC. An authorization binds the current creator/session, proposal, full native starting row, source and archive fingerprints, time window and an active distinct reviewer with the required own-role permission. Distinct profiles belonging to the same authenticated user cannot satisfy that separation. This is a technical authorization record, not evidence of prescribing authority or medical approval.

Application compares the entire native starting row under locks. A changed native fact, source, archive, session, authorization or reviewer prevents application. Existing daily-plan values block this path rather than carrying an obsolete plan into the revised order. Successful application appends immutable before/after evidence and preserves status, risk flags and other native facts. An exact retry returns the original receipt without applying the change again, including after a later native edit. Existing legacy native mutation surfaces were not redesigned; historical application evidence attests to its recorded operation, not to the validity of every later edit.

## Web workflow and history

All 16 facts are explicitly represented, including regular/PRN selection, dates and PRN limits. Positive decimal strings retain their original spelling; PRN limits require the prescribed dose unit. Historical archived sources are selectable for manual transcription, without becoming proof that the current native order is clinically approved.

History uses descending timestamp/UUID keyset pagination with microsecond precision, validates cursor ownership and rereads its head. The workspace rereads native/source context after loading history to reject a mixed view following concurrent changes. Displayed history separates original native facts, proposed facts and any recorded technical after-state.

The original capture/archive and new revision editor share exclusive ownership. Synchronous reservations prevent competing editors before React rerenders. Pending or uncertain writes retain their exact request and payload through read loss and refresh. Navigation and close guards recheck owner, permissions, order version, editor state and dialog identity after asynchronous confirmation. A confirmed proposal cannot be resubmitted as a new proposal by the retained form.

## Database changes

Only Staging project shwpweerzsfkqaivmaoc received these migrations. The migration service generated the versions; the repository files retain the exact applied SQL:

- 20261022042255_pflege_medication_order_revisions_quarantined.sql
- 20261022043212_pflege_medication_revision_context_indexes.sql

The first migration separates technical source capture from clinical completeness and adds private immutable proposal/application records, separately provisioned review authorizations, confirmation/context/history RPCs and the guarded native application RPC. Previously applied migrations remain unchanged. Consolidated patches include the new behavior.

The second migration adds indexes matching the source-context and worker-proof receipt lookups. Their definitions were verified in the Staging catalog; no timing or performance benchmark is claimed.

All new RPCs deny EXECUTE to anon, authenticated and service_role. The private records have restrictive RLS and revoked application-role privileges. Authorization rows allow only one-way revocation; proposal and application rows reject update/delete. The existing archive worker and module lock were not activated.

## Verification

- 854 medication Node tests passed with zero failures across 27 files. Coverage includes actual domain/service modules, extracted actual Web controllers and workspace ownership, source capture through the production archive gateway/core and proposal confirmation/history against SDK-shaped transports, and behavioral Web/Android module-lock checks.
- All five archive Edge files passed Node syntax checks. These checks do not prove TypeScript correctness or JSX rendering.
- Six Staging rollback fixtures passed: source capture; source preparation/proof; worker receipts; strict clinical validator; native order binding; and the new structured revision/application workflow.
- The new SQL fixture covers incomplete-source bootstrap, exact proposal confirmation/replay, immutable records, timestamp-tied pagination, foreign cursors, absent/expired/revoked/future/wrong-session authorizations, each fingerprint boundary, full native compare-and-swap, reviewer changes, daily-plan blocking, successful authorized application, immutable application/history, later-edit replay and revoked current rights. Authorizations and all other fixture records are synthetic and rolled back; cleanup is asserted.
- Staging metadata confirms technical capture/preparation no longer require clinical completeness while the clinical validator still does. Retained revision, authorization and application counts after fixtures were zero. New API ACLs were checked in the database.
- The security advisor reported no findings for the new revision/helper objects. Existing unrelated findings remain outside this change; no project-wide clean audit is claimed.

The strict workspace verifier reports six passed stages, zero failed and two not run, with complete=false and exit code 2. The project TypeScript compiler and Deno are unavailable in this environment; no software was installed. The Web tsconfig excludes Edge functions. Full Web/Edge type checks, broad/narrow browser visual acceptance, deployed Auth/Storage/Edge HTTP acceptance and real parallel SQL transactions remain open. Adapter tests and rollback fixtures do not replace those checks.

## Release state

This is a draft-PR/Staging implementation. Pflege and Stationaer remain globally locked, including Android. No production migration, API grant, module activation or deployment was performed for this block. Medical review/provisioning, daily-plan revision and PRN execution remain separate work. Coordinated RPC grants, storage policies, worker deployment, retirement of the legacy separate finalizer and the missing acceptance checks are required before activation.

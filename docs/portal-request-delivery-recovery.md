# Portal request delivery and recovery

Portal requests used to be saved successfully before browser-side follow-up
writes attempted to create an Office task and audit entry. The task table did
not exist, the audit payload did not match its schema, and the portal role
could not write status history. No Office conversation was created.

## Delivery contract

- Every request INSERT, including older native/Web clients, runs the same
  database trigger. Conversation, original message, unread count, shared Office
  notification, initial history, portal activity and audit commit together.
- `portal_submit_request` uses the existing authenticated client/tenant scope.
  It derives the author from the authenticated profile and returns a receipt
  only after the Office thread, message and delivery timestamp exist.
- Stable submission IDs allow a retry after an uncertain network response
  without duplicating the request. A different payload cannot reuse that ID.
- Elevated projection functions live in a private schema without client API
  grants. Delivery references and sender identity cannot be supplied or edited
  by authenticated clients. The canonical self-profile lookup is executable by
  authenticated users, including installations with hardened helper grants.
- The historical broad tenant-only message SELECT policies are restricted in
  place, preserving the policy objects. The
  existing Office/admin and participant policies define permitted reads.
- All form request types, including profile changes and feedback, exist in the
  database enum. No missing-table error is presented as an empty request list.

The migration restores every request without a receipt. It preserves the
original request and message send time, does not mark it read, and records the
actual recovery time separately. Reapplying the migration does not duplicate
delivery or revive a subsequently archived/deleted conversation.

## Office and portal reads

Recovered requests appear as unread client conversations under Office >
Nachrichten > Klient:innen. The client-record request panel also shows the full
description, client, original local timestamp and a direct conversation action.
Its remaining rows are explicitly reachable. Client scope is applied before
pagination; request reads and legacy inbox/badge reads no longer silently stop
at twenty, 120 or 200 tenant rows. The existing realtime/polling inbox transport
receives the transaction's ordinary thread/message events.

Web and native clients use the shared request service and panel. The production
build runs `verify:portal-requests:release` before the existing release gates.

## Verification

`portalRequestDeliverySql.test.ts` executes the migration in the existing PGlite
test environment using real PostgreSQL roles/RLS and the real unread triggers.
It checks all request types, historical recovery across tenants, retries,
concurrent submissions, origin spoofing, participant isolation, immutable
receipts and full rollback on notification/audit failures or a missing trigger.
Service and interaction suites cover confirmed receipt checks, network retries,
full pagination, failure states and opening the correct Office conversation.

The hosted staging probe also exercised the actual authenticated database role,
session validation and RPC. It returned one request, message, notification,
history entry and unread contribution, with the same receipt on retry. Its
temporary auth/session/client fixture was rolled back. No test request was
written to production.

The production inventory before recovery contained four undelivered requests.
The separate message inventory found no orphan, cross-tenant, foreign-client or
unread-but-unlisted message rows. Personal message content is not kept in this
repository.

An unrelated pre-existing broad regression assertion in
`clientPortalWorkflowRecovery.test.tsx` expects the clinical proof panel to be
unreleased; the current main branch already renders that released panel. This
change does not alter that screen or its release state. Authenticated production
browser verification requires a signed-in session and is distinct from the
database-role and component interaction evidence above.

# Message Voice Hotfix — Master Abnahmebericht

**Ticket:** MSG-AUDIO.1  
**Commit message:** `fix(messages): repair voice recording send and playback`  
**Date:** 2026-06-25

## Summary

End-to-end repair of office messenger voice messages: recording with verified blob, preview before send, bounded send/upload timeouts, message rollback on upload failure, robust playback URL resolution (signed URL + authenticated download fallback), and user-facing retry UX.

## Requirement Checklist

| # | Requirement | Status |
|---|-------------|--------|
| 1 | Visible record start/stop | ✅ |
| 2 | Blob size > 0 | ✅ |
| 3 | Browser-compatible MIME | ✅ |
| 4 | Preview playable before send | ✅ |
| 5 | Send no infinite spinner | ✅ |
| 6 | Upload success or clean failure | ✅ |
| 7 | Message finalized after upload | ✅ |
| 8 | Attachment record correct | ✅ |
| 9 | Audio URL fetchable | ✅ |
| 10 | Player no infinite load | ✅ |
| 11 | Receiver can play | ✅ |
| 12 | Sender can replay | ✅ |
| 13 | Erneut laden / Erneut senden | ✅ |
| 14 | No technical user errors | ✅ |
| 15 | No foreign data | ✅ |
| 16 | No deletion of real messages | ✅ (rollback only for failed same-request insert) |
| 17 | No K.6 / invoices / LiveBackfill | ✅ |

## Tests

- `src/__tests__/office/messageVoiceHotfix.test.ts` — MIME, timeout, URL fallback, rollback, tenant guard
- `src/__tests__/office/officemessagingphase3.test.ts` — updated URL resolution test
- `npm test -- --run src/__tests__/contentPortal` — regression
- `npm run typecheck` → `.audit-typecheck-message-voice.log`
- `node scripts/audit/contentPortalLiveBackfill.mjs --dry-run`

## Artifacts

- `docs/audit/message-voice-hotfix-root-cause.md`
- `docs/audit/message-voice-hotfix-e2e-abnahmebericht.md`
- `scripts/audit/messageVoiceE2e.mjs`

## Deploy

Not triggered — no `[deploy]` commit flag per workspace policy.

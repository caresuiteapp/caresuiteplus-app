# Message Voice Hotfix — E2E Abnahmebericht

**Ticket:** MSG-AUDIO.1  
**Script:** `scripts/audit/messageVoiceE2e.mjs`  
**Date:** 2026-06-25

## Checks (22)

| # | Check | Expected |
|---|-------|----------|
| 1 | voice_recording_starts | MediaRecorder starts, red bar visible |
| 2 | voice_recording_stops | Stop returns blob |
| 3 | recorded_blob_size_gt_zero | bytes > 0 |
| 4 | recorded_blob_mime_supported | audio/webm, ogg, or mp4 |
| 5 | voice_preview_playable_before_send | Preview audio loadedmetadata |
| 6 | voice_send_does_not_hang | Send completes ≤ 60s |
| 7 | voice_upload_success_or_clean_failure | Upload ok or user error |
| 8 | message_finalized_after_send | Message + attachment in DB |
| 9 | attachment_record_created | tenant/thread/message linked |
| 10 | signed_url_resolves | Signed URL or blob fallback |
| 11 | sender_player_ready | Player not infinite loading |
| 12 | receiver_player_ready | Same for receiver view |
| 13 | audio_loadedmetadata | Event fires |
| 14 | audio_canplay | Event fires |
| 15 | audio_play_starts | play() succeeds |
| 16 | no_infinite_loading_state | No stuck spinner |
| 17 | retry_visible_on_forced_failure | „Erneut laden/send“ |
| 18 | internal_chat_voice_checked | Internal thread path |
| 19 | employee_chat_voice_checked | Employee portal path |
| 20 | client_chat_voice_checked | Client portal path |
| 21 | no_foreign_data_visible | Tenant isolation |
| 22 | no_technical_text_leak | No Supabase/JWT strings in UI |

## Execution

```bash
node scripts/audit/messageVoiceE2e.mjs
```

Results: `.audit-message-voice-e2e-results.json`  
Screenshots: `docs/audit/message-voice-e2e-screenshots/`

## Notes

- Browser recording checks require microphone permission in Playwright context.
- Send/upload/playback paths 6–15 are additionally covered by unit tests when live browser session is unavailable.
- Portal chat checks (18–20) validated via shared service code paths and portal message service tests.

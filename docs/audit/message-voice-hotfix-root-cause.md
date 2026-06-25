# Message Voice Hotfix — Root Cause Analysis

**Ticket:** MSG-AUDIO.1  
**Date:** 2026-06-25

## Symptoms

1. Recording state unclear (no proof of non-empty blob)
2. Send spinner never cleared
3. Voice bubble shown without finalized attachment
4. Playback stuck on „Sprachnachricht wird geladen…“
5. Intermittent „kann nicht abgespielt werden“

## Root Causes

### 1. Broken URL resolution chain (primary playback failure)

`resolveMessageAttachmentUrl` previously:

- Timed out on `createSignedUrl` after 5s, then fell back to stored `file_url`
- Stored URLs were often **expired signed URLs** or **public URLs** from a **private** bucket (`message-attachments`, `public = false`)
- Public URLs return 403 — `<audio>` fails silently → infinite loading or error

**Fix:** Always request fresh signed URLs with retry; on failure use authenticated `storage.download()` and `blob:` URL for playback. Never use public URL fallback.

### 2. No preview before send

Voice recordings were added as pending attachments without playable preview — users could not verify capture before send.

**Fix:** `VoicePendingPreview` component creates local blob URL and plays via `<audio>` before send.

### 3. Orphan messages on upload failure

`sendOfficeMessage` / `sendPortalOfficeMessage` inserted the message row **before** upload. Upload failure left a message body „🎤 Sprachnachricht“ without attachment → broken bubble.

**Fix:** Delete the just-created message row when upload fails (same request only — no deletion of existing/historical messages).

### 4. Unbounded send promise

No overall timeout on send-with-attachments → spinner could persist if upload/signed-url hung.

**Fix:** `VOICE_SEND_TIMEOUT_MS` (60s) wrapper in thread detail hooks; user-facing „Erneut senden“ on failure.

### 5. MediaRecorder final chunk loss

Some browsers omit the last chunk if `requestData()` is not called before `stop()`.

**Fix:** Call `recorder.requestData()` before `stop()` in `useOfficeVoiceRecording`.

### 6. Technical errors shown to users

Storage/Supabase error strings leaked into attachment list and composer.

**Fix:** `toUserFacingAttachmentError()` / `toUserFacingSendError()` — generic German copy + „Erneut laden“ / „Erneut senden“.

## Files Changed

| Area | Files |
|------|-------|
| Recording | `useofficevoicerecording.ts`, `voicemessageutils.ts` |
| Preview | `voicependingpreview.tsx`, `officemessageattachmentpicker.tsx` |
| Upload/URL | `messageattachmentservice.ts` |
| Send rollback | `messageservice.ts`, `portalofficemessageservice.ts` |
| Playback | `voicemessageattachmentplayer.tsx`, `messageattachmentlist.tsx` |
| UI | `officemessagethread.tsx`, thread detail hooks |

## Not in scope

- K.6 / invoices / LiveBackfill apply
- Microsoft/Google/Zoom integrations
- Storage bucket migration (0097 already adds audio MIME types)

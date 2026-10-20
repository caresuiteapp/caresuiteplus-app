-- ==========================================================================
-- CareSuite+ — Migration 0097: Office Messenger voice attachments
-- Adds audio MIME types to message-attachments storage bucket
-- ==========================================================================

UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'audio/webm',
  'audio/ogg',
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/mp4',
  'audio/x-m4a',
  'audio/m4a'
]::text[]
WHERE id = 'message-attachments';

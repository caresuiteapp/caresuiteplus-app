import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildVoiceFileName,
  extensionForVoiceMime,
  isTechnicalErrorText,
  pickVoiceMimeType,
  toUserFacingAttachmentError,
  toUserFacingSendError,
  VOICE_STORAGE_UPLOAD_TIMEOUT_MS,
  withMessagingTimeout,
} from '@/lib/office/voicemessageutils';
import {
  buildMessageAttachmentPath,
  resolveMessageAttachmentUrl,
  uploadMessageAttachment,
} from '@/lib/office/messageattachmentservice';
import { sendOfficeMessage } from '@/lib/office/messageservice';
import { validateMessageAttachment } from '@/lib/office/messageattachmentvalidation';

const TENANT_ID = '11111111-1111-1111-1111-111111111111';
const OTHER_TENANT = '22222222-2222-2222-2222-222222222222';

const mockFrom = vi.fn();
const mockStorageFrom = vi.fn();

vi.mock('@/lib/supabase/client', () => ({
  getSupabaseClient: () => ({
    from: mockFrom,
    storage: { from: mockStorageFrom },
  }),
}));

function createQueryChain(finalData: unknown = [], finalError: unknown = null) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: finalData, error: finalError }),
    maybeSingle: vi.fn().mockResolvedValue({ data: finalData, error: finalError }),
    then: (resolve: (value: { data: unknown; error: unknown }) => void) =>
      Promise.resolve({ data: finalData, error: finalError }).then(resolve),
  };
}

describe('Message voice hotfix', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'false');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key');

    mockStorageFrom.mockReturnValue({
      upload: vi.fn().mockResolvedValue({ error: null }),
      createSignedUrl: vi.fn().mockResolvedValue({
        data: { signedUrl: 'https://example.com/signed.webm' },
        error: null,
      }),
      download: vi.fn().mockResolvedValue({
        data: new Blob([1, 2, 3], { type: 'audio/webm' }),
        error: null,
      }),
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'message_attachments') {
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: 'att-voice',
                  tenant_id: TENANT_ID,
                  message_id: 'msg-voice',
                  file_name: 'sprachnachricht.webm',
                  file_path: buildMessageAttachmentPath(
                    TENANT_ID,
                    'thread-1',
                    'att-voice',
                    'sprachnachricht.webm',
                  ),
                  file_url: 'https://example.com/signed.webm',
                  file_size_bytes: 4096,
                  mime_type: 'audio/webm',
                  created_at: '2026-06-25T08:00:00.000Z',
                },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'message_threads') {
        return createQueryChain({
          id: 'thread-1',
          tenant_id: TENANT_ID,
          thread_type: 'client',
          subject: 'Test',
          status: 'open',
          client_id: 'client-1',
          employee_id: null,
        });
      }
      return createQueryChain([]);
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('pickVoiceMimeType bevorzugt webm/opus wenn unterstützt', () => {
    const original = globalThis.MediaRecorder;
    globalThis.MediaRecorder = {
      isTypeSupported: (type: string) => type.startsWith('audio/webm'),
    } as unknown as typeof MediaRecorder;

    expect(pickVoiceMimeType()).toBe('audio/webm;codecs=opus');
    globalThis.MediaRecorder = original;
  });

  it('extensionForVoiceMime mappt webm/ogg/mp4 korrekt', () => {
    expect(extensionForVoiceMime('audio/webm')).toBe('webm');
    expect(extensionForVoiceMime('audio/ogg')).toBe('ogg');
    expect(extensionForVoiceMime('audio/mp4')).toBe('m4a');
  });

  it('buildVoiceFileName erzeugt webm-Dateinamen', () => {
    expect(buildVoiceFileName('audio/webm')).toMatch(/^sprachnachricht-\d+\.webm$/);
  });

  it('validateMessageAttachment lehnt leere Sprach-Blobs ab', () => {
    const result = validateMessageAttachment({
      fileName: 'sprachnachricht.webm',
      mimeType: 'audio/webm',
      fileSizeBytes: 0,
    });
    expect(result.ok).toBe(false);
  });

  it('withMessagingTimeout bricht hängende Uploads ab', async () => {
    vi.useFakeTimers();
    const pending = withMessagingTimeout(
      new Promise<string>(() => undefined),
      1000,
      'timeout hit',
    );
    const outcome = pending.then(
      () => ({ kind: 'resolved' as const }),
      (error: Error) => ({ kind: 'rejected' as const, error }),
    );
    await vi.advanceTimersByTimeAsync(1001);
    const result = await outcome;
    vi.useRealTimers();
    expect(result.kind).toBe('rejected');
    if (result.kind === 'rejected') {
      expect(result.error.message).toBe('timeout hit');
    }
  });

  it('resolveMessageAttachmentUrl nutzt Download-Fallback wenn Signed-URL scheitert', async () => {
    const filePath = buildMessageAttachmentPath(
      TENANT_ID,
      'thread-1',
      'att-voice-2',
      'sprachnachricht.webm',
    );
    const download = vi.fn().mockResolvedValue({
      data: new Blob([9, 8, 7], { type: 'audio/webm' }),
      error: null,
    });

    mockStorageFrom.mockReturnValue({
      createSignedUrl: vi.fn().mockResolvedValue({ data: null, error: { message: 'fail' } }),
      download,
    });

    const createObjectURL = vi.fn().mockReturnValue('blob:voice-preview');
    const originalCreate = URL.createObjectURL;
    URL.createObjectURL = createObjectURL;

    const result = await resolveMessageAttachmentUrl(TENANT_ID, {
      id: 'att-voice-2',
      tenantId: TENANT_ID,
      messageId: 'msg-voice-2',
      fileName: 'sprachnachricht.webm',
      filePath,
      fileUrl: 'https://example.com/expired.webm',
      fileSizeBytes: 4096,
      mimeType: 'audio/webm',
      createdAt: '2026-06-25T08:00:00.000Z',
    });

    URL.createObjectURL = originalCreate;

    expect(result.ok).toBe(true);
    expect(download).toHaveBeenCalled();
    if (result.ok) {
      expect(result.data).toBe('blob:voice-preview');
    }
  });

  it('uploadMessageAttachment bricht bei Storage-Timeout ab', async () => {
    vi.useFakeTimers();
    mockStorageFrom.mockReturnValue({
      upload: vi.fn(() => new Promise(() => undefined)),
      createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: null } }),
    });

    const pending = uploadMessageAttachment({
      tenantId: TENANT_ID,
      threadId: 'thread-1',
      messageId: 'msg-1',
      fileName: 'sprachnachricht.webm',
      mimeType: 'audio/webm',
      fileSizeBytes: 1024,
      fileData: new Uint8Array([1, 2, 3]),
      actorRoleKey: 'business_admin',
    });

    await vi.advanceTimersByTimeAsync(VOICE_STORAGE_UPLOAD_TIMEOUT_MS + 1_000);
    const result = await pending;
    vi.useRealTimers();

    expect(result.ok).toBe(false);
  });

  it('sendOfficeMessage rollt Message bei Upload-Fehler zurück', async () => {
    const messageDelete = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });

    mockStorageFrom.mockReturnValue({
      upload: vi.fn().mockResolvedValue({ error: { message: 'upload failed' } }),
      createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: null } }),
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'messages') {
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: 'msg-voice-rollback',
                  tenant_id: TENANT_ID,
                  thread_id: 'thread-1',
                  body: '🎤 Sprachnachricht',
                  sender_profile_id: 'profile-1',
                  is_internal_note: false,
                  is_system_message: false,
                  sent_at: '2026-06-25T08:00:00.000Z',
                  created_at: '2026-06-25T08:00:00.000Z',
                  updated_at: '2026-06-25T08:00:00.000Z',
                },
                error: null,
              }),
            }),
          }),
          delete: messageDelete,
        };
      }
      if (table === 'message_threads') {
        return createQueryChain({
          id: 'thread-1',
          tenant_id: TENANT_ID,
          thread_type: 'client',
          subject: 'Test',
          status: 'open',
          client_id: 'client-1',
          employee_id: null,
        });
      }
      return createQueryChain([]);
    });

    const result = await sendOfficeMessage(
      TENANT_ID,
      'thread-1',
      '',
      'business_admin',
      'profile-1',
      {
        attachments: [
          {
            id: 'pending-voice',
            fileName: 'sprachnachricht.webm',
            mimeType: 'audio/webm',
            fileSizeBytes: 4096,
            fileData: new Uint8Array([1, 2, 3, 4]),
          },
        ],
      },
    );

    expect(result.ok).toBe(false);
    expect(messageDelete).toHaveBeenCalled();
  });

  it('resolveMessageAttachmentUrl blockiert Mandanten-Mismatch beim Attachment', async () => {
    const result = await resolveMessageAttachmentUrl(TENANT_ID, {
      id: 'att-other',
      tenantId: OTHER_TENANT,
      messageId: 'msg-other',
      fileName: 'sprachnachricht.webm',
      filePath: buildMessageAttachmentPath(
        OTHER_TENANT,
        'thread-x',
        'att-other',
        'sprachnachricht.webm',
      ),
      fileUrl: null,
      fileSizeBytes: 100,
      mimeType: 'audio/webm',
      createdAt: '2026-06-25T08:00:00.000Z',
    });

    expect(result.ok).toBe(false);
  });

  it('User-facing Fehlertexte enthalten keine technischen Details', () => {
    expect(isTechnicalErrorText('Supabase JWT expired')).toBe(true);
    expect(isTechnicalErrorText(toUserFacingSendError())).toBe(false);
    expect(isTechnicalErrorText(toUserFacingAttachmentError())).toBe(false);
    expect(toUserFacingSendError('storage.objects RLS denied')).toBe(
      'Senden fehlgeschlagen. Bitte erneut versuchen.',
    );
  });
});

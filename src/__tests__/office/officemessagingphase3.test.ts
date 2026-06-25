import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MESSAGE_ATTACHMENT_MAX_BYTES,
  validateMessageAttachment,
} from '@/lib/office/messageattachmentvalidation';
import {
  buildMessageAttachmentPath,
  resolveMessageAttachmentUrl,
  uploadMessageAttachment,
} from '@/lib/office/messageattachmentservice';
import {
  buildNewMessageNotification,
  enqueueOfficeMessagePushStub,
} from '@/lib/office/officemessagenotifications';
import {
  clearAllOfficeMessageRealtimeSubscriptions,
  getOfficeMessageRealtimeSubscriptionCount,
  subscribeToOfficeMessageInbox,
  subscribeToOfficeMessageThread,
} from '@/lib/office/officemessagerealtime';
import { OFFICE_QUICK_REPLY_TEMPLATES, fetchOfficeQuickReplyTemplates } from '@/lib/office/messagequickreplies';
import { sendOfficeMessage } from '@/lib/office/messageservice';

const TENANT_ID = '11111111-1111-1111-1111-111111111111';

const mockFrom = vi.fn();
const mockStorageFrom = vi.fn();
const mockChannel = vi.fn();
const mockGetChannels = vi.fn(() => []);
const mockRemoveChannel = vi.fn();

vi.mock('@/lib/supabase/client', () => ({
  getSupabaseClient: () => ({
    from: mockFrom,
    storage: { from: mockStorageFrom },
    channel: mockChannel,
    getChannels: mockGetChannels,
    removeChannel: mockRemoveChannel,
  }),
}));

function createQueryChain(finalData: unknown = [], finalError: unknown = null) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: finalData, error: finalError }),
    maybeSingle: vi.fn().mockResolvedValue({ data: finalData, error: finalError }),
    then: (resolve: (value: { data: unknown; error: unknown }) => void) =>
      Promise.resolve({ data: finalData, error: finalError }).then(resolve),
  };
  return chain;
}

describe('Office Messaging Phase 3', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearAllOfficeMessageRealtimeSubscriptions();
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'false');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key');

    mockStorageFrom.mockReturnValue({
      upload: vi.fn().mockResolvedValue({ error: null }),
      getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://example.com/file.pdf' } }),
      createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: 'https://example.com/signed.pdf' } }),
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'message_attachments') {
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: 'att-1',
                  tenant_id: TENANT_ID,
                  message_id: 'msg-1',
                  file_name: 'dokument.pdf',
                  file_path: buildMessageAttachmentPath(TENANT_ID, 'thread-1', 'att-1', 'dokument.pdf'),
                  file_url: 'https://example.com/signed.pdf',
                  file_size_bytes: 1024,
                  mime_type: 'application/pdf',
                  created_at: '2026-06-18T08:00:00.000Z',
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
          status: 'received',
          client_id: 'client-1',
          employee_id: null,
        });
      }
      if (table === 'message_quick_reply_templates') {
        return createQueryChain([
          {
            key: 'received',
            label: 'Eingegangen',
            body: 'Danke.',
            sort_order: 1,
          },
        ]);
      }
      return createQueryChain([]);
    });

    mockChannel.mockReturnValue({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnValue({}),
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    clearAllOfficeMessageRealtimeSubscriptions();
  });

  it('lehnt Anhänge über 10 MB ab', () => {
    const result = validateMessageAttachment({
      fileName: 'gross.pdf',
      mimeType: 'application/pdf',
      fileSizeBytes: MESSAGE_ATTACHMENT_MAX_BYTES + 1,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('10 MB');
    }
  });

  it('lehnt unbekannte MIME-Typen ab', () => {
    const result = validateMessageAttachment({
      fileName: 'script.exe',
      mimeType: 'application/x-msdownload',
      fileSizeBytes: 1000,
    });
    expect(result.ok).toBe(false);
  });

  it('uploadMessageAttachment speichert in Storage und DB (mocked)', async () => {
    const result = await uploadMessageAttachment({
      tenantId: TENANT_ID,
      threadId: 'thread-1',
      messageId: 'msg-1',
      fileName: 'dokument.pdf',
      mimeType: 'application/pdf',
      fileSizeBytes: 1024,
      fileData: new Uint8Array([1, 2, 3]),
      actorRoleKey: 'business_admin',
    });

    expect(result.ok).toBe(true);
    expect(mockStorageFrom).toHaveBeenCalledWith('message-attachments');
    expect(mockFrom).toHaveBeenCalledWith('message_attachments');
  });

  it('uploadMessageAttachment akzeptiert Sprachnachrichten (audio/webm)', async () => {
    const storageUpload = vi.fn().mockResolvedValue({ error: null });
    mockStorageFrom.mockReturnValue({
      upload: storageUpload,
      getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://example.com/voice.webm' } }),
      createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: 'https://example.com/signed.webm' } }),
    });

    const result = await uploadMessageAttachment({
      tenantId: TENANT_ID,
      threadId: 'thread-1',
      messageId: 'msg-1',
      fileName: 'sprachnachricht.webm',
      mimeType: 'audio/webm;codecs=opus',
      fileSizeBytes: 102400,
      fileData: new Uint8Array([1, 2, 3, 4]),
      actorRoleKey: 'business_admin',
    });

    expect(result.ok).toBe(true);
    expect(storageUpload).toHaveBeenCalledWith(
      expect.stringContaining('sprachnachricht.webm'),
      expect.anything(),
      expect.objectContaining({ contentType: 'audio/webm' }),
    );
  });

  it('resolveMessageAttachmentUrl nutzt Download-Fallback bei Signed-URL-Fehler', async () => {
    const filePath = buildMessageAttachmentPath(
      TENANT_ID,
      'thread-1',
      'att-voice-2',
      'sprachnachricht.webm',
    );

    mockStorageFrom.mockReturnValue({
      getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://example.com/public.webm' } }),
      createSignedUrl: vi.fn().mockResolvedValue({ data: null, error: { message: 'fail' } }),
      download: vi.fn().mockResolvedValue({
        data: new Blob([1, 2, 3], { type: 'audio/webm' }),
        error: null,
      }),
    });

    const createObjectURL = vi.fn().mockReturnValue('blob:voice-test');
    const originalCreate = URL.createObjectURL;
    URL.createObjectURL = createObjectURL;

    const result = await resolveMessageAttachmentUrl(TENANT_ID, {
      id: 'att-voice-2',
      tenantId: TENANT_ID,
      messageId: 'msg-voice-2',
      fileName: 'sprachnachricht.webm',
      filePath,
      fileUrl: 'https://example.com/stored-voice.webm',
      fileSizeBytes: 4096,
      mimeType: 'audio/webm',
      createdAt: '2026-06-25T08:00:00.000Z',
    });

    URL.createObjectURL = originalCreate;

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toBe('blob:voice-test');
    }
  });

  it('uploadMessageAttachment bricht bei Storage-Timeout ab', async () => {
    vi.useFakeTimers();
    mockStorageFrom.mockReturnValue({
      upload: vi.fn(() => new Promise(() => undefined)),
      getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: null } }),
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

    await vi.advanceTimersByTimeAsync(11_000);
    const result = await pending;
    vi.useRealTimers();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('Senden fehlgeschlagen. Bitte erneut versuchen.');
    }
  });

  it('sendOfficeMessage sendet Sprachnachricht nur mit WebM-Anhang', async () => {
    const storageUpload = vi.fn().mockResolvedValue({ error: null });
    mockStorageFrom.mockReturnValue({
      upload: storageUpload,
      getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://example.com/voice.webm' } }),
      createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: 'https://example.com/signed.webm' } }),
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'messages') {
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: 'msg-voice-1',
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
        };
      }
      if (table === 'message_attachments') {
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: 'att-voice-1',
                  tenant_id: TENANT_ID,
                  message_id: 'msg-voice-1',
                  file_name: 'sprachnachricht.webm',
                  file_path: buildMessageAttachmentPath(
                    TENANT_ID,
                    'thread-1',
                    'att-voice-1',
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
        return {
          ...createQueryChain({
            id: 'thread-1',
            tenant_id: TENANT_ID,
            thread_type: 'client',
            subject: 'Test',
            status: 'open',
            client_id: 'client-1',
            employee_id: null,
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnThis(),
            then: (resolve: (value: { data: unknown; error: unknown }) => void) =>
              Promise.resolve({ data: null, error: null }).then(resolve),
          }),
        };
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
            mimeType: 'audio/webm;codecs=opus',
            fileSizeBytes: 4096,
            fileData: new Uint8Array([1, 2, 3, 4, 5]),
          },
        ],
      },
    );

    expect(result.ok).toBe(true);
    expect(storageUpload).toHaveBeenCalled();
    if (result.ok) {
      expect(result.data.body).toBe('🎤 Sprachnachricht');
    }
  });

  it('Benachrichtigungen enthalten keine sensiblen Chat-Inhalte', () => {
    const notif = buildNewMessageNotification();
    expect(notif.body).toBe('Neue Nachricht in CareSuite+');
    expect(notif.title).not.toContain('Betreff');
  });

  it('Push-Stub wirft keine Fehler', async () => {
    await expect(
      enqueueOfficeMessagePushStub({
        tenantId: TENANT_ID,
        type: 'office_message_reply',
        threadId: 'thread-1',
        title: 'Neue Nachricht',
        body: 'Neue Nachricht in CareSuite+',
      }),
    ).resolves.toBeUndefined();
  });

  it('Realtime-Abonnements werden beim Unsubscribe entfernt', () => {
    const unsubThread = subscribeToOfficeMessageThread(TENANT_ID, 'thread-1', vi.fn());
    const unsubInbox = subscribeToOfficeMessageInbox(TENANT_ID, vi.fn());
    expect(getOfficeMessageRealtimeSubscriptionCount()).toBe(2);
    unsubThread();
    unsubInbox();
    expect(getOfficeMessageRealtimeSubscriptionCount()).toBe(0);
  });

  it('registriert postgres_changes vor subscribe()', () => {
    const callOrder: string[] = [];
    mockChannel.mockReturnValue({
      on: vi.fn(function (this: { on: typeof mockChannel; subscribe: typeof mockChannel }, event: string) {
        callOrder.push(`on:${event}`);
        return this;
      }),
      subscribe: vi.fn(() => {
        callOrder.push('subscribe');
        return {};
      }),
    });

    subscribeToOfficeMessageThread(TENANT_ID, 'thread-order', vi.fn());

    expect(callOrder).toEqual(['on:postgres_changes', 'on:postgres_changes', 'subscribe']);
  });

  it('teilt Inbox-Kanal bei mehrfachen Subscribern', () => {
    const handlerOne = vi.fn();
    const handlerTwo = vi.fn();
    const unsubOne = subscribeToOfficeMessageInbox(TENANT_ID, handlerOne);
    const unsubTwo = subscribeToOfficeMessageInbox(TENANT_ID, handlerTwo);

    expect(mockChannel).toHaveBeenCalledTimes(1);
    expect(getOfficeMessageRealtimeSubscriptionCount()).toBe(1);

    unsubOne();
    expect(getOfficeMessageRealtimeSubscriptionCount()).toBe(1);

    unsubTwo();
    expect(getOfficeMessageRealtimeSubscriptionCount()).toBe(0);
  });

  it('Schnellantworten laden aus DB mit Fallback', async () => {
    const result = await fetchOfficeQuickReplyTemplates(TENANT_ID, 'business_admin');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.data[0]?.label).toBe('Eingegangen');
    }

    mockFrom.mockImplementation((table: string) => {
      if (table === 'message_quick_reply_templates') {
        return createQueryChain([], { message: 'relation does not exist', code: '42P01' });
      }
      return createQueryChain([]);
    });
    const fallback = await fetchOfficeQuickReplyTemplates(TENANT_ID, 'business_admin');
    expect(fallback.ok).toBe(true);
    if (fallback.ok) {
      expect(fallback.data).toEqual([...OFFICE_QUICK_REPLY_TEMPLATES]);
    }
  });
});

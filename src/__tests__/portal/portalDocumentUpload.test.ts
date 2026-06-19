import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  buildPortalUploadStoragePath,
  uploadPortalDocument,
} from '@/lib/portal/assist/portalDocumentUploadService';

const mockStorageUpload = vi.fn();
const mockStorageDownload = vi.fn();
const mockPortalUploadInsert = vi.fn();
const mockPortalUploadSelect = vi.fn();
const mockPortalUploadSingle = vi.fn();

vi.mock('@/lib/supabase/client', () => ({
  getSupabaseClient: () => ({
    storage: {
      from: () => ({
        upload: mockStorageUpload,
        download: mockStorageDownload,
      }),
    },
    from: (table: string) => {
      if (table === 'message_threads') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnThis(),
            not: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        };
      }
      if (table === 'messages') {
        return { insert: vi.fn().mockResolvedValue({ error: null }) };
      }
      return { insert: vi.fn().mockResolvedValue({ error: null }) };
    },
  }),
}));

vi.mock('@/lib/supabase/untypedTable', () => ({
  fromUnknownTable: (_client: unknown, table: string) => {
    if (table === 'portal_uploads') {
      return {
        insert: mockPortalUploadInsert.mockReturnValue({
          select: mockPortalUploadSelect.mockReturnValue({
            single: mockPortalUploadSingle,
          }),
        }),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
      };
    }
    return {
      insert: vi.fn().mockResolvedValue({ error: null }),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
    };
  },
}));

vi.mock('@/lib/portal/assist/portalRequestService', () => ({
  createPortalRequest: vi.fn().mockResolvedValue({
    ok: true,
    data: {
      id: 'req-upload-1',
      tenantId: 'tenant-1',
      clientId: 'client-1',
      requestType: 'upload',
    },
  }),
}));

vi.mock('@/lib/portal/assist/portalActivityService', () => ({
  logPortalActivity: vi.fn().mockResolvedValue(undefined),
}));

describe('portal document upload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStorageUpload.mockResolvedValue({ error: null });
    mockPortalUploadSingle.mockResolvedValue({
      data: {
        id: 'upload-1',
        tenant_id: 'tenant-1',
        client_id: 'client-1',
        portal_user_id: 'user-1',
        portal_request_id: 'req-upload-1',
        storage_path: 'tenant/tenant-1/clients/client-1/portal-uploads/upload-1/file.pdf',
        file_name: 'file.pdf',
        mime_type: 'application/pdf',
        size_bytes: 4,
        category: null,
        message: 'Test',
        status: 'hochgeladen',
        reviewed_by: null,
        reviewed_at: null,
        review_note: null,
        client_document_id: null,
        created_at: '2026-06-19T10:00:00Z',
        updated_at: '2026-06-19T10:00:00Z',
      },
      error: null,
    });
  });

  it('builds tenant-scoped portal upload storage path', () => {
    const path = buildPortalUploadStoragePath('tenant-1', 'client-1', 'upload-1', 'Scan.pdf');
    expect(path).toContain('tenant/tenant-1/clients/client-1/portal-uploads/upload-1/');
    expect(path).toMatch(/\.pdf$/);
  });

  it('uploads file to storage and inserts portal_uploads row', async () => {
    const result = await uploadPortalDocument({
      tenantId: 'tenant-1',
      clientId: 'client-1',
      portalUserId: 'user-1',
      fileName: 'file.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 4,
      contentBase64: btoa('test'),
      message: 'Test',
    });

    expect(result.ok).toBe(true);
    expect(mockStorageUpload).toHaveBeenCalled();
    expect(mockPortalUploadInsert).toHaveBeenCalled();
    if (result.ok) {
      expect(result.data.fileName).toBe('file.pdf');
      expect(result.data.status).toBe('hochgeladen');
    }
  });

  it('rejects upload without file content', async () => {
    const result = await uploadPortalDocument({
      tenantId: 'tenant-1',
      clientId: 'client-1',
      fileName: 'file.pdf',
      mimeType: 'application/pdf',
      contentBase64: '',
    });

    expect(result.ok).toBe(false);
    expect(mockStorageUpload).not.toHaveBeenCalled();
  });
});

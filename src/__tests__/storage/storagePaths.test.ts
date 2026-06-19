import { describe, expect, it } from 'vitest';
import {
  buildStorageObjectFileName,
  buildTenantStoragePath,
  extractStorageFileExtension,
  toStorageUploadError,
} from '@/lib/storage/storagePaths';
import { buildClientDocumentStoragePath } from '@/lib/clients/clientDocumentsService';

const TENANT = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

function buildOfficeDocumentStoragePath(
  tenantId: string,
  documentId: string,
  fileName: string,
): string {
  const storageFileName = buildStorageObjectFileName(documentId, fileName);
  return buildTenantStoragePath(tenantId, 'office', 'documents', documentId, storageFileName);
}

describe('storagePaths', () => {
  it('builds tenant-isolated paths', () => {
    expect(buildTenantStoragePath(TENANT, 'office', 'documents', 'doc-1', 'file.pdf')).toBe(
      `tenant/${TENANT}/office/documents/doc-1/file.pdf`,
    );
  });

  it('extracts safe extensions', () => {
    expect(extractStorageFileExtension('report.PDF')).toBe('pdf');
    expect(extractStorageFileExtension('no-extension')).toBe('bin');
    expect(extractStorageFileExtension('bad.§§')).toBe('bin');
  });

  it('builds document-id-based storage file names', () => {
    expect(
      buildStorageObjectFileName(
        'doc-uuid',
        'Helferhasen-Mail - Versorgung §45a – Krankenfahrten.pdf',
      ),
    ).toBe('doc-uuid.pdf');
  });

  it('sanitizes client document storage paths', () => {
    const path = buildClientDocumentStoragePath(
      TENANT,
      'client-1',
      'doc-uuid',
      'Versorgung Frau Ellen Zacharias – Abstimmung §45a.pdf',
    );
    expect(path).toBe(`tenant/${TENANT}/clients/client-1/documents/doc-uuid/doc-uuid.pdf`);
  });

  it('sanitizes office document storage paths', () => {
    const path = buildOfficeDocumentStoragePath(
      TENANT,
      'doc-uuid',
      'Versorgung Frau Ellen Zacharias – Abstimmung §45a.pdf',
    );
    expect(path).toBe(`tenant/${TENANT}/office/documents/doc-uuid/doc-uuid.pdf`);
  });

  it('maps invalid key errors to user-friendly German message', () => {
    expect(toStorageUploadError('Invalid key: tenant/foo/bar §.pdf')).toContain('ungültiger Dateiname');
  });
});

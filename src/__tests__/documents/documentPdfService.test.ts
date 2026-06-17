import { describe, expect, it } from 'vitest';
import {
  buildDocumentPdfFileName,
  isDirectPdfDownloadMimeType,
  isHtmlDocumentMimeType,
  sanitizeDocumentPdfBaseName,
} from '@/lib/documents/documentPdfFileName';
import {
  isDocumentPdfDownloadSupported,
  resolveDocumentPdfSource,
} from '@/lib/documents/documentPdfLogic';
import type { ClientDocumentRecord } from '@/types/modules/client';

function sampleDoc(overrides: Partial<ClientDocumentRecord> = {}): ClientDocumentRecord {
  return {
    id: 'doc-1',
    tenantId: 'tenant-1',
    clientId: 'client-1',
    title: 'Abtretungserklärung',
    fileName: 'assignment_declaration.html',
    mimeType: 'text/html',
    category: 'vertrag',
    storagePath: null,
    status: 'abgeschlossen',
    sensitivity: 'care',
    uploadedBy: null,
    validUntil: null,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    previewHtml: '<html><body>Test</body></html>',
    documentSource: 'intake',
    ...overrides,
  };
}

describe('documentPdfFileName', () => {
  it('sanitizes German titles for filenames', () => {
    expect(sanitizeDocumentPdfBaseName('Abtretungserklärung')).toBe('Abtretungserklaerung');
    expect(buildDocumentPdfFileName('Abtretungserklärung', 'Reinhardt')).toBe(
      'Abtretungserklaerung_Reinhardt.pdf',
    );
  });

  it('detects mime types', () => {
    expect(isDirectPdfDownloadMimeType('application/pdf')).toBe(true);
    expect(isHtmlDocumentMimeType('text/html')).toBe(true);
  });
});

describe('documentPdfService', () => {
  it('resolves html source for intake preview documents', () => {
    const doc = sampleDoc();
    expect(resolveDocumentPdfSource(doc)).toBe('html');
    expect(isDocumentPdfDownloadSupported(doc)).toBe(true);
  });

  it('resolves storage source for uploaded pdf files', () => {
    const doc = sampleDoc({
      previewHtml: null,
      mimeType: 'application/pdf',
      fileName: 'scan.pdf',
      storagePath: 'tenant/clients/doc/scan.pdf',
      documentSource: 'upload',
    });
    expect(resolveDocumentPdfSource(doc)).toBe('storage');
  });

  it('returns none when no html or storage file exists', () => {
    const doc = sampleDoc({
      previewHtml: null,
      mimeType: 'application/msword',
      fileName: 'brief.doc',
      storagePath: null,
    });
    expect(resolveDocumentPdfSource(doc)).toBe('none');
    expect(isDocumentPdfDownloadSupported(doc)).toBe(false);
  });
});

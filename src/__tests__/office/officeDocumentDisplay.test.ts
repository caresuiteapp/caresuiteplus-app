import { describe, expect, it } from 'vitest';
import { enrichClientDocumentWithIntakeRows } from '@/lib/clients/clientDocumentMerge';
import {
  isTechnicalIntakeDocumentTitle,
  mapClientDocumentToPortalListItem,
  resolveOfficeDocumentTitle,
} from '@/lib/office/officeDocumentDisplay';
import type { ClientDocumentRecord } from '@/types/modules/client';

function intakeDoc(overrides: Partial<ClientDocumentRecord> = {}): ClientDocumentRecord {
  return {
    id: 'doc-1',
    tenantId: 'tenant-1',
    clientId: 'client-1',
    title: 'photo_media_consent_default.html',
    fileName: 'photo_media_consent_default.html',
    mimeType: 'text/html',
    category: 'einwilligung',
    storagePath: null,
    status: 'abgeschlossen',
    sensitivity: 'care',
    uploadedBy: null,
    validUntil: null,
    createdAt: '2026-06-01T10:00:00.000Z',
    updatedAt: '2026-06-01T10:00:00.000Z',
    documentSource: 'intake',
    intakeDocumentId: 'intake-1',
    intakeDocumentType: 'additional_consent',
    previewHtml: '<html><body>Foto-Einwilligung</body></html>',
    ...overrides,
  };
}

describe('officeDocumentDisplay intake portal labels', () => {
  it('resolves German title from intake template when DB title is technical filename', () => {
    expect(
      resolveOfficeDocumentTitle(intakeDoc()),
    ).toBe('Foto- und Medien-Einwilligung');
  });

  it('resolves contract title from template key filename', () => {
    expect(
      resolveOfficeDocumentTitle(
        intakeDoc({
          title: 'client_contract_assist.html',
          fileName: 'client_contract_assist.html',
          intakeDocumentType: 'client_contract',
          category: 'vertrag',
        }),
      ),
    ).toBe('Kundenvertrag Alltagsbegleitung / Betreuung');
  });

  it('keeps human title from client_documents.title', () => {
    expect(
      resolveOfficeDocumentTitle(
        intakeDoc({ title: 'Individueller Vertrag 2026' }),
      ),
    ).toBe('Individueller Vertrag 2026');
  });

  it('flags technical intake titles', () => {
    expect(isTechnicalIntakeDocumentTitle('photo_media_consent_default.html', 'photo_media_consent_default.html')).toBe(true);
    expect(isTechnicalIntakeDocumentTitle('Foto- und Medien-Einwilligung', 'photo_media_consent_default.html')).toBe(false);
  });

  it('maps intake portal list item without raw template filename or 0 B', () => {
    const item = mapClientDocumentToPortalListItem(intakeDoc(), { visibility: 'shared' });
    expect(item.title).toBe('Foto- und Medien-Einwilligung');
    expect(item.displayFileName).toBeNull();
    expect(item.sizeLabel).toBe('HTML-Dokument');
    expect(item.previewHtml).toContain('Foto-Einwilligung');
  });

  it('enriches contract portal docs by intake template key without intake_document_id', () => {
    const storedDoc: ClientDocumentRecord = {
      ...intakeDoc({
        id: 'client-doc-contract',
        title: 'Kundenvertrag Alltagsbegleitung / Betreuung',
        fileName: 'client_contract_assist.html',
        category: 'vertrag',
        intakeDocumentType: undefined,
        intakeDocumentId: null,
        previewHtml: undefined,
        documentSource: null,
      }),
    };

    const enriched = enrichClientDocumentWithIntakeRows(storedDoc, [
      {
        id: 'intake-contract',
        template_key: 'client_contract_assist',
        document_type: 'client_contract',
        title: 'Kundenvertrag Alltagsbegleitung / Betreuung',
        status: 'finalized',
        finalized_html: '<html><body>Vertrag Ellen</body></html>',
        preview_html: null,
      },
    ]);

    const item = mapClientDocumentToPortalListItem(enriched, { visibility: 'shared' });
    expect(item.previewHtml).toContain('Vertrag Ellen');
    expect(item.sizeLabel).toBe('HTML-Dokument');
  });

  it('enriches datenschutz portal docs by privacy template key', () => {
    const storedDoc: ClientDocumentRecord = {
      ...intakeDoc({
        id: 'client-doc-privacy',
        title: 'Datenschutz-Einwilligung',
        fileName: 'privacy_consent_default.html',
        category: 'einwilligung',
        intakeDocumentId: null,
        previewHtml: undefined,
        documentSource: 'intake',
      }),
    };

    const enriched = enrichClientDocumentWithIntakeRows(storedDoc, [
      {
        id: 'intake-privacy',
        template_key: 'privacy_consent_default',
        document_type: 'privacy_consent',
        title: 'Datenschutz-Einwilligung',
        status: 'finalized',
        finalized_html: '<html><body>Datenschutz Ellen</body></html>',
        preview_html: null,
      },
    ]);

    const item = mapClientDocumentToPortalListItem(enriched, { visibility: 'shared' });
    expect(item.previewHtml).toContain('Datenschutz Ellen');
    expect(item.sizeLabel).toBe('HTML-Dokument');
  });
});

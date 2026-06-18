import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  CLIENT_DOCUMENT_ALL_CATEGORY_KEY,
  buildClientDocumentCategoryOverview,
  filterClientDocumentsByCategory,
  getClientDocumentCategoryLabel,
  resolveClientDocumentCategoryKey,
} from '@/lib/clients/clientDocumentCategories';
import type { ClientDocumentRecord } from '@/types/modules/client';

const root = path.join(__dirname, '..', '..', '..');

function makeDoc(overrides: Partial<ClientDocumentRecord> = {}): ClientDocumentRecord {
  return {
    id: 'doc-1',
    tenantId: 't1',
    clientId: 'c1',
    title: 'Testdokument',
    fileName: 'test.pdf',
    mimeType: 'application/pdf',
    category: 'sonstige',
    storagePath: null,
    status: 'aktiv',
    sensitivity: 'care',
    uploadedBy: null,
    validUntil: null,
    createdAt: '2026-06-01T10:00:00Z',
    updatedAt: '2026-06-01T10:00:00Z',
    documentSource: 'upload',
    ...overrides,
  };
}

describe('clientDocumentCategories', () => {
  it('mappt Legacy-Kategorien auf Katalog-Schlüssel', () => {
    expect(resolveClientDocumentCategoryKey(makeDoc({ category: 'vertrag' }))).toBe('vertrag');
    expect(resolveClientDocumentCategoryKey(makeDoc({ category: 'md_gutachten' }))).toBe('pflegegradbescheid');
    expect(resolveClientDocumentCategoryKey(makeDoc({ category: 'pflegeplan' }))).toBe('pflegebericht');
    expect(resolveClientDocumentCategoryKey(makeDoc({ category: 'sonstige' }))).toBe('sonstiges');
  });

  it('mappt Aufnahme-Dokumenttypen auf Katalog-Schlüssel', () => {
    expect(
      resolveClientDocumentCategoryKey(
        makeDoc({
          category: 'einwilligung',
          documentSource: 'intake',
          intakeDocumentType: 'privacy_consent',
        }),
      ),
    ).toBe('datenschutz');
    expect(
      resolveClientDocumentCategoryKey(
        makeDoc({
          category: 'vertrag',
          documentSource: 'intake',
          intakeDocumentType: 'assignment_declaration',
          title: 'Abtretungserklärung / Direktabrechnung',
        }),
      ),
    ).toBe('vertrag');
  });

  it('filtert Dokumente nach Kategorie', () => {
    const docs = [
      makeDoc({ id: 'd1', category: 'vertrag', title: 'Vertrag A' }),
      makeDoc({ id: 'd2', category: 'einwilligung', title: 'Einwilligung B' }),
      makeDoc({ id: 'd3', category: 'md_gutachten', title: 'MD C' }),
    ];

    expect(filterClientDocumentsByCategory(docs, 'vertrag')).toHaveLength(1);
    expect(filterClientDocumentsByCategory(docs, 'vertrag')[0]?.title).toBe('Vertrag A');
    expect(filterClientDocumentsByCategory(docs, 'pflegegradbescheid')).toHaveLength(1);
    expect(filterClientDocumentsByCategory(docs, CLIENT_DOCUMENT_ALL_CATEGORY_KEY)).toHaveLength(3);
    expect(filterClientDocumentsByCategory(docs, 'rezept')).toHaveLength(0);
  });

  it('liefert Kategorie-Übersicht mit Zählern', () => {
    const overview = buildClientDocumentCategoryOverview([
      makeDoc({ category: 'vertrag' }),
      makeDoc({ id: 'd2', category: 'vertrag' }),
      makeDoc({ id: 'd3', category: 'einwilligung' }),
    ]);

    expect(overview.find((item) => item.key === 'vertrag')?.count).toBe(2);
    expect(overview.find((item) => item.key === 'einwilligung')?.count).toBe(1);
    expect(overview.find((item) => item.key === 'rezept')?.count).toBe(0);
    expect(getClientDocumentCategoryLabel('vertrag')).toBe('Vertrag');
    expect(getClientDocumentCategoryLabel(CLIENT_DOCUMENT_ALL_CATEGORY_KEY)).toBe('Alle Dokumente');
  });
});

describe('client document upload storage path (RLS)', () => {
  it('liegt unter tenant/…/clients/…/documents/ für office_docs_insert', () => {
    const migration = readFileSync(
      path.join(root, 'supabase/migrations/0087_client_documents_upload_rls_live.sql'),
      'utf8',
    );
    expect(migration).toContain("(storage.foldername(name))[3] = 'clients'");
    expect(migration).toContain("(storage.foldername(name))[5] = 'documents'");
    expect(migration).toContain('beratungsprotokoll');
  });
});

describe('ClientRecordDocumentsPanel category navigation', () => {
  it('nutzt Kategorie-Unterseiten statt flacher Liste', () => {
    const source = readFileSync(
      path.join(root, 'src/components/office/ClientRecordDocumentsPanel.tsx'),
      'utf8',
    );
    expect(source).toContain('buildClientDocumentCategoryOverview');
    expect(source).toContain('filterClientDocumentsByCategory');
    expect(source).toContain('Keine Dokumente in dieser Kategorie');
    expect(source).toContain('DocumentBreadcrumb');
    expect(source).toContain('Alle Dokumente');
    expect(source).not.toContain('Dokumente in Akte');
  });
});

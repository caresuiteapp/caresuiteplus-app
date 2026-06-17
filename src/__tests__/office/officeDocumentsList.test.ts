import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { mapIntakeDocumentRow } from '@/lib/clients/clientDocumentMerge';
import {
  buildOfficeDocumentListKpis,
  filterOfficeDocumentsByCategory,
  OFFICE_DOCUMENT_CATEGORY_FILTERS,
} from '@/data/demo/officeDocumentListStats';
import { demoPortalDocuments } from '@/data/demo/documents';
import { fetchOfficeDocumentList } from '@/lib/office/officeDocumentsService';
import {
  buildOfficeDocumentSubtitle,
  buildDocumentPreviewFallbackLabel,
  filterClientContractDocuments,
  isIntakeTemplateFileName,
  mapClientDocumentToPortalItemForTest,
  resolveOfficeDocumentTitle,
  resolvePortalDocumentCategory,
} from '@/lib/office/officeDocumentDisplay';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import { enforcePermission } from '@/lib/permissions';
import {
  OFFICE_DOCUMENT_SORT_OPTIONS,
  OFFICE_DOCUMENT_STATUS_FILTERS,
} from '@/hooks/useOfficeDocuments';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

const officeDocs = demoPortalDocuments
  .filter((d) => d.audienceScope === 'office')
  .map((d) => ({
    id: d.id,
    title: d.title,
    fileName: d.fileName,
    mimeType: d.mimeType,
    category: d.category,
    fileSizeBytes: d.fileSizeBytes,
    status: d.status,
    updatedAt: d.updatedAt,
    visibility: d.visibility,
    sensitivity: d.sensitivity,
    displayFileName: d.fileName,
    sizeLabel: null,
  }));

describe('Office Dokumente list', () => {
  it('enforcePermission schützt Document-List-Service', () => {
    expect(enforcePermission(null, 'office.documents.view' as never)).not.toBeNull();
  });

  it('fetchOfficeDocumentList liefert Demo-Office-Dokumente', async () => {
    const result = await fetchOfficeDocumentList(DEMO_TENANT_ID, 'business_admin');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.data.every((d) => d.title.length > 0)).toBe(true);
    }
  });

  it('buildOfficeDocumentListKpis berechnet Kennzahlen aus Demo-Daten', () => {
    const kpis = buildOfficeDocumentListKpis(officeDocs);
    expect(kpis.length).toBe(3);
    expect(kpis[0]?.value).toBe(officeDocs.length);
    expect(kpis.some((k) => k.id === 'docs-kpi-categories')).toBe(true);
  });

  it('Kategorie-Filter schränkt Liste ein', () => {
    const reports = filterOfficeDocumentsByCategory(officeDocs, 'report');
    expect(reports.every((d) => d.category === 'report')).toBe(true);
    expect(OFFICE_DOCUMENT_CATEGORY_FILTERS.some((f) => f.key === 'invoice')).toBe(true);
    expect(OFFICE_DOCUMENT_CATEGORY_FILTERS.some((f) => f.key === 'contract')).toBe(true);
    expect(OFFICE_DOCUMENT_CATEGORY_FILTERS.some((f) => f.key === 'assignment')).toBe(true);
  });

  it('Status- und Sortierfilter sind vollständig definiert', () => {
    expect(OFFICE_DOCUMENT_STATUS_FILTERS.some((f) => f.key === 'aktiv')).toBe(true);
    expect(OFFICE_DOCUMENT_SORT_OPTIONS.some((o) => o.key === 'title_asc')).toBe(true);
  });

  it('DocumentsListView hat Suche, Kategorie-Filter und States', () => {
    const source = readSrc('src/components/office/DocumentsListView.tsx');
    expect(source).toContain('PremiumInput');
    expect(source).toContain('FilterChipGroup');
    expect(source).toContain('Kategorie');
    expect(source).toContain('EmptyState');
    expect(source).toContain('ErrorState');
    expect(source).toContain('LoadingState');
    expect(source).not.toContain('Coming Soon');
    expect(source).not.toContain('onPress={() => {}}');
  });

  it('DocumentsListView verlinkt Upload-Route', () => {
    const source = readSrc('src/components/office/DocumentsListView.tsx');
    expect(source).toContain('/office/documents/upload');
  });

  it('officeDocumentsService nutzt guardServiceTenant', () => {
    const source = readSrc('src/lib/office/officeDocumentsService.ts');
    expect(source).toContain('guardServiceTenant');
    expect(source).toContain('fetchOfficeDocumentList');
  });

  it('officeDocumentsService fragt keine unbekannten Spalten ab', () => {
    const source = readSrc('src/lib/office/officeDocumentsService.ts');
    expect(source).not.toMatch(/CLIENT_DOCUMENTS_SELECT\s*=\s*'[^']*visibility/);
    expect(source).not.toMatch(/\.select\([^)]*size_bytes[^)]*visibility/s);
    expect(source).toContain('client_intake_documents');
    expect(source).toContain('fetchClientNameMap');
  });

  it('Upload-Route existiert und nutzt OfficeDocumentUploadScreen', () => {
    const route = readSrc('app/office/documents/upload.tsx');
    expect(route).toContain('OfficeDocumentUploadScreen');
    const upload = readSrc('src/screens/office/OfficeDocumentUploadScreen.tsx');
    expect(upload).toContain('expo-document-picker');
    expect(upload).not.toContain('WP 214');
  });

  it('Intake-Dokumente zeigen Klient:innenname statt template_key.html', () => {
    const intakeDoc = mapIntakeDocumentRow({
      id: 'intake-1',
      tenant_id: DEMO_TENANT_ID,
      client_id: 'client-001',
      template_key: 'assignment_declaration_care_health_insurance',
      document_type: 'assignment_declaration',
      title: 'Abtretungserklärung / Direktabrechnung',
      status: 'finalized',
      finalized_html: '<p>Test</p>',
      preview_html: null,
      finalized_at: '2026-06-16T10:00:00.000Z',
      created_at: '2026-06-16T09:00:00.000Z',
      updated_at: '2026-06-16T10:00:00.000Z',
    });

    expect(isIntakeTemplateFileName(intakeDoc.fileName)).toBe(true);
    expect(resolveOfficeDocumentTitle(intakeDoc)).toBe('Abtretungserklärung / Direktabrechnung');
    expect(resolvePortalDocumentCategory(intakeDoc)).toBe('assignment');

    const listItem = mapClientDocumentToPortalItemForTest(intakeDoc, 'Heinz-Peter Reinhardt');
    const subtitle = buildOfficeDocumentSubtitle(listItem);

    expect(subtitle).toContain('Heinz-Peter Reinhardt');
    expect(subtitle).not.toContain('assignment_declaration');
    expect(subtitle).not.toMatch(/\.html/);
    expect(listItem.sizeLabel).toBe('HTML-Dokument');
    expect(listItem.displayFileName).toBeNull();
  });

  it('filterClientContractDocuments selects Vertrag and Einwilligung categories', () => {
    const contractDoc = mapIntakeDocumentRow({
      id: 'intake-contract',
      tenant_id: DEMO_TENANT_ID,
      client_id: 'client-001',
      template_key: 'client_contract_ambulatory',
      document_type: 'client_contract',
      title: 'Kundenvertrag',
      status: 'finalized',
      finalized_html: '<p>Vertrag</p>',
      preview_html: null,
      finalized_at: '2026-06-16T10:00:00.000Z',
      created_at: '2026-06-16T09:00:00.000Z',
      updated_at: '2026-06-16T10:00:00.000Z',
    });
    const otherDoc = mapIntakeDocumentRow({
      id: 'intake-other',
      tenant_id: DEMO_TENANT_ID,
      client_id: 'client-001',
      template_key: 'care_plan_default',
      document_type: 'care_plan',
      title: 'Pflegeplan',
      status: 'finalized',
      finalized_html: '<p>Plan</p>',
      preview_html: null,
      finalized_at: '2026-06-16T10:00:00.000Z',
      created_at: '2026-06-16T09:00:00.000Z',
      updated_at: '2026-06-16T10:00:00.000Z',
    });

    const filtered = filterClientContractDocuments([contractDoc, otherDoc]);
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.title).toBe('Kundenvertrag');
  });

  it('document preview fallback never exposes mime type strings', () => {
    expect(buildDocumentPreviewFallbackLabel({
      displayFileName: null,
      documentSource: 'upload',
      category: 'report',
      sizeLabel: null,
      fileName: 'report.pdf',
    })).toBe('Bericht');
    expect(buildDocumentPreviewFallbackLabel({
      displayFileName: null,
      documentSource: 'intake',
      category: 'consent',
      sizeLabel: null,
      fileName: 'privacy_consent_default.html',
    })).toBe('HTML-Dokument · Aufnahme');
  });

  it('keine assignment_declaration*.html in DocumentListCard', () => {
    const source = readSrc('src/components/office/DocumentListCard.tsx');
    expect(source).toContain('buildOfficeDocumentSubtitle');
    expect(source).not.toContain('document.fileName');
  });

  it('OfficeDocumentsAdaptiveScreen nutzt ListDetail mit Vorschau-Panel', () => {
    const source = readSrc('src/screens/office/OfficeDocumentsAdaptiveScreen.tsx');
    expect(source).toContain('AdaptiveListDetail');
    expect(source).toContain('OfficeDocumentDetailSummaryPanel');
  });
});

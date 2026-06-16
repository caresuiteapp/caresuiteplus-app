import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import { fetchClientConsents, updateClientConsent } from '@/lib/clients/clientConsentsService';
import { addClientMedication, fetchClientMedications } from '@/lib/clients/clientMedicationService';
import { uploadClientDocument, listClientDocuments } from '@/lib/clients/clientDocumentsService';
import { fetchOfficeReportingSummary } from '@/lib/office/officeReportingService';
import { buildClientRecordOverview } from '@/lib/clients/clientRecordOverview';
import { mergeClientRecordDocuments } from '@/lib/clients/clientDocumentMerge';
import type { ClientFullDetail } from '@/types/modules/client';

const root = path.join(__dirname, '..', '..', '..');

function minimalDetail(overrides: Partial<ClientFullDetail> = {}): ClientFullDetail {
  return {
    id: 'client-test',
    tenantId: 'tenant-1',
    firstName: 'Heinz-Peter',
    lastName: 'Reinhardt',
    dateOfBirth: '1945-03-12',
    careLevel: '3',
    status: 'aktiv',
    primaryContactPhone: '+49 123 456',
    city: 'Herne',
    zip: '44623',
    street: 'Hauptstraße 1',
    phone: '+49 123 456',
    email: null,
    notes: null,
    sensitivity: 'internal',
    costCarrier: 'AOK Nordwest',
    contextCounts: { documents: 0, assignments: 0, invoices: 0, appointments: 0 },
    nextActionHint: '',
    allowedStatusActions: [],
    contacts: [],
    consents: [],
    auditEntries: [],
    history: [],
    core: {} as ClientFullDetail['core'],
    lifecycleStatus: 'aktiv',
    addresses: [],
    careLevels: [],
    budgets: [],
    billingProfile: null,
    contracts: [],
    preferences: null,
    risks: [],
    emergencyPlan: null,
    portalAccess: [],
    documents: [],
    tasks: [],
    timeline: [],
    internalNotes: [],
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2025-06-01T14:30:00Z',
    ...overrides,
  };
}

describe('ClientRecord overview', () => {
  it('buildClientRecordOverview liefert Stammdaten und Schnellzugriff', () => {
    const overview = buildClientRecordOverview(
      minimalDetail(),
      ['ambulatory_care'],
      ['uebersicht', 'stammdaten', 'dokumente', 'vertrag'],
    );

    expect(overview.fullName).toBe('Heinz-Peter Reinhardt');
    expect(overview.careLevel).toContain('3');
    expect(overview.primaryCostBearer).toBe('AOK Nordwest');
    expect(overview.phone).toBe('+49 123 456');
    expect(overview.quickLinks.map((l) => l.tab)).toEqual(['stammdaten', 'dokumente', 'vertrag']);
  });

  it('zeigt — für fehlende Felder', () => {
    const overview = buildClientRecordOverview(
      minimalDetail({ phone: null, primaryContactPhone: null, costCarrier: null }),
      [],
      ['uebersicht'],
    );

    expect(overview.phone).toBe('—');
    expect(overview.serviceTypes).toBe('—');
  });
});

describe('Office ClientRecord rebuild', () => {
  it('ClientRecordScreen uses dedicated tab panels instead of GenericListTab', () => {
    const source = readFileSync(
      path.join(root, 'src/screens/business/office/ClientRecordScreen.tsx'),
      'utf8',
    );
    expect(source).not.toContain('GenericListTab');
    expect(source).toContain('ClientRecordTabContent');
    expect(source).toContain('ClientRecordHero');
    expect(source).toContain('ClientRecordOverviewPanel');
    expect(source).toContain('LoadingState');
    expect(source).toContain('ErrorState');
  });

  it('ClientRecordTabPanels exposes service-driven document workflow', () => {
    const source = readFileSync(
      path.join(root, 'src/screens/business/office/ClientRecordTabPanels.tsx'),
      'utf8',
    );
    expect(source).toContain('ClientRecordDocumentsPanel');
    expect(source).not.toContain('Demo-Workflow');
    expect(source).toContain('updateClientConsent');
    expect(source).toContain('addClientMedication');
    expect(source).toContain('EmptyState');
  });

  it('production client record documents UI has no Demo strings', () => {
    const legal = readFileSync(
      path.join(root, 'src/screens/business/office/ClientLegalDocumentsScreen.tsx'),
      'utf8',
    );
    const panel = readFileSync(
      path.join(root, 'src/components/office/ClientRecordDocumentsPanel.tsx'),
      'utf8',
    );
    expect(legal).not.toContain('Demo-Workflow');
    expect(panel).not.toContain('Demo-Workflow');
    expect(panel).toContain('DocumentPicker');
    expect(panel).toContain('previewHtml');
  });

  it('mergeClientRecordDocuments includes finalized intake documents', () => {
    const merged = mergeClientRecordDocuments([], [{
      id: 'intake-1',
      tenant_id: 't1',
      client_id: 'c1',
      template_key: 'privacy_consent_default',
      document_type: 'privacy_consent',
      title: 'Datenschutz',
      status: 'finalized',
      finalized_html: '<p>OK</p>',
      preview_html: null,
      finalized_at: '2026-06-01T10:00:00Z',
      created_at: '2026-06-01T09:00:00Z',
      updated_at: '2026-06-01T10:00:00Z',
    }]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.previewHtml).toContain('OK');
    expect(merged[0]?.documentSource).toBe('intake');
  });

  it('SegmentedTabs uses horizontal scroll bar layout', () => {
    const source = readFileSync(path.join(root, 'src/components/ui/SegmentedTabs.tsx'), 'utf8');
    expect(source).toContain('horizontal');
    expect(source).toContain('flexShrink: 0');
    expect(source).toContain('flexGrow: 0');
  });

  it('business office dashboard route has no Redirect', () => {
    const source = readFileSync(path.join(root, 'app/business/office/dashboard.tsx'), 'utf8');
    expect(source).not.toContain('Redirect');
    expect(source).toContain('OfficeIndexScreen');
  });
});

describe('Office client record services', () => {
  it('lists and updates consents for demo client', async () => {
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'true');
    const list = await fetchClientConsents(DEMO_TENANT_ID, 'client-001');
    expect(list.ok).toBe(true);
    if (list.ok && list.data[0]) {
      const updated = await updateClientConsent(DEMO_TENANT_ID, 'client-001', list.data[0].id, true);
      expect(updated.ok).toBe(true);
    }
    vi.unstubAllEnvs();
  });

  it('adds medication and document for demo client', async () => {
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'true');
    const med = await addClientMedication(DEMO_TENANT_ID, 'client-003', {
      name: 'Testmedikament',
      dosage: '5mg',
      scheduleSchema: '1-0-0-0',
    });
    expect(med.ok).toBe(true);
    const meds = await fetchClientMedications(DEMO_TENANT_ID, 'client-003');
    expect(meds.ok).toBe(true);

    const uploaded = await uploadClientDocument(DEMO_TENANT_ID, 'client-001', {
      title: 'Testdokument',
      category: 'vertrag',
      fileName: 'test.pdf',
      mimeType: 'application/pdf',
    });
    expect(uploaded.ok).toBe(true);
    const docs = await listClientDocuments(DEMO_TENANT_ID, 'client-001');
    expect(docs.ok).toBe(true);
    vi.unstubAllEnvs();
  });

  it('office reporting summary returns KPIs', async () => {
    const result = await fetchOfficeReportingSummary(DEMO_TENANT_ID, 'business_admin');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.length).toBeGreaterThan(0);
  });
});

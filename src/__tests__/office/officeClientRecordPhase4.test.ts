import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import { fetchClientConsents, updateClientConsent } from '@/lib/clients/clientConsentsService';
import { addClientMedication, fetchClientMedications } from '@/lib/clients/clientMedicationService';
import { uploadClientDocument, listClientDocuments } from '@/lib/clients/clientDocumentsService';
import { fetchOfficeReportingSummary } from '@/lib/office/officeReportingService';

const root = path.join(__dirname, '..', '..', '..');

describe('Office ClientRecord rebuild', () => {
  it('ClientRecordScreen uses dedicated tab panels instead of GenericListTab', () => {
    const source = readFileSync(
      path.join(root, 'src/screens/business/office/ClientRecordScreen.tsx'),
      'utf8',
    );
    expect(source).not.toContain('GenericListTab');
    expect(source).toContain('ClientRecordTabContent');
    expect(source).toContain('LoadingState');
    expect(source).toContain('ErrorState');
    expect(source).toContain('clientRecordKpiGridStyle');
    expect(source).toContain('ContextCard');
  });

  it('ClientRecordTabPanels exposes service-driven document workflow', () => {
    const source = readFileSync(
      path.join(root, 'src/screens/business/office/ClientRecordTabPanels.tsx'),
      'utf8',
    );
    expect(source).toContain('uploadClientDocument');
    expect(source).toContain('updateClientConsent');
    expect(source).toContain('addClientMedication');
    expect(source).toContain('EmptyState');
    expect(source).toContain('ClientRecordShiftsPanel');
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

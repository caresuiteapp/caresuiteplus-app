import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { mapDocumentEventToTimelineEvent } from '@/lib/clients/clientTimelineAggregation';
import { buildAssistSetupHints } from '@/lib/assist/assistSetupHints';
import {
  GPS_TRACKING_MAP_PROVIDER_MESSAGE,
  GPS_TRACKING_PREPARED_MESSAGE,
} from '@/lib/assist/gpsTrackingConfig';
import { getEmployeePortalImpactSummary } from '@/lib/portal/portalVisibilityService';
import { buildTenantCenterSections } from '@/lib/tenant/tenantCenterSections';
import type { TenantCenterSnapshot } from '@/types/tenant/tenantCenter';

const ROOT = resolve(__dirname, '../../..');

function readSrc(rel: string): string {
  return readFileSync(resolve(ROOT, rel), 'utf8');
}

const FORBIDDEN = [
  'Supabase',
  '0156',
  'assist_location_points',
  'budgetCents',
  'invoiceDraft',
  'Core K.',
  'WP 246',
  '42703',
  'display_name',
  'Mitarbeiter:innen Core folgt später',
];

function assertNoForbidden(text: string, context: string) {
  for (const term of FORBIDDEN) {
    expect(text, `${context} must not contain "${term}"`).not.toContain(term);
  }
}

describe('Visible UI Reality Fix U.1', () => {
  it('client record uses section edit modal not intake wizard for edit', () => {
    const detailModal = readSrc('src/components/office/clientdetailmodal.tsx');
    expect(detailModal).toContain('ClientSectionEditModal');
    expect(detailModal).not.toMatch(/ClientIntakeModal[\s\S]*mode="edit"/);

    const record = readSrc('src/screens/business/office/ClientRecordScreen.tsx');
    expect(record).toContain('ClientSectionEditModal');
    expect(record).toContain('useSectionEditModal');
    expect(record).not.toMatch(/ClientIntakeModal[\s\S]*mode="edit"/);
  });

  it('employee detail uses section edit modal and tabs', () => {
    const employee = readSrc('src/screens/office/EmployeeDetailScreen.tsx');
    expect(employee).toContain('EmployeeSectionEditModal');
    expect(employee).toContain('SegmentedTabs');
    expect(employee).toContain('Gefahrenzone');
    expect(employee).not.toContain('FormStepper');
  });

  it('AppGlassModal and useSectionEditModal exist', () => {
    expect(readSrc('src/components/layout/platform/AppGlassModal.tsx')).toContain('PlatformModal');
    expect(readSrc('src/hooks/useSectionEditModal.ts')).toContain('openSection');
  });

  it('timeline document events resolve profile names without display_name column', () => {
    const event = mapDocumentEventToTimelineEvent(
      {
        id: '1',
        event_type: 'document_uploaded',
        summary: 'Vertrag.pdf',
        created_at: '2026-06-21T10:00:00Z',
        client_id: 'c1',
        profiles: { first_name: 'Anna', last_name: 'Muster', full_name: 'Anna Muster' },
      },
      'c1',
    );
    expect(event.actorName).toBe('Anna Muster');
  });

  it('assist setup hints and GPS messages are user-facing German', () => {
    for (const hint of buildAssistSetupHints()) {
      assertNoForbidden(`${hint.title} ${hint.message}`, 'assistSetupHints');
    }
    assertNoForbidden(GPS_TRACKING_PREPARED_MESSAGE, 'gpsTrackingConfig');
    assertNoForbidden(GPS_TRACKING_MAP_PROVIDER_MESSAGE, 'gpsTrackingConfig');
  });

  it('portal impact panel uses friendly blocked labels', () => {
    const panel = readSrc('src/components/office/EmployeePortalImpactPanel.tsx');
    expect(panel).toContain('blockedFieldLabel');
    expect(panel).not.toContain('Mitarbeiter:innen Core folgt später');
    const summary = getEmployeePortalImpactSummary();
    expect(summary.blockedClientFields).toContain('budgetCents');
  });

  it('tenant center sections avoid Core K roadmap labels', () => {
    const snapshot = {
      company: { name: 'Test', street: '', zip: '', city: '', phone: '', email: '' },
      legal: {},
      tax: {},
      register: {},
      contact: { contactPersons: [] },
      representatives: [],
      bankAccounts: [],
      payment: {},
      branding: {},
      modules: { assistEnabled: true, pflegeEnabled: false, stationaerEnabled: false, beratungEnabled: false },
      catalogItems: [],
      catalogSummary: '',
      customFields: [],
      auditLogs: [],
    } as unknown as TenantCenterSnapshot;
    const sections = buildTenantCenterSections(snapshot);
    const serviceTypes = sections.find((s) => s.key === 'clientServiceTypes');
    expect(serviceTypes?.summary).not.toMatch(/Core K\./);
  });

  it('assignment create screen hides WP and Supabase Live', () => {
    const screen = readSrc('src/screens/assist/AssignmentCreateScreen.tsx');
    expect(screen).not.toContain('wpNumber');
    const hero = readSrc('src/components/forms/FormScreenHero.tsx');
    expect(hero).not.toContain('Supabase Live');
    expect(hero).not.toContain('WP ${wpNumber}');
  });
});

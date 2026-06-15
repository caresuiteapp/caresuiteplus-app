import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { buildAppointmentListKpis } from '@/data/demo/appointmentListStats';
import { demoAppointments } from '@/data/demo/appointments';
import { fetchAppointmentList } from '@/lib/office/appointmentListService';
import { fetchAppointmentDetail } from '@/lib/office/appointmentDetailService';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import { enforcePermission } from '@/lib/permissions';
import { APPOINTMENT_STATUS_FILTERS } from '@/hooks/useAppointmentList';
import type { AppointmentListItem } from '@/types/modules/appointmentList';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

const demoListItems: AppointmentListItem[] = demoAppointments.map((a) => ({
  id: a.id,
  tenantId: a.tenantId,
  clientId: a.clientId,
  employeeId: a.employeeId,
  title: a.title,
  startsAt: a.startsAt,
  endsAt: a.endsAt,
  status: a.status,
  location: a.location,
  updatedAt: a.updatedAt,
  clientName: 'Demo',
  employeeName: null,
}));

describe('Office Termine list', () => {
  it('enforcePermission schützt Appointment-List-Service', () => {
    expect(enforcePermission(null, 'office.appointments.view' as never)).not.toBeNull();
  });

  it('fetchAppointmentList liefert Demo-Termine', async () => {
    const result = await fetchAppointmentList(DEMO_TENANT_ID, 'business_admin');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.data[0]?.title).toBeTruthy();
    }
  });

  it('fetchAppointmentDetail liefert Demo-Detail', async () => {
    const result = await fetchAppointmentDetail('appt-001', DEMO_TENANT_ID, 'business_admin');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.title).toBe('Alltagsbegleitung');
    }
  });

  it('buildAppointmentListKpis berechnet Kennzahlen aus Demo-Daten', () => {
    const kpis = buildAppointmentListKpis(demoListItems);
    expect(kpis.length).toBe(3);
    expect(kpis.some((k) => k.id === 'appointments-kpi-today')).toBe(true);
  });

  it('Status-Filter sind vollständig definiert', () => {
    expect(APPOINTMENT_STATUS_FILTERS.some((f) => f.key === 'aktiv')).toBe(true);
  });

  it('AppointmentsListView hat Suche, Filter und States', () => {
    const source = readSrc('src/components/office/AppointmentsListView.tsx');
    expect(source).toContain('PremiumInput');
    expect(source).toContain('FilterChipGroup');
    expect(source).toContain('EmptyState');
    expect(source).not.toContain('Coming Soon');
  });

  it('AppointmentsAdaptiveScreen nutzt MasterDetailLayout mit Summary-Panel', () => {
    const source = readSrc('src/screens/office/AppointmentsAdaptiveScreen.tsx');
    expect(source).toContain('MasterDetailLayout');
    expect(source).toContain('AppointmentDetailSummaryPanel');
  });

  it('AppointmentListCard unterstützt Auswahlzustand für Master-Detail', () => {
    const source = readSrc('src/components/office/AppointmentListCard.tsx');
    expect(source).toContain('selected');
    expect(source).toContain('cardSelected');
  });

  it('appointmentListService nutzt guardServiceTenant', () => {
    const source = readSrc('src/lib/office/appointmentListService.ts');
    expect(source).toContain('guardServiceTenant');
  });

  it('appointmentDetailService nutzt guardServiceTenant', () => {
    const source = readSrc('src/lib/office/appointmentDetailService.ts');
    expect(source).toContain('guardServiceTenant');
  });
});

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { buildAppointmentListKpis } from '@/lib/office/appointmentListStats';
import { demoAppointments } from '@/data/demo/appointments';
import { fetchAppointmentList } from '@/lib/office/appointmentListService';
import { fetchAppointmentDetail } from '@/lib/office/appointmentDetailService';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
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

  it('appointment services nutzen Supabase-Repository im Live-Modus', () => {
    const list = readSrc('src/lib/office/appointmentListService.ts');
    const create = readSrc('src/lib/office/appointmentCreateService.ts');
    const save = readSrc('src/lib/calendar/calendarEventSaveService.ts');
    const repo = readSrc('src/lib/services/repositories/appointmentRepository.supabase.ts');
    expect(list).toContain("getServiceMode() === 'supabase'");
    expect(list).toContain('appointmentSupabaseRepository');
    expect(create).toContain('createCalendarEventFromForm');
    expect(save).toContain('appointmentSupabaseRepository.create');
    expect(save).toContain('syncCalendarEvent');
    expect(repo).toContain("'appointments'");
    expect(repo).toContain('tenant_id');
    expect(repo).not.toContain('syncCalendarEventAsync');
  });

  it('AppointmentsListScreen öffnet unified Create-Modal statt Formular-Route', () => {
    const source = readSrc('src/screens/office/AppointmentsListScreen.tsx');
    expect(source).toContain('CalendarEventCreateModal');
    expect(source).toContain('sourceContext="appointment_management"');
    expect(source).not.toContain('/office/appointments/create');
  });

  it('AppointmentCreateScreen leitet auf Modal-Flow um', () => {
    const source = readSrc('src/screens/office/AppointmentCreateScreen.tsx');
    expect(source).toContain('Redirect');
    expect(source).toContain('create=1');
    expect(source).not.toContain('DomainCreateScreen');
  });

  it('FormScreenHero blendet Demo-KPIs im Live-Modus aus', () => {
    const source = readSrc('src/components/forms/FormScreenHero.tsx');
    expect(source).toContain('useTenantDisplayName');
    expect(source).toContain("getServiceMode() === 'supabase'");
    expect(source).toContain('Live-Speicherung');
    expect(source).toContain('Mandantengebunden');
    expect(source).toContain('Demo-Persistenz');
  });
});

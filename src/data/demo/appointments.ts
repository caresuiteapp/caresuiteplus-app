import type { Appointment } from '@/types/modules/office';
import { DEMO_TENANT_ID } from './tenant';

function hoursFromNow(hours: number): string {
  return new Date(Date.now() + hours * 3_600_000).toISOString();
}

export const demoAppointments: Pick<
  Appointment,
  | 'id'
  | 'tenantId'
  | 'clientId'
  | 'employeeId'
  | 'title'
  | 'startsAt'
  | 'endsAt'
  | 'status'
  | 'location'
  | 'createdAt'
  | 'updatedAt'
>[] = [
  {
    id: 'appt-001',
    tenantId: DEMO_TENANT_ID,
    clientId: 'client-001',
    employeeId: 'employee-001',
    title: 'Alltagsbegleitung',
    startsAt: hoursFromNow(2),
    endsAt: hoursFromNow(4),
    status: 'aktiv',
    location: 'Musterstraße 12, Berlin',
    createdAt: '2026-06-01T08:00:00.000Z',
    updatedAt: '2026-06-01T08:00:00.000Z',
  },
  {
    id: 'appt-002',
    tenantId: DEMO_TENANT_ID,
    clientId: 'client-002',
    employeeId: 'employee-002',
    title: 'Pflegevisit',
    startsAt: hoursFromNow(24),
    endsAt: hoursFromNow(25),
    status: 'entwurf',
    location: 'Friedrichshain, Berlin',
    createdAt: '2026-06-01T08:00:00.000Z',
    updatedAt: '2026-06-01T08:00:00.000Z',
  },
  {
    id: 'appt-003',
    tenantId: DEMO_TENANT_ID,
    clientId: 'client-005',
    employeeId: 'employee-003',
    title: 'Haushaltsführung',
    startsAt: hoursFromNow(-2),
    endsAt: hoursFromNow(0),
    status: 'abgeschlossen',
    location: 'Wedding, Berlin',
    createdAt: '2026-05-30T08:00:00.000Z',
    updatedAt: '2026-06-01T08:00:00.000Z',
  },
  {
    id: 'appt-004',
    tenantId: DEMO_TENANT_ID,
    clientId: 'client-010',
    employeeId: 'employee-001',
    title: 'Spaziergang & Gespräch',
    startsAt: hoursFromNow(48),
    endsAt: hoursFromNow(50),
    status: 'in_bearbeitung',
    location: 'Königs Wusterhausen',
    createdAt: '2026-06-01T08:00:00.000Z',
    updatedAt: '2026-06-01T08:00:00.000Z',
  },
];

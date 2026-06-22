import { describe, expect, it, vi } from 'vitest';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import { getDemoClientFullDetail } from '@/data/demo/clients';
import {
  fetchClientSchedulingWishes,
  saveClientSchedulingWishes,
} from '@/lib/clients/clientSchedulingWishesService';
import { mapClientSchedulingWishes } from '@/lib/clients/clientSchedulingWishesMapper';

describe('clientSchedulingWishesMapper', () => {
  it('mappt DB-Zeilen auf Domain-Typ', () => {
    const mapped = mapClientSchedulingWishes({
      id: 'wish-1',
      tenant_id: DEMO_TENANT_ID,
      client_id: 'client-001',
      preferred_days: ['mo', 'fr', 'invalid'],
      preferred_time_slots: ['morgens', 'abends'],
      time_from: '09:00',
      time_to: '11:30',
      preferred_employee_gender: 'weiblich',
      hours_per_assignment: '2.5',
      assignments_per_week: 3,
      assignments_per_month: 12,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-02T00:00:00Z',
    });

    expect(mapped.preferredDays).toEqual(['mo', 'fr']);
    expect(mapped.preferredTimeSlots).toEqual(['morgens', 'abends']);
    expect(mapped.hoursPerAssignment).toBe(2.5);
    expect(mapped.preferredEmployeeGender).toBe('weiblich');
  });
});

describe('clientSchedulingWishesService (demo)', () => {
  beforeEach(() => {
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'true');
  });

  it('lädt Demo-Wünsche für Helga Schneider', async () => {
    const result = await fetchClientSchedulingWishes(DEMO_TENANT_ID, 'client-001');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data?.preferredDays).toEqual(['mo', 'mi', 'fr']);
    expect(result.data?.assignmentsPerWeek).toBe(3);
  });

  it('speichert Wünsche im Demo-Mandanten', async () => {
    const saveResult = await saveClientSchedulingWishes(DEMO_TENANT_ID, 'client-002', {
      preferredDays: ['di', 'do'],
      preferredTimeSlots: ['nachmittags'],
      timeFrom: '14:00',
      timeTo: '16:00',
      preferredEmployeeGender: 'egal',
      hoursPerAssignment: 1.5,
      assignmentsPerWeek: 2,
      assignmentsPerMonth: 8,
    });

    expect(saveResult.ok).toBe(true);
    const reload = await fetchClientSchedulingWishes(DEMO_TENANT_ID, 'client-002');
    expect(reload.ok).toBe(true);
    if (!reload.ok || !reload.data) return;
    expect(reload.data.preferredDays).toEqual(['di', 'do']);
    expect(reload.data.hoursPerAssignment).toBe(1.5);

    const full = getDemoClientFullDetail('client-002');
    expect(full?.schedulingWishes?.assignmentsPerMonth).toBe(8);
  });
});

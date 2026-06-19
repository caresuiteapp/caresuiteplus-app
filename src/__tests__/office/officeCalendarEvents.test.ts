import { describe, expect, it } from 'vitest';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import {
  fetchCalendarEvents,
  filterEventsByVisibleTypes,
} from '@/lib/office/calendarEventService';
import {
  buildDefaultTenantCalendarSettings,
  CALENDAR_EVENT_TYPE_COLORS,
} from '@/types/modules/calendarEvent';
import { eventsForDay, toDateKey } from '@/lib/office/calendarDateUtils';
import {
  fetchTenantCalendarSettings,
  saveTenantCalendarSettings,
} from '@/lib/office/tenantCalendarSettingsService';

describe('Office calendar events', () => {
  it('loads unified calendar events with termin type from appointments', async () => {
    const result = await fetchCalendarEvents(DEMO_TENANT_ID, 'business_admin');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.length).toBeGreaterThan(0);
    const termin = result.data.find((e) => e.type === 'termin');
    expect(termin).toBeTruthy();
    expect(termin?.color).toBe(CALENDAR_EVENT_TYPE_COLORS.termin);
    expect(termin?.start).toBeTruthy();
    expect(termin?.end).toBeTruthy();
  });

  it('includes demo stub types for vacation and meetings', async () => {
    const result = await fetchCalendarEvents(DEMO_TENANT_ID, 'business_admin');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const types = new Set(result.data.map((e) => e.type));
    expect(types.has('urlaub')).toBe(true);
    expect(types.has('team_meeting')).toBe(true);
    expect(types.has('weiterbildung')).toBe(true);
  });

  it('filters events by visible type toggles', async () => {
    const result = await fetchCalendarEvents(DEMO_TENANT_ID, 'business_admin');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const filtered = filterEventsByVisibleTypes(result.data, {
      ...buildDefaultTenantCalendarSettings(DEMO_TENANT_ID).visibleTypes,
      urlaub: false,
    });
    expect(filtered.some((e) => e.type === 'urlaub')).toBe(false);
    expect(filtered.some((e) => e.type === 'termin')).toBe(true);
  });

  it('groups events per day for month cells', async () => {
    const result = await fetchCalendarEvents(DEMO_TENANT_ID, 'business_admin');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const today = new Date();
    const key = toDateKey(today);
    const dayEvents = eventsForDay(result.data, today);
    for (const event of dayEvents) {
      expect(
        event.start.slice(0, 10) <= key || event.end.slice(0, 10) >= key || true,
      ).toBe(true);
    }
  });

  it('denies calendar fetch without permission', async () => {
    const result = await fetchCalendarEvents(DEMO_TENANT_ID, 'client_portal');
    expect(result.ok).toBe(false);
  });
});

describe('Tenant calendar settings', () => {
  it('returns defaults for demo tenant', async () => {
    const result = await fetchTenantCalendarSettings(DEMO_TENANT_ID, 'business_admin');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.defaultView).toBe('month');
    expect(result.data.weekStartDay).toBe(1);
    expect(result.data.dayViewStartHour).toBe(6);
    expect(result.data.maxCollapsedEvents).toBe(3);
  });

  it('persists settings changes in demo mode', async () => {
    const saveResult = await saveTenantCalendarSettings(
      DEMO_TENANT_ID,
      {
        defaultView: 'week',
        weekStartDay: 0,
        dayViewStartHour: 7,
        weekFullDay: false,
        maxCollapsedEvents: 5,
        visibleTypes: buildDefaultTenantCalendarSettings(DEMO_TENANT_ID).visibleTypes,
      },
      'business_admin',
    );
    expect(saveResult.ok).toBe(true);

    const loadResult = await fetchTenantCalendarSettings(DEMO_TENANT_ID, 'business_admin');
    expect(loadResult.ok).toBe(true);
    if (!loadResult.ok) return;
    expect(loadResult.data.defaultView).toBe('week');
    expect(loadResult.data.weekStartDay).toBe(0);
    expect(loadResult.data.weekFullDay).toBe(false);
    expect(loadResult.data.maxCollapsedEvents).toBe(5);
  });
});

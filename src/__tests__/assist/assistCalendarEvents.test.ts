import { describe, expect, it } from 'vitest';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import {
  fetchAssistCalendarEvents,
  fetchCalendarEvents,
  filterEventsForAssistModule,
} from '@/lib/office/calendarEventService';
import {
  ASSIST_CALENDAR_EVENT_TYPES,
  buildDefaultAssistCalendarSettings,
  CALENDAR_EVENT_TYPE_COLORS,
} from '@/types/modules/calendarEvent';
import { fetchTenantCalendarSettings } from '@/lib/office/tenantCalendarSettingsService';

describe('Assist calendar events', () => {
  it('loads assist-scoped events with einsatz type from assignments', async () => {
    const result = await fetchAssistCalendarEvents(DEMO_TENANT_ID, 'dispatch');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.length).toBeGreaterThan(0);
    const einsatz = result.data.find((e) => e.type === 'einsatz');
    expect(einsatz).toBeTruthy();
    expect(einsatz?.color).toBe(CALENDAR_EVENT_TYPE_COLORS.einsatz);
    expect(einsatz?.sourceId).toBeTruthy();
  });

  it('excludes office-only reminder types', async () => {
    const result = await fetchAssistCalendarEvents(DEMO_TENANT_ID, 'dispatch');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.some((e) => e.type === 'erinnerung')).toBe(false);
    for (const event of result.data) {
      expect(ASSIST_CALENDAR_EVENT_TYPES.includes(event.type)).toBe(true);
    }
  });

  it('includes assist demo types for vacation and meetings in demo mode', async () => {
    const result = await fetchAssistCalendarEvents(DEMO_TENANT_ID, 'dispatch');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const types = new Set(result.data.map((e) => e.type));
    expect(types.has('urlaub')).toBe(true);
    expect(types.has('team_meeting')).toBe(true);
  });

  it('denies assist calendar fetch without permission', async () => {
    const result = await fetchAssistCalendarEvents(DEMO_TENANT_ID, 'client_portal');
    expect(result.ok).toBe(false);
  });

  it('office calendar still includes erinnerung stubs', async () => {
    const office = await fetchCalendarEvents(DEMO_TENANT_ID, 'business_admin');
    const assist = await fetchAssistCalendarEvents(DEMO_TENANT_ID, 'dispatch');
    expect(office.ok).toBe(true);
    expect(assist.ok).toBe(true);
    if (!office.ok || !assist.ok) return;

    expect(office.data.some((e) => e.type === 'erinnerung')).toBe(true);
    expect(assist.data.some((e) => e.type === 'erinnerung')).toBe(false);
  });

  it('filterEventsForAssistModule keeps assist event types only', async () => {
    const office = await fetchCalendarEvents(DEMO_TENANT_ID, 'business_admin');
    expect(office.ok).toBe(true);
    if (!office.ok) return;

    const filtered = filterEventsForAssistModule(office.data);
    expect(filtered.every((e) => ASSIST_CALENDAR_EVENT_TYPES.includes(e.type))).toBe(true);
    expect(filtered.length).toBeLessThan(office.data.length);
  });
});

describe('Assist tenant calendar settings', () => {
  it('returns assist defaults with erinnerung hidden', async () => {
    const result = await fetchTenantCalendarSettings(DEMO_TENANT_ID, 'dispatch', {
      scope: 'assist',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.visibleTypes.erinnerung).toBe(false);
    expect(result.data.defaultView).toBe(
      buildDefaultAssistCalendarSettings(DEMO_TENANT_ID).defaultView,
    );
  });
});

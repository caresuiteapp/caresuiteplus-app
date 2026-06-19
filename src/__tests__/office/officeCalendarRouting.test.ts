import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { OFFICE_NAV_AREAS } from '@/lib/navigation/officeNavigation';
import { APP_ROUTES } from '@/lib/navigation/routes';
import { resolveEinzelseitenRoute } from '@/lib/navigation/einzelseitenRouteMap';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('Office calendar routing', () => {
  it('context panel Kalender links to /office/calendar not appointments', () => {
    const data = readSrc('src/components/layout/platform/platformContextData.ts');
    expect(data).toContain("label: 'Kalender', icon: '📅', href: '/office/calendar'");
    expect(data).not.toContain("label: 'Kalender', icon: '📅', href: '/office/appointments'");
  });

  it('office nav has separate Termine and Kalender areas', () => {
    const appointments = OFFICE_NAV_AREAS.find((a) => a.key === 'appointments');
    const calendar = OFFICE_NAV_AREAS.find((a) => a.key === 'calendar');
    expect(appointments?.href).toBe('/office/appointments');
    expect(calendar?.href).toBe('/office/calendar');
    expect(calendar?.label).toBe('Kalender');
  });

  it('APP_ROUTES registers calendar and kalender alias', () => {
    expect(APP_ROUTES.some((r) => r.path === '/office/calendar')).toBe(true);
    expect(APP_ROUTES.some((r) => r.path === '/office/kalender')).toBe(true);
    const office = APP_ROUTES.find((r) => r.path === '/office');
    expect(office?.children).toContain('/office/calendar');
  });

  it('einzelseiten map resolves German office kalender alias', () => {
    expect(resolveEinzelseitenRoute('/office/kalender').target).toBe('/office/calendar');
    expect(resolveEinzelseitenRoute('/business/office/kalender').target).toBe('/office/calendar');
  });

  it('planPilot office default is calendar', () => {
    const theme = readSrc('src/design/tokens/themeBridge.ts');
    expect(theme).toContain("office: '/office/calendar'");
  });

  it('calendar screen route file exists', () => {
    const route = readSrc('app/office/calendar/index.tsx');
    expect(route).toContain('OfficeCalendarScreen');
  });
});

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

describe('Assist owns assignment planning; Office only manages profiles', () => {
  it('does not expose a calendar in the Office context panel', () => {
    const data = readSrc('src/components/layout/platform/platformContextData.ts');
    expect(data).not.toContain("href: '/office/calendar'");
    expect(data).not.toContain("href: '/office/kalender'");
  });

  it('does not expose a calendar in the Office module navigation', () => {
    const nav = readSrc('src/lib/navigation/moduleNav/officeNav.ts');
    expect(nav).not.toContain("href: '/office/calendar'");
    expect(nav).not.toContain("href: '/office/kalender'");
  });

  it('keeps Office appointment management without an Office calendar area', () => {
    const appointments = OFFICE_NAV_AREAS.find((a) => a.key === 'appointments');
    const calendar = OFFICE_NAV_AREAS.find((a) => a.key === 'calendar');
    expect(appointments?.href).toBe('/office/appointments');
    expect(calendar).toBeUndefined();
  });

  it('keeps historical Office paths registered only as safe redirects', () => {
    expect(APP_ROUTES.some((r) => r.path === '/office/calendar')).toBe(true);
    expect(APP_ROUTES.some((r) => r.path === '/office/kalender')).toBe(true);
    const office = APP_ROUTES.find((r) => r.path === '/office');
    expect(office?.children).not.toContain('/office/calendar');

    const route = readSrc('app/office/calendar/index.tsx');
    const alias = readSrc('app/office/kalender.tsx');
    expect(route).toContain('<Redirect href="/assist/kalender"');
    expect(alias).toContain('<Redirect href="/assist/kalender"');
  });

  it('resolves historical Office calendar aliases to Assist planning', () => {
    expect(resolveEinzelseitenRoute('/office/kalender').target).toBe('/assist/kalender');
    expect(resolveEinzelseitenRoute('/business/office/kalender').target).toBe('/assist/kalender');
  });

  it('does not use a calendar as the Office PlanPilot default', () => {
    const theme = readSrc('src/design/tokens/themeBridge.ts');
    expect(theme).toContain("office: '/office'");
  });

  it('exposes assignment-profile planning in Assist', () => {
    const catalog = readSrc('src/liquid-command/navigation/moduleCatalog.ts');
    const shell = readSrc('src/components/calendar/CalendarPageShell.tsx');
    const record = readSrc('src/components/office/ClientRecordShiftsPanel.tsx');
    expect(catalog).toContain("label: 'Kalender & Einsatzplanung'");
    expect(catalog).toContain("route: '/assist/kalender'");
    expect(shell).toContain("config.moduleKey === 'assist'");
    expect(record).toContain('title="Assist-Kalender öffnen"');
  });
});

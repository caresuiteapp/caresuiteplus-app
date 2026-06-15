import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { APP_ROUTES, getRouteByPath } from '@/lib/navigation/routes';

function readSrc(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

const REQUIRED_ROUTE_PATHS = [
  '/business/reporting',
  '/business/release',
  '/business/roadmap',
  '/business/security',
  '/business/qa',
  '/business/ops',
  '/business/ti',
  '/business/templates',
  '/business/integrations',
  '/business/platform',
  '/business/platform/ocr',
  '/business/platform/ai',
  '/business/office/qm',
  '/insight',
  '/insight/snapshots',
  '/insight/exports',
  '/insight/data-sources',
  '/portal/employee/announcements',
  '/portal/client/announcements',
  '/portal/relative/messages',
];

describe('Routes Registry (Sprint 97–98)', () => {
  it('APP_ROUTES enthält Business-Hub- und InsightCenter-Pfade', () => {
    for (const routePath of REQUIRED_ROUTE_PATHS) {
      expect(APP_ROUTES.some((r) => r.path === routePath)).toBe(true);
    }
  });

  it('getRouteByPath löst Business-Release-Detail per Prefix', () => {
    const route = getRouteByPath('/business/release/rel-001');
    expect(route?.path).toBe('/business/release');
    expect(route?.group).toBe('business');
  });

  it('Portal-Ankündigungen sind in routes.ts registriert', () => {
    const routes = readSrc('src/lib/navigation/routes.ts');
    expect(routes).toContain("'/portal/employee/announcements'");
    expect(routes).toContain("'/portal/client/announcements'");
  });

  it('App-Routen für Portal-Ankündigungen existieren', () => {
    expect(fs.existsSync(path.join(process.cwd(), 'app/portal/employee/announcements/index.tsx'))).toBe(true);
    expect(fs.existsSync(path.join(process.cwd(), 'app/portal/client/announcements/index.tsx'))).toBe(true);
  });
});

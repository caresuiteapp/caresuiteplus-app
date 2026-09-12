import { describe, expect, it } from 'vitest';
import { isHealthOSContextualPopupRoute } from '@/lib/navigation/healthosRoutePresentation';

describe('HealthOS central route presentation', () => {
  it('never wraps the central start page in popup spacing', () => {
    expect(isHealthOSContextualPopupRoute('/')).toBe(false);
    expect(isHealthOSContextualPopupRoute('index')).toBe(false);
    expect(isHealthOSContextualPopupRoute('/index')).toBe(false);
    expect(isHealthOSContextualPopupRoute('app/index.tsx')).toBe(false);
  });

  it('keeps internal widget destinations in the contextual popup presenter', () => {
    expect(isHealthOSContextualPopupRoute('/business/office/clients')).toBe(true);
    expect(isHealthOSContextualPopupRoute('/assist/live-status')).toBe(true);
  });

  it.each([
    '/platform', '/platform/', '/platform/dashboard', '/platform/tenants/tenant-id',
    '/platform/support', '/platform/login', '/platform/forbidden',
    'platform', 'platform/(console)', 'platform/(console)/dashboard',
    'app/platform/(console)/dashboard.tsx', 'app/platform/index.tsx',
    '/plattform', '/plattform/dashboard', '/command', '/command/',
  ])('keeps the platform console and legacy entry %s outside desktop popup chrome', (route) => {
    expect(isHealthOSContextualPopupRoute(route)).toBe(false);
  });

  it.each(['/business/company', '/business/dashboard', '/business/platform', '/command-center', '/platform-tools'])('preserves desktop popup presentation for %s', (route) => {
    expect(isHealthOSContextualPopupRoute(route)).toBe(true);
  });

  it('keeps authentication and public portals outside the popup presenter', () => {
    expect(isHealthOSContextualPopupRoute('/auth/business-login')).toBe(false);
    expect(isHealthOSContextualPopupRoute('/portal/employee')).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { isMobileWorkspace, MOBILE_WORKSPACE_BASE_SCALE } from '@/design/web/mobileWorkspaceDensity';

describe('mobile management density scope', () => {
  it.each(['/', '/office', '/office/clients', '/business/office/employees', '/business/office/invoices', '/settings/profile'])('uses the compact baseline on %s', pathname => {
    expect(isMobileWorkspace(pathname, 390)).toBe(true);
    expect(isMobileWorkspace(pathname, 844)).toBe(true);
    expect(isMobileWorkspace(pathname, 1440)).toBe(false);
  });
  it.each(['/auth', '/portal/employee', '/portal/client', '/platform/tenants', '/impressum'])('keeps the independent surface %s at its existing size', pathname => {
    expect(isMobileWorkspace(pathname, 390)).toBe(false);
  });
  it('keeps the new baseline separate from the user-selected text enlargement', () => {
    expect(MOBILE_WORKSPACE_BASE_SCALE).toBe(0.9);
    expect(1.5 * MOBILE_WORKSPACE_BASE_SCALE).toBeCloseTo(1.35);
    expect(isMobileWorkspace('/', 0)).toBe(false);
    expect(isMobileWorkspace('/', 900)).toBe(false);
  });
});

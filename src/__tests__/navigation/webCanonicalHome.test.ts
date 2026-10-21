import { describe, expect, it, vi } from 'vitest';
vi.mock('react-native', () => ({ Platform: { OS: 'web' } }));
import { resolveAuthSessionTarget } from '@/lib/auth/sessionTarget';
import { resolvePostLoginRoute } from '@/lib/auth/loginRouter';
import { resolveSessionHomeRoute } from '@/lib/navigation/sessionRouting';
import { isLegacyBusinessHomePath } from '@/lib/navigation/businessHome';
import { checkRoleAccess } from '@/lib/navigation/redirects';

describe('canonical web home', () => {
  it('uses the desktop directly after business login and session restoration', () => {
    expect(resolvePostLoginRoute('business')).toBe('/Desktop');
    expect(resolveSessionHomeRoute('business_admin')).toBe('/Desktop');
    const target = resolveAuthSessionTarget({ profile: { roleKey: 'business_admin' } as never, portalSession: null, user: null });
    expect(target.homePath).toBe('/Desktop'); expect(target.canRedirectHome).toBe(true);
    expect(checkRoleAccess('/portal/client', 'business_admin').target).toBe('/Desktop');
  });
  it('preserves portal and required password setup destinations', () => {
    expect(resolveSessionHomeRoute('employee_portal')).toBe('/portal/employee');
    expect(resolveSessionHomeRoute('client_portal')).toBe('/portal/client');
    const target = resolveAuthSessionTarget({ profile: null, user: null, portalSession: {
      roleKey: 'employee_portal', loginType: 'employee_portal', mustChangePassword: true, accountId: 'test-account',
    } as never });
    expect(target.homePath).toBe('/auth/employee-first-login?accountId=test-account');
  });
  it('does not redirect an anonymous user from the access screen', () => {
    expect(resolveAuthSessionTarget({ profile: null, portalSession: null, user: null }).canRedirectHome).toBe(false);
  });
  it('restores academy-only family sessions to the real Academy route, including a lost opaque session', () => {
    const portalSession = { loginType: 'relative_portal', roleKey: 'family_portal', portalType: 'academy_family', accessScope: 'academy' } as never;
    expect(resolveSessionHomeRoute('family_portal', portalSession)).toBe('/portal/client/akademie');
    expect(resolveAuthSessionTarget({ profile: null, user: null, portalSession }).homePath).toBe('/portal/client/akademie');
    const target = resolveAuthSessionTarget({ profile: null, portalSession: null, user: { id: 'family-auth', roleKey: 'family_portal', portalType: 'academy_family', accessScope: 'academy' } as never });
    expect(target.homePath).toBe('/portal/client/akademie'); expect(target.canRedirectHome).toBe(true);
  });
  it.each(['/business', '/Business/', '/business/dashboard', '/zentrale', '/business?old=1'])('recognizes the old home %s', path => {
    expect(isLegacyBusinessHomePath(path)).toBe(true);
  });
  it.each(['/business/office/clients', '/business/messages', '/business/settings', '/business-other'])('preserves the real business page %s', path => {
    expect(isLegacyBusinessHomePath(path)).toBe(false);
  });
});

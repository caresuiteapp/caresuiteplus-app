import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { isAuthSetupRoute, resolvePostLoginRoute } from '@/lib/auth/loginRouter';
import { checkRoleAccess } from '@/lib/navigation/redirects';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('post-login redirect routing', () => {
  it('resolvePostLoginRoute maps login types to dashboard paths', () => {
    expect(String(resolvePostLoginRoute('business'))).toBe('/business');
    expect(String(resolvePostLoginRoute('employee_portal'))).toBe('/portal/employee');
    expect(String(resolvePostLoginRoute('client_portal'))).toBe('/portal/client');
    expect(String(resolvePostLoginRoute('relative_portal'))).toBe('/portal/relative');
  });

  it('checkRoleAccess never sends missing roles to public start', () => {
    const decision = checkRoleAccess('/portal/employee', null);
    expect(decision.shouldRedirect).toBe(true);
    expect(String(decision.target)).toBe('/auth/employee-login');
    expect(String(decision.target)).not.toBe('/');
  });

  it('checkRoleAccess sends wrong roles to their home dashboard', () => {
    const decision = checkRoleAccess('/business', 'client_portal');
    expect(decision.shouldRedirect).toBe(true);
    expect(String(decision.target)).toBe('/portal/client');
  });

  it('isAuthSetupRoute allows employee first-login while authenticated', () => {
    expect(isAuthSetupRoute('/auth/employee-first-login')).toBe(true);
    expect(isAuthSetupRoute('/auth/employee-first-login?accountId=1')).toBe(true);
    expect(isAuthSetupRoute('/auth/business-login')).toBe(false);
  });

  it('login screens defer navigation to RedirectIfAuthenticated', () => {
    const business = readSrc('src/screens/auth/BusinessLoginScreen.tsx');
    const employee = readSrc('src/screens/auth/EmployeePortalLoginScreen.tsx');
    const client = readSrc('src/screens/auth/PortalCodeLoginScreen.tsx');

    expect(business).toContain('setSuccess(true)');
    expect(business).not.toContain('resolvePostLoginRoute');

    expect(employee).toContain('setSuccess(true)');
    expect(employee).not.toContain('resolvePostLoginRoute(');
    expect(client).toContain('setSuccess(true)');
    expect(client).not.toContain('resolvePostLoginRoute(');
  });

  it('RequireRole waits for role resolution instead of redirecting to /', () => {
    const guard = readSrc('src/lib/auth/RequireRole.tsx');
    expect(guard).toContain('!roleKey');
    expect(guard).toContain('Berechtigungen werden geladen');
    expect(guard).not.toContain("router.replace('/' as never)");
    expect(guard).toContain('getLoginRedirectForPath');
  });

  it('RedirectIfAuthenticated skips setup routes and uses session target', () => {
    const guard = readSrc('src/lib/auth/RedirectIfAuthenticated.tsx');
    expect(guard).toContain('isAuthSetupRoute');
    expect(guard).toContain('resolveAuthSessionTarget');
    expect(guard).not.toContain("router.replace('/' as never)");
  });
});

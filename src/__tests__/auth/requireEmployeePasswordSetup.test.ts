import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

function readSrc(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('RequireEmployeePasswordSetup', () => {
  it('blocks employee portal layout until password is changed', () => {
    const layout = readSrc('app/portal/employee/_layout.tsx');
    expect(layout).toContain('RequireEmployeePasswordSetup');
    expect(layout).toContain('RequireAuth');
  });

  it('redirects when mustChangePassword is set on portal session', () => {
    const guard = readSrc('src/lib/auth/RequireEmployeePasswordSetup.tsx');
    expect(guard).toContain('mustChangePassword === true');
    expect(guard).toContain('resolveEmployeeFirstLoginHref');
    expect(guard).toContain('<Redirect');
  });

  it('routes OTP login to first-login before dashboard', () => {
    const login = readSrc('src/screens/auth/EmployeePortalLoginScreen.tsx');
    expect(login).toContain('mustChangePassword');
    expect(login).toContain('resolveEmployeeFirstLoginHref');
    const mustChangeIndex = login.indexOf('if (result.data.mustChangePassword)');
    const welcomeIndex = login.indexOf("markPortalWelcomePending('employee')");
    expect(mustChangeIndex).toBeGreaterThan(-1);
    expect(welcomeIndex).toBeGreaterThan(mustChangeIndex);
  });

  it('shows welcome only after first-login password change', () => {
    const firstLogin = readSrc('src/screens/auth/EmployeeFirstLoginPasswordScreen.tsx');
    expect(firstLogin).toContain("markPortalWelcomePending('employee')");
    expect(firstLogin).toContain('resolvePostLoginRoute');
  });
});

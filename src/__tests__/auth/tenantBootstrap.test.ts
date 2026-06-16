import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('tenant bootstrap role resolution', () => {
  it('tenantService resolves role from join, role_id lookup, and session metadata', () => {
    const source = readSrc('src/lib/supabase/tenantService.ts');
    expect(source).toContain('resolveProfileRoleKey');
    expect(source).toContain('fetchRoleKeyById');
    expect(source).toContain('readSessionRoleHint');
    expect(source).toContain("app_metadata?.role_key");
    expect(source).toContain('Benutzerrolle konnte nicht geladen werden.');
  });

  it('RedirectIfAuthenticated waits for session target before redirect', () => {
    const guard = readSrc('src/lib/auth/RedirectIfAuthenticated.tsx');
    expect(guard).toContain('hasSessionTarget');
    expect(guard).toContain('!hasSessionTarget');
  });

  it('AppStartScreen does not silently sign out incomplete sessions', () => {
    const start = readSrc('src/screens/AppStartScreen.tsx');
    expect(start).toContain('Sitzung unvollständig');
    expect(start).not.toMatch(/if \(!hasSessionTarget\) \{\s*void signOut\(\)/);
  });
});

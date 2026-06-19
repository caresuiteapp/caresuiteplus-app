import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('useSupabaseSessionProbe', () => {
  it('exports a hook used by landing and auth guards', () => {
    const probe = readSrc('src/lib/auth/useSupabaseSessionProbe.ts');
    expect(probe).toContain('getSession');
    expect(probe).toContain('authReady');
    expect(probe).toContain('isAuthenticated');
  });

  it('AppStartScreen and auth index never render landing while session is pending', () => {
    const start = readSrc('src/screens/AppStartScreen.tsx');
    const authIndex = readSrc('app/auth/index.tsx');
    expect(start).toContain('sessionPending');
    expect(authIndex).toContain('useSupabaseSessionProbe');
    expect(authIndex).not.toContain('<Redirect href="/" as never />');
  });
});

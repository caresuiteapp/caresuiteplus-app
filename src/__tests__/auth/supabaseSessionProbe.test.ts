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
    expect(probe).toContain('probeExpired');
    expect(probe).toContain('SESSION_PROBE_MAX_MS');
  });

  it('AppStartScreen probes while the canonical liquid entry waits for auth', () => {
    const start = readSrc('src/screens/AppStartScreen.tsx');
    const authIndex = readSrc('src/liquid-command/screens/LiquidCommandEntryScreen.tsx');
    expect(start).toContain('sessionPending');
    expect(authIndex).toContain('if (!authReady)');
    expect(authIndex).toContain('System wird gestartet');
    expect(authIndex).not.toContain('<Redirect href="/" as never />');
  });
});

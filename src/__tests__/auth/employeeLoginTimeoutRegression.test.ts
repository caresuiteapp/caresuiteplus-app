import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(__dirname, '../../..');

function source(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

describe('employee login timeout regressions', () => {
  it('releases a stalled edge-function login with a user-facing timeout', () => {
    const edgeFunctions = source('src/lib/supabase/edgeFunctions.ts');

    expect(edgeFunctions).toContain('EDGE_FUNCTION_REQUEST_TIMEOUT_MS');
    expect(edgeFunctions).toContain('withEdgeFunctionTimeout');
    expect(edgeFunctions).toContain('Die Anfrage antwortet nicht. Bitte Verbindung prüfen und erneut versuchen.');
  });

  it('also bounds the portal Supabase session handshake', () => {
    const portalAuth = source('src/lib/auth/portalSupabaseAuth.ts');

    expect(portalAuth).toContain('withPortalSessionTimeout(\n      client.auth.setSession');
  });

  it('blocks duplicate employee login submissions while one request is running', () => {
    const accessScreens = source('src/liquid-command/screens/AccessScreens.tsx');

    expect(accessScreens).toContain('const submitting = useRef(false);');
    expect(accessScreens).toContain('if (submitting.current) return;');
    expect(accessScreens).toContain('submitting.current = false;');
  });
});

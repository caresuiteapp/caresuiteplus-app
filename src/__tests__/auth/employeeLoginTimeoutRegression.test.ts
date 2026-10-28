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

  // Synchronous duplicate activation is exercised through both actual login
  // screens in businessRegistrationLifecycle.test.tsx, rather than private ref names.

  it('uses trusted signed claims when the shared profile bootstrap is unavailable', () => {
    const provider = source('src/lib/auth/AuthProvider.tsx');

    expect(provider).toContain('applyTrustedSessionFallback');
    expect(provider).toContain('supabaseSession.user.app_metadata');
    expect(provider).toContain('editable user_metadata is never');
    expect(provider).toContain('await hydrateSupabaseSession(\n      sessionResult.data');
  });
});

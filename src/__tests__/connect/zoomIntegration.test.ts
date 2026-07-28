import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { getConnectIntegration } from '@/lib/connect/connectCatalog';
import { PROVIDER_REGISTRY } from '@/lib/integrations/providerRegistry';
import { adminNav } from '@/lib/navigation/moduleNav/adminNav';
import { zentraleNav } from '@/lib/navigation/moduleNav/zentraleNav';
import { getRouteByPath } from '@/lib/navigation/routes';

function source(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('Zoom live integration', () => {
  it('registers Zoom as a dedicated Connect integration and route', () => {
    expect(getConnectIntegration('communication_channels', 'zoom')).toMatchObject({
      key: 'zoom',
      label: 'Zoom',
      readiness: 'beta',
      requiresProvider: true,
      moduleHref: '/business/connect/zoom',
    });
    expect(getRouteByPath('/business/connect/zoom')).toEqual(expect.objectContaining({
      label: 'Zoom',
      allowedRoles: ['business_admin', 'business_manager'],
    }));
  });

  it('uses only a vault reference in the provider registry', () => {
    const provider = PROVIDER_REGISTRY.find((entry) => entry.key === 'zoom');
    expect(provider?.secretReferenceKey).toBe('vault:integration-zoom-oauth-sdk');
    expect(provider?.secretReferenceKey).not.toMatch(/client_secret|sdk_secret|eyJ/i);
  });

  it('is visible in Zentrale and Admin navigation', () => {
    const expected = expect.objectContaining({ label: 'Zoom', href: '/business/connect/zoom' });
    expect(zentraleNav.groups.flatMap((group) => group.items)).toContainEqual(expected);
    expect(adminNav.groups.flatMap((group) => group.items)).toContainEqual(expected);
  });

  it('is technically isolated from Google Workspace', () => {
    const zoomFiles = [
      'supabase/functions/_shared/zoom.ts',
      'supabase/functions/zoom-auth/index.ts',
      'supabase/functions/zoom-api/index.ts',
      'supabase/functions/zoom-webhook/index.ts',
      'supabase/migrations/20260724170000_zoom_live_integration.sql',
    ].map(source).join('\n');
    expect(zoomFiles).not.toContain('google_workspace_');
    expect(zoomFiles).not.toContain('GOOGLE_WORKSPACE_');
    expect(zoomFiles).not.toContain('googleWorkspace');
    expect(zoomFiles).toContain('zoom_connections');
    expect(zoomFiles).toContain('ZOOM_TOKEN_ENCRYPTION_KEY');
  });

  it('keeps secrets and meeting credentials behind Edge Functions', () => {
    const migration = source('supabase/migrations/20260724170000_zoom_live_integration.sql');
    expect(migration).toContain('REVOKE ALL ON public.zoom_connections FROM authenticated, anon');
    expect(migration).toContain('REVOKE ALL ON public.zoom_meetings FROM authenticated, anon');
    expect(migration).toContain('join_url_cipher');
    expect(migration).toContain('passcode_cipher');
  });

  it('validates signed webhooks and protects against replay', () => {
    const webhook = source('supabase/functions/zoom-webhook/index.ts');
    expect(webhook).toContain("req.headers.get('x-zm-signature')");
    expect(webhook).toContain("req.headers.get('x-zm-request-timestamp')");
    expect(webhook).toContain('5 * 60_000');
    expect(webhook).toContain("insertError?.code === '23505'");
  });
});

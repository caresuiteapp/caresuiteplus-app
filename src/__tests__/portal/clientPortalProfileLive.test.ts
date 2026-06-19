import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('Client portal profile live wiring', () => {
  it('profile hook resolves clientId from portal actor', () => {
    const hook = readSrc('src/hooks/useClientPortalProfile.ts');
    expect(hook).toContain('usePortalActor');
    expect(hook).toContain('clientId');
    expect(hook).not.toContain('useAuth');
  });

  it('profile service loads live Supabase data when clientId is present', () => {
    const service = readSrc('src/lib/portal/clientProfileService.ts');
    expect(service).toContain('fetchLiveClientPortalProfile');
    expect(service).toContain("getServiceMode() === 'supabase'");
    const live = readSrc('src/lib/portal/clientProfileLiveService.ts');
    expect(live).toContain("fromUnknownTable(supabase, 'clients')");
    expect(live).toContain('client_portal_access');
    expect(live).not.toContain('ellen.zacharias');
  });

  it('profile screen uses glass aurora layout', () => {
    const screen = readSrc('src/screens/portal/ClientPortalProfileScreen.tsx');
    expect(screen).toContain('PortalTabScreen');
    expect(screen).toContain('GlassCard');
    expect(screen).toContain('PortalGlassHero');
    expect(screen).not.toContain('PremiumCard');
    expect(screen).not.toContain('CareLightPageShell');
  });

  it('profile screen shows portal role, modules, and stammdaten request', () => {
    const screen = readSrc('src/screens/portal/ClientPortalProfileScreen.tsx');
    expect(screen).toContain('usePortalContext');
    expect(screen).toContain('Portalrolle');
    expect(screen).toContain('Stammdaten ändern');
    expect(screen).toContain('PortalRequestFormModal');
  });

  it('migration 0105 adds portal self-select RLS', () => {
    const sql = readSrc('supabase/migrations/0105_portal_profile_self_rls.sql');
    expect(sql).toContain('client_portal_access_portal_self_select');
    expect(sql).toContain('client_contacts_portal_self_select');
    expect(sql).toContain('care_plans_portal_self_select');
  });
});

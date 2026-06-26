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
    expect(screen).not.toContain('ScreenShell');
  });

  it('profile screen shows portal role, modules, and stammdaten request', () => {
    const screen = readSrc('src/screens/portal/ClientPortalProfileScreen.tsx');
    expect(screen).toContain('usePortalContext');
    expect(screen).toContain('Portalrolle');
    expect(screen).toContain('Stammdaten ändern');
    expect(screen).toContain('PortalRequestFormModal');
  });

  it('profile screen shows expanded profile sections', () => {
    const screen = readSrc('src/screens/portal/ClientPortalProfileScreen.tsx');
    expect(screen).toContain('KONTAKT & ERREICHBARKEIT');
    expect(screen).toContain('VERSICHERUNG / KOSTENTRÄGER');
    expect(screen).toContain('BETREUUNG & PFLEGE');
    expect(screen).toContain('ANSPRECHPARTNER / BEVOLLMÄCHTIGTE');
    expect(screen).toContain('PORTAL-HINWEISE');
    expect(screen).toContain('clientPortalProfileProjection');
  });

  it('profile projection masks insurance and respects portal settings', () => {
    const projection = readSrc('src/lib/portal/clientPortalProfileProjection.ts');
    expect(projection).toContain('maskPortalInsuranceNumber');
    expect(projection).toContain('canClientPortalSeeProfileField');
    const live = readSrc('src/lib/portal/clientProfileLiveService.ts');
    expect(live).toContain('buildClientPortalProfileProjection');
    expect(live).toContain('client_insurance_profiles');
    expect(live).toContain('client_care_contexts');
  });

  it('migration 0105 adds portal self-select RLS', () => {
    const sql = readSrc('supabase/migrations/0105_portal_profile_self_rls.sql');
    expect(sql).toContain('client_portal_access_portal_self_select');
    expect(sql).toContain('client_contacts_portal_self_select');
    expect(sql).toContain('care_plans_portal_self_select');
  });

  it('migration 0182 adds portal profile extended RLS', () => {
    const sql = readSrc('supabase/migrations/0182_portal_profile_extended_rls.sql');
    expect(sql).toContain('client_insurance_profiles_portal_self_select');
    expect(sql).toContain('client_care_contexts_portal_self_select');
  });
});

import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  listPlatformOperatorUsers,
  listPlatformReleases,
  registerPlatformRelease,
  updatePlatformOperatorUser,
  parsePlatformEurosToCents,
} from '@/lib/platformConsole';
import { PLATFORM_NAV_ITEMS } from '@/lib/platformConsole/platformNavigation';

describe('Platform Console V2 — Betreiberabläufe', () => {
  beforeEach(() => vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'true'));
  afterEach(() => vi.unstubAllEnvs());

  it('Benutzerverwaltung ist navigierbar und besitzt eine eigene Route', () => {
    expect(PLATFORM_NAV_ITEMS.some((item) => item.path === '/platform/users' && item.capability === 'users.read')).toBe(true);
    const route = readFileSync('app/platform/(console)/users/index.tsx', 'utf8');
    expect(route).toContain('PlatformUsersScreen');
  });

  it('Operator-Benutzer werden geladen und Änderungen verlangen einen Grund', async () => {
    const users = await listPlatformOperatorUsers();
    expect(users.ok).toBe(true);
    const denied = await updatePlatformOperatorUser('demo-owner', 'platform_admin', 'active', 'x');
    expect(denied.ok).toBe(false);
    const accepted = await updatePlatformOperatorUser('demo-owner', 'platform_admin', 'active', 'Rollenwechsel laut Freigabe');
    expect(accepted.ok).toBe(true);
  });

  it('Release-Register lädt und registriert nur mit Begründung', async () => {
    const releases = await listPlatformReleases();
    expect(releases.ok).toBe(true);
    const payload = {
      environment: 'production' as const,
      version_label: '2026.07.16',
      commit_sha: '58046ca7',
      status: 'ready' as const,
      deployment_url: 'https://www.caresuiteplus.app',
      migration_version: '0258',
      notes: 'Build und Smoke-Test erfolgreich',
      checks: { build: true },
    };
    expect((await registerPlatformRelease(payload, '')).ok).toBe(false);
    expect((await registerPlatformRelease(payload, 'Produktionsfreigabe erteilt')).ok).toBe(true);
  });

  it('wandelt deutsche Euro-Eingaben ohne Cent-Fehleingaben um', () => {
    expect(parsePlatformEurosToCents('299,00')).toBe(29900);
    expect(parsePlatformEurosToCents('2.990,50')).toBe(299050);
    expect(parsePlatformEurosToCents('-1')).toBeNull();
  });
});

describe('Platform Console V2 — Stabilität und Sicherheit', () => {
  it('hält die Shell mit globaler und lokaler Error Boundary sichtbar', () => {
    const layout = readFileSync('app/platform/(console)/_layout.tsx', 'utf8');
    const shell = readFileSync('src/components/platformConsole/PlatformShellLayout.tsx', 'utf8');
    expect(layout).toContain('PlatformErrorBoundary');
    expect(shell).toContain('<PlatformErrorBoundary>{children}</PlatformErrorBoundary>');
  });

  it('verwendet ausschließlich helle Tabellenzeilen mit kontrastreichem Text', () => {
    const table = readFileSync('src/components/platformConsole/PlatformDataTable.tsx', 'utf8');
    expect(table).toContain("backgroundColor: '#FFFFFF'");
    expect(table).toContain("backgroundColor: '#F8FBFD'");
    expect(table).toContain('color: PLATFORM_COLORS.text');
    expect(table).not.toContain("backgroundColor: '#0D1524'");
  });

  it('liefert geschützte RPCs, Last-Owner-Schutz, Audit und RLS für Releases', () => {
    const sql = readFileSync('supabase/migrations/0258_platform_console_v2_operations.sql', 'utf8');
    expect(sql).toContain("platform_assert_capability('users.write')");
    expect(sql).toContain('last_platform_owner_protected');
    expect(sql).toContain("platform_write_audit_log(");
    expect(sql).toContain("platform_has_capability('releases.read')");
    expect(sql).toContain('REVOKE ALL ON FUNCTION public.platform_update_operator_user');
  });

  it('bietet Suche, fachlich gruppierte Navigation und verständliche Formfelder', () => {
    const shell = readFileSync('src/components/platformConsole/PlatformShellLayout.tsx', 'utf8');
    const search = readFileSync('src/components/platformConsole/PlatformGlobalSearch.tsx', 'utf8');
    const field = readFileSync('src/components/platformConsole/PlatformFormField.tsx', 'utf8');
    expect(shell).toContain('Kunden & Verträge');
    expect(shell).toContain('Produktverwaltung');
    expect(search).toContain('Strg K');
    expect(field).toContain("{label}{required ? ' *' : ''}");
  });
});

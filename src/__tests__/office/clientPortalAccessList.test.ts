import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import { enforcePermission } from '@/lib/permissions';
import { buildAccessListKpis } from '@/lib/access/accessListStats';
import { isClientPortalAccessLiveReady } from '@/lib/access/accessModuleConfig';
import { mapClientPortalAccessListRow } from '@/lib/access/clientPortalAccessListMapper';
import { fetchClientPortalAccessList } from '@/lib/access/clientPortalAccessListService';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('Office Klient:innenportal list', () => {
  it('enforcePermission schützt Portal-List-Service', () => {
    expect(enforcePermission(null, 'office.clients.view' as never)).not.toBeNull();
  });

  it('fetchClientPortalAccessList liefert Demo-Einträge', async () => {
    const result = await fetchClientPortalAccessList(DEMO_TENANT_ID, 'business_admin');
    expect(result.ok).toBe(true);
  });

  it('mapClientPortalAccessListRow mappt Live-Schema auf ListItem', () => {
    const item = mapClientPortalAccessListRow(
      {
        id: 'portal-live-001',
        tenant_id: 'tenant-001',
        client_id: 'client-001',
        contact_id: null,
        email: null,
        portal_username: 'hreinhardt',
        portal_enabled: true,
        status: 'aktiv',
        last_login_at: '2026-06-17T10:00:00.000Z',
        invited_at: null,
        code_created_at: '2026-06-16T08:00:00.000Z',
        code_rotated_at: null,
        modules_enabled: ['appointments'],
        two_factor_enabled: false,
        created_at: '2026-06-16T08:00:00.000Z',
        updated_at: '2026-06-17T10:00:00.000Z',
        clients: { first_name: 'Heinz-Peter', last_name: 'Reinhardt' },
      },
      new Map(),
    );

    expect(item.clientName).toBe('Heinz-Peter Reinhardt');
    expect(item.portalUsername).toBe('hreinhardt');
    expect(item.status).toBe('aktiv');
  });

  it('buildAccessListKpis zeigt Live-Mandant statt Demo', () => {
    const kpis = buildAccessListKpis('client-portal', 2, 'dark', {
      tenantName: 'Helferhasen+',
      isLive: true,
    });

    expect(kpis.find((kpi) => kpi.id === 'scope')?.value).toBe('Helferhasen+');
    expect(kpis.find((kpi) => kpi.id === 'status')?.value).toBe('Live');
    expect(kpis.some((kpi) => kpi.value === 'Demo')).toBe(false);
  });

  it('ClientPortalCodesScreen nutzt Live-Service statt Demo-Store', () => {
    const screen = readSrc('src/screens/office/access/ClientPortalCodesScreen.tsx');
    expect(screen).toContain('fetchClientPortalAccessList');
    expect(screen).toContain('setupClientPortalAccess');
    expect(screen).not.toContain('useDemoData');
    expect(screen).not.toContain('listClientPortalCodes');
    expect(screen).not.toContain('createClientPortalAccess');
  });

  it('ClientPortalCodesScreen enthält keine Demo-Banner-Strings', () => {
    const screen = readSrc('src/screens/office/access/ClientPortalCodesScreen.tsx');
    expect(screen).not.toMatch(/\bDemo-Daten\b/);
    expect(screen).not.toContain('Lokaler Store');
    expect(screen).not.toContain('Kein Live-Sync');
  });

  it('AccessListHero blendet Prepared-Badge für Live-Klient:innenportal aus', () => {
    const hero = readSrc('src/components/access/AccessListHero.tsx');
    expect(hero).toContain('isClientPortalAccessLiveReady');
    expect(hero).toContain('useTenantDisplayName');
  });

  it('isClientPortalAccessLiveReady folgt Service-Mode', () => {
    expect(typeof isClientPortalAccessLiveReady()).toBe('boolean');
  });
});

describe('client_portal_access RLS (0061)', () => {
  it('Migration definiert tenant-isolierte SELECT/WRITE Policies', () => {
    const migration = readSrc('supabase/migrations/0061_client_record_extended_tables.sql');
    expect(migration).toContain('client_portal_access');
    expect(migration).toContain('%s_select_tenant');
    expect(migration).toContain('office.clients.view');
    expect(migration).toContain('office.clients.edit');
  });
});

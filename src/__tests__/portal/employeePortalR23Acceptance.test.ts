import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..', '..');
const readSrc = (relativePath: string) => readFileSync(path.join(root, relativePath), 'utf8');

describe('employee portal R23 production acceptance', () => {
  it('keeps one canonical, focused employee navigation on every form factor', () => {
    const catalog = readSrc('src/liquid-command/navigation/portalCatalog.ts');
    const legacy = readSrc('src/lib/navigation/employeePortalNavigation.ts');
    const employeeCatalog = catalog.split('employee: [')[1]?.split('],\n  client: [')[0] ?? '';
    const removed = ['Aufgaben', 'Unterschriften', 'Mitteilungen', 'Mobilität', 'Hilfe'];

    for (const label of removed) {
      expect(employeeCatalog).not.toContain(`label: '${label}'`);
      expect(legacy).not.toContain(`label: '${label}'`);
    }

    for (const label of ['Heute', 'Einsätze', 'Klient:innen', 'Kalender', 'Nachrichten', 'Profil']) {
      expect(catalog).toContain(`label: '${label}'`);
    }
  });

  it('uses tenant-wide client records and the complete team calendar without cross-tenant reads', () => {
    const clients = readSrc('src/lib/portal/employeePortalClientRecordsService.ts');
    const calendarHook = readSrc('src/hooks/useEmployeePortalCalendarEvents.ts');
    const migration = readSrc(
      'supabase/migrations/20260801170000_employee_portal_team_records_calendar.sql',
    );

    expect(clients).toContain('loadAllTenantClients');
    expect(clients).toContain('loadTeamClientVisits');
    expect(clients).toContain(".eq('tenant_id', tenantId)");
    expect(clients).toContain('sanitizeEmployeePortalPayload');
    expect(calendarHook).toContain('getEmployeePortalTeamCalendarEvents');
    expect(migration).toContain('tenant_id = public.current_tenant_id()');
    expect(migration).toContain('public.is_employee_portal_rls_context(tenant_id)');
    expect(migration).not.toMatch(/FOR\s+(INSERT|UPDATE|DELETE)/i);
  });

  it('never returns soft-deleted conversations to employee or client portals', () => {
    const messages = readSrc('src/lib/office/portalofficemessageservice.ts');
    expect(messages).toContain("thread.status !== 'deleted'");
    expect(messages).toContain(".neq('status', 'deleted')");
    expect(messages).toContain(".is('deleted_at', null)");
  });

  it('uses the CareSuite employee guide and reduced-motion-safe premium effects', () => {
    const home = readSrc('src/liquid-command/screens/PortalHomeScreen.tsx');
    expect(home).toContain("assets/auth/access-employee.png");
    expect(home).toContain('PortalGuide');
    expect(home).toContain('AccessibilityInfo.isReduceMotionEnabled');
    expect(home).toContain('PortalAmbientPulse');
  });

  it('always returns to the central start page after sign-out', () => {
    const home = readSrc('src/liquid-command/screens/PortalHomeScreen.tsx');
    const shell = readSrc('src/liquid-command/shell/LiquidPortalRouteLayout.tsx');
    expect(home).toMatch(/await auth\.signOut\(\);\s*router\.replace\('\/' as never\);/);
    expect(shell).toMatch(/await auth\.signOut\(\);\s*router\.replace\('\/' as never\);/);
  });
});

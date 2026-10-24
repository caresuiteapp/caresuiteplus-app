import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..', '..');
const readSrc = (relativePath: string) =>
  readFileSync(path.join(root, relativePath), 'utf8').replace(/\r\n/g, '\n');

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

  it('keeps the active tenant directory under the existing server scope and sanitizes portal data', () => {
    const clients = readSrc('src/lib/portal/employeePortalClientRecordsService.ts');
    const patch = readSrc('supabase/patches/ambulatory_employee_portal_scope.sql');

    expect(clients).toContain('loadTeamClientVisits');
    expect(clients).toContain(".eq('status', 'active')");
    expect(clients).toContain(".is('deleted_at', null)");
    expect(clients).toContain('loadAllTenantClients');
    expect(clients).toContain('if (!tenantId.trim() || !_employeeId.trim())');
    expect(clients).toContain('fetchLivePortalAppointmentsForEmployeeTeam');
    expect(clients).toContain(".eq('tenant_id', tenantId)");
    expect(clients).toContain('sanitizeEmployeePortalPayload');
    expect(patch).toContain('tenant_id = public.current_tenant_id()');
    expect(patch).toContain('employee_id = public.resolve_current_employee_id()');
    expect(patch).not.toMatch(/FOR\s+(INSERT|UPDATE|DELETE)/i);
  });

  it('never returns soft-deleted conversations to employee or client portals', () => {
    const messages = readSrc('src/lib/office/portalofficemessageservice.ts');
    expect(messages).toContain("thread.status !== 'deleted'");
    expect(messages).toContain(".neq('status', 'deleted')");
    expect(messages).not.toContain(".is('deleted_at', null)");
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

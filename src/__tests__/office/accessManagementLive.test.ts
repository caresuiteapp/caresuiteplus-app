import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('Access management live config', () => {
  it('accessModuleConfig exportiert live-ready flags für alle Bereiche', () => {
    const config = readSrc('src/lib/access/accessModuleConfig.ts');
    expect(config).toContain('isAccessManagementLiveReady');
    expect(config).toContain("getServiceMode() === 'supabase'");
    expect(config).toContain('isRelativePortalAccessLiveReady');
    expect(config).not.toMatch(/isAccessManagementLiveReady[\s\S]*return false/);
  });

  it('accessListStats unterstützt Live-KPIs', () => {
    const stats = readSrc('src/lib/access/accessListStats.ts');
    expect(stats).toContain('Live-Mandant');
    expect(stats).toContain("'Supabase'");
  });

  it('accessManagementLiveRepository liest Supabase-Views', () => {
    const repo = readSrc('src/lib/access/accessManagementLiveRepository.ts');
    expect(repo).toContain('relative_portal_codes_mgmt');
    expect(repo).toContain('employee_portal_accounts_mgmt');
    expect(repo).toContain('tenant_users');
    expect(repo).toContain('login_audit_events');
  });

  it('resetEmployeePortalPassword verlangt tenantId für Live-Reset', () => {
    const service = readSrc('src/lib/auth/accessManagementService.ts');
    const auth = readSrc('src/lib/auth/employeePortalAuthService.ts');
    expect(service).toMatch(/resetEmployeePortalPassword\([\s\S]*tenantId: string/);
    expect(auth).toContain('resolveLiveTenantId');
    expect(auth).toContain('Mandant fehlt für diese Portal-Aktion.');
  });
});

describe('Access screens live wiring', () => {
  it('RelativePortalCodesScreen nutzt Live-Services statt Demo-Store', () => {
    const screen = readSrc('src/screens/office/access/RelativePortalCodesScreen.tsx');
    expect(screen).toContain('fetchRelativePortalAccessList');
    expect(screen).toContain('setupRelativePortalAccess');
    expect(screen).toContain('isRelativePortalAccessLiveReady');
    expect(screen).not.toContain('useDemoData');
    expect(screen).not.toContain('DEMO_TENANT_ID');
    expect(screen).not.toContain('getRelativePortalCodes');
  });

  it('InternalUsersScreen nutzt fetchInternalUsersList statt useDemoData', () => {
    const screen = readSrc('src/screens/office/access/InternalUsersScreen.tsx');
    expect(screen).toContain('fetchInternalUsersList');
    expect(screen).not.toContain('useDemoData');
    expect(screen).not.toContain('DEMO_TENANT_ID');
  });

  it('EmployeePortalAccountsScreen nutzt fetchEmployeePortalAccountsList', () => {
    const screen = readSrc('src/screens/office/access/EmployeePortalAccountsScreen.tsx');
    expect(screen).toContain('fetchEmployeePortalAccountsList');
    expect(screen).not.toContain('useDemoData');
  });

  it('LoginAuditScreen nutzt fetchAccessAuditEventsList', () => {
    const screen = readSrc('src/screens/office/access/LoginAuditScreen.tsx');
    expect(screen).toContain('fetchAccessAuditEventsList');
    expect(screen).not.toContain('useDemoData');
  });

  it('AccessListHero zeigt Supabase Live Badge wenn live', () => {
    const hero = readSrc('src/components/access/AccessListHero.tsx');
    expect(hero).toContain('Supabase Live');
    expect(hero).toContain('isRelativePortalAccessLiveReady');
  });

  it('accessManagementService routet Dashboard-Stats über Supabase', () => {
    const service = readSrc('src/lib/auth/accessManagementService.ts');
    expect(service).toContain('fetchAccessDashboardStatsFromSupabase');
    expect(service).toContain('fetchInternalUsersList');
    expect(service).toContain('fetchEmployeePortalAccountsList');
    expect(service).toContain('fetchAccessAuditEventsList');
  });
});

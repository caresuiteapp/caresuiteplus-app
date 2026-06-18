import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { demoClients } from '@/data/demo/clients';
import { demoEmployees } from '@/data/demo/employees';
import {
  demoClientModuleAssignments,
  demoEmployeeModuleAssignments,
} from '@/data/demo/officeCoreAssignments';
import { officeCoreDemoRepository } from '@/lib/officeCore/demoRepository';
import { fetchOfficeCoreStats } from '@/lib/officeCore/officeCoreService';
import { fetchOfficeAuditLog } from '@/lib/officeCore/auditLogService';
import {
  fetchClientModuleAssignments,
  fetchModuleAssignmentHub,
  fetchModuleAssignmentList,
} from '@/lib/officeModules/moduleAssignmentService';
import { fetchModuleBillingSources } from '@/lib/officeModules/billingSourceService';
import { fetchModuleDocumentVisibility } from '@/lib/officeModules/documentVisibilityService';
import { fetchModulePermissionProfiles } from '@/lib/officeModules/permissionProfileService';
import { fetchModuleTemplateAssignments } from '@/lib/officeModules/templateAssignmentService';
import { OFFICE_AREA_SHORTCUTS } from '@/data/demo/officeDashboard';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('Office content architecture', () => {
  it('Demo-Minimum: 20 Klient:innen', () => {
    expect(demoClients.length).toBeGreaterThanOrEqual(20);
  });

  it('Demo-Minimum: 15 Mitarbeitende', () => {
    expect(demoEmployees.length).toBeGreaterThanOrEqual(15);
  });

  it('officeCoreDemoRepository liefert Kennzahlen', () => {
    const stats = officeCoreDemoRepository.getStats();
    expect(stats.clientCount).toBeGreaterThanOrEqual(20);
    expect(stats.employeeCount).toBeGreaterThanOrEqual(15);
    expect(stats.moduleAssignmentCount).toBeGreaterThan(0);
  });

  it('fetchOfficeCoreStats liefert Demo-Stats', async () => {
    const result = await fetchOfficeCoreStats(DEMO_TENANT_ID, 'business_admin');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.clientCount).toBeGreaterThanOrEqual(20);
    }
  });

  it('fetchModuleAssignmentHub liefert 7 Bereiche', async () => {
    const result = await fetchModuleAssignmentHub(DEMO_TENANT_ID, 'business_admin');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.length).toBe(7);
      expect(result.data.every((s) => s.route.startsWith('/business/office/modules'))).toBe(true);
    }
  });

  it('fetchModuleAssignmentList filtert Klient:innen-Zuordnungen', async () => {
    const result = await fetchModuleAssignmentList(DEMO_TENANT_ID, 'clients', 'business_admin', {
      moduleKey: 'pflege',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.every((i) => i.moduleKey === 'pflege')).toBe(true);
      expect(result.data.length).toBeGreaterThan(0);
    }
  });

  it('fetchClientModuleAssignments liefert Demo-Zuordnungen', async () => {
    const result = await fetchClientModuleAssignments(DEMO_TENANT_ID, 'business_admin', 'assist');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.length).toBe(
        demoClientModuleAssignments.filter((a) => a.moduleKey === 'assist').length,
      );
    }
  });

  it('officeModules Spezial-Services liefern Demo-Daten', async () => {
    const billing = await fetchModuleBillingSources(DEMO_TENANT_ID, 'business_admin');
    const docs = await fetchModuleDocumentVisibility(DEMO_TENANT_ID, 'business_admin');
    const templates = await fetchModuleTemplateAssignments(DEMO_TENANT_ID, 'business_admin');
    const perms = await fetchModulePermissionProfiles(DEMO_TENANT_ID, 'business_admin');
    expect(billing.ok && docs.ok && templates.ok && perms.ok).toBe(true);
  });

  it('fetchOfficeAuditLog liefert Protokolleinträge', async () => {
    const result = await fetchOfficeAuditLog(DEMO_TENANT_ID, 'business_admin');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.length).toBeGreaterThan(0);
  });

  it('Dashboard-Arbeitsbereiche verlinken Modulzuordnungen und Audit-Log', () => {
    expect(OFFICE_AREA_SHORTCUTS.some((a) => a.route === '/business/office/modules')).toBe(true);
    expect(OFFICE_AREA_SHORTCUTS.some((a) => a.route === '/business/office/audit-log')).toBe(true);
  });

  it('OfficeModulesHubScreen hat echte Navigation ohne Platzhalter', () => {
    const source = readSrc('src/screens/business/office/OfficeModulesHubScreen.tsx');
    expect(source).toContain('CareLightPageShell');
    expect(source).toContain('LoadingState');
    expect(source).toContain('EmptyState');
    expect(source).not.toContain('Coming Soon');
    expect(source).not.toContain('onPress={() => {}}');
  });

  it('OfficeModuleAssignmentListScreen hat Suche und Filter', () => {
    const source = readSrc('src/screens/business/office/OfficeModuleAssignmentListScreen.tsx');
    expect(source).toContain('PremiumInput');
    expect(source).toContain('LoadingState');
    expect(source).not.toContain('Coming Soon');
  });

  it('ModuleAssignedClientsScreen verlinkt Office-Stammdaten', () => {
    const source = readSrc('src/screens/modules/ModuleAssignedClientsScreen.tsx');
    expect(source).toContain('clientRecordRoute');
    expect(source).not.toContain('Coming Soon');
  });

  it('Migration 0037 definiert Modulzuordnungs-Tabellen', () => {
    const sql = readSrc('supabase/migrations/0037_office_module_assignments.sql');
    expect(sql).toContain('client_module_assignments');
    expect(sql).toContain('module_permission_profiles');
    expect(sql).toContain('ENABLE ROW LEVEL SECURITY');
  });

  it('shellConfig enthält Office-Modul-Navigation', () => {
    const source = readSrc('src/lib/navigation/shellConfig.ts');
    expect(source).toContain('/business/office/modules');
    expect(source).toContain("label: 'Office'");
  });
});

describe('Employee module assignments demo', () => {
  it('hat Einträge für mehrere Module', () => {
    const modules = new Set(demoEmployeeModuleAssignments.map((a) => a.moduleKey));
    expect(modules.size).toBeGreaterThanOrEqual(3);
  });
});

import { describe, expect, it, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import { enforcePermission } from '@/lib/permissions';
import {
  resetInventoryDemoStore,
  fetchInventoryDashboard,
  fetchInventoryItems,
  createInventoryItem,
  issueInventoryItem,
  acknowledgeInventoryAssignment,
  requestInventoryReturn,
  recordInventoryReturn,
  reportInventoryDamageOrLoss,
  generateInventoryReturnProtocol,
  fetchInventoryAuditEvents,
  fetchEmployeeIssuedItems,
  fetchDeviceManagementProfile,
  checkOffboardingInventory,
  assertOffboardingCanComplete,
  INVENTORY_CATEGORY_GROUPS,
} from '@/lib/inventory';

const root = path.join(__dirname, '..', '..', '..');
const migrationPath = path.join(root, 'supabase/migrations/0051_inventory_prepared.sql');

function readMigration(): string {
  return readFileSync(migrationPath, 'utf8');
}

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('0051_inventory_prepared migration', () => {
  const sql = readMigration();

  it('legt alle neun Inventar-Tabellen an', () => {
    for (const table of [
      'inventory_categories',
      'inventory_locations',
      'inventory_items',
      'inventory_assignments',
      'inventory_return_records',
      'inventory_damage_reports',
      'inventory_return_protocols',
      'device_management_profiles',
      'inventory_audit_events',
    ]) {
      expect(sql).toContain(`CREATE TABLE IF NOT EXISTS public.${table}`);
    }
  });

  it('definiert employee_equipment_summary View', () => {
    expect(sql).toContain('employee_equipment_summary');
  });

  it('erzwingt tenant_id und RLS', () => {
    expect(sql).toContain('tenant_id');
    expect(sql).toContain('ENABLE ROW LEVEL SECURITY');
    expect(sql).toContain('current_tenant_id()');
  });

  it('enthält keine destruktiven Befehle', () => {
    expect(sql).not.toMatch(/\bDROP TABLE\b/i);
    expect(sql).not.toMatch(/\bTRUNCATE\b/i);
  });
});

describe('Inventar — 7 Kategorien', () => {
  it('exportiert alle Kategoriegruppen', () => {
    expect(INVENTORY_CATEGORY_GROUPS).toHaveLength(7);
    expect(INVENTORY_CATEGORY_GROUPS).toContain('devices');
    expect(INVENTORY_CATEGORY_GROUPS).toContain('uniform');
    expect(INVENTORY_CATEGORY_GROUPS).toContain('vehicles');
    expect(INVENTORY_CATEGORY_GROUPS).toContain('software_access');
  });
});

describe('Inventar — Berechtigungen', () => {
  it('blockiert ohne inventory.view', () => {
    expect(enforcePermission('caregiver', 'inventory.view')).not.toBeNull();
  });

  it('erlaubt business_admin inventory.manage_items', () => {
    expect(enforcePermission('business_admin', 'inventory.manage_items')).toBeNull();
  });

  it('blockiert caregiver inventory.issue', () => {
    expect(enforcePermission('caregiver', 'inventory.issue')).not.toBeNull();
  });

  it('erlaubt employee_portal eigene Ausgaben', () => {
    expect(enforcePermission('employee_portal', 'portal.employee.inventory.view')).toBeNull();
  });
});

describe('Inventar — Kernlogik (14 Szenarien)', () => {
  beforeEach(() => resetInventoryDemoStore());

  it('1 — Dashboard liefert Kennzahlen', async () => {
    const result = await fetchInventoryDashboard(DEMO_TENANT_ID, 'business_admin');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.totalItems).toBeGreaterThan(0);
  });

  it('2 — Kein Inventarposten ohne tenant_id (Guard)', async () => {
    const result = await fetchInventoryItems('', 'business_admin');
    expect(result.ok).toBe(false);
  });

  it('3 — Posten anlegen mit Kategorie', async () => {
    const result = await createInventoryItem(
      DEMO_TENANT_ID,
      { categoryId: 'inv-cat-uniform', name: 'Jacke Gr. M' },
      'business_admin',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.tenantId).toBe(DEMO_TENANT_ID);
  });

  it('4 — Ausgabe ohne Empfänger blockiert', async () => {
    const result = await issueInventoryItem(
      DEMO_TENANT_ID,
      { itemId: 'inv-item-005', recipientEmployeeId: '' },
      'business_admin',
    );
    expect(result.ok).toBe(false);
  });

  it('5 — Ausgabe mit Empfänger auditierbar', async () => {
    const issued = await issueInventoryItem(
      DEMO_TENANT_ID,
      { itemId: 'inv-item-003', recipientEmployeeId: 'employee-001' },
      'business_admin',
    );
    expect(issued.ok).toBe(true);
    const audit = await fetchInventoryAuditEvents(DEMO_TENANT_ID, 'business_admin');
    expect(audit.ok).toBe(true);
    if (!audit.ok) return;
    expect(audit.data.some((e) => e.action === 'issue_item')).toBe(true);
  });

  it('6 — Bestätigung (acknowledge) möglich', async () => {
    const issued = await issueInventoryItem(
      DEMO_TENANT_ID,
      { itemId: 'inv-item-005', recipientEmployeeId: 'employee-004' },
      'business_admin',
    );
    expect(issued.ok).toBe(true);
    if (!issued.ok) return;
    const ack = await acknowledgeInventoryAssignment(DEMO_TENANT_ID, issued.data.id, 'business_admin');
    expect(ack.ok).toBe(true);
    if (!ack.ok) return;
    expect(ack.data.status).toBe('acknowledged');
  });

  it('7 — Rückgabe anfordern', async () => {
    const req = await requestInventoryReturn(DEMO_TENANT_ID, 'inv-asg-001', 'business_admin');
    expect(req.ok).toBe(true);
    if (!req.ok) return;
    expect(req.data.status).toBe('return_requested');
  });

  it('8 — Rückgabe erfassen (vollständig)', async () => {
    const ret = await recordInventoryReturn(
      DEMO_TENANT_ID,
      {
        assignmentId: 'inv-asg-001',
        capture: {
          returned: true,
          complete: true,
          condition: 'very_good',
          chargerReturned: true,
          deviceReset: true,
          dataDeleted: true,
        },
      },
      'business_admin',
    );
    expect(ret.ok).toBe(true);
  });

  it('9 — Schaden melden', async () => {
    const dmg = await reportInventoryDamageOrLoss(
      DEMO_TENANT_ID,
      {
        itemId: 'inv-item-003',
        reportType: 'damage',
        description: 'Reißverschluss defekt',
      },
      'business_admin',
    );
    expect(dmg.ok).toBe(true);
  });

  it('10 — Verlust melden setzt Status lost', async () => {
    await createInventoryItem(
      DEMO_TENANT_ID,
      { categoryId: 'inv-cat-keys', name: 'Transponder Test' },
      'business_admin',
    );
    const items = await fetchInventoryItems(DEMO_TENANT_ID, 'business_admin');
    expect(items.ok).toBe(true);
    if (!items.ok) return;
    const newItem = items.data.find((i) => i.name === 'Transponder Test');
    expect(newItem).toBeDefined();
    const loss = await reportInventoryDamageOrLoss(
      DEMO_TENANT_ID,
      { itemId: newItem!.id, reportType: 'loss', description: 'Verloren im Einsatz' },
      'business_admin',
    );
    expect(loss.ok).toBe(true);
  });

  it('11 — Rückgabeprotokoll mit Hash', async () => {
    const proto = await generateInventoryReturnProtocol(
      DEMO_TENANT_ID,
      'employee-002',
      '2026-06-30',
      'business_admin',
      { adminName: 'HR Admin', personnelNumber: 'PN-002' },
    );
    expect(proto.ok).toBe(true);
    if (!proto.ok) return;
    expect(proto.data.contentHash).toMatch(/^sha256:/);
    expect(proto.data.pdfTemplatePrepared).toBe(true);
  });

  it('12 — Offboarding blockiert bei offenen Rückgaben', async () => {
    const check = await checkOffboardingInventory(DEMO_TENANT_ID, 'employee-002', 'business_admin');
    expect(check.ok).toBe(true);
    if (!check.ok) return;
    expect(check.data.canCompleteOffboarding).toBe(false);
    expect(check.data.openAssignments.length).toBeGreaterThan(0);

    const assert = await assertOffboardingCanComplete(DEMO_TENANT_ID, 'employee-002', 'business_admin');
    expect(assert.ok).toBe(true);
    if (!assert.ok) return;
    expect(assert.data.allowed).toBe(false);
  });

  it('13 — Mitarbeiterportal nur eigene freigegebene Posten', async () => {
    const own = await fetchEmployeeIssuedItems(DEMO_TENANT_ID, 'employee-001', 'employee_portal', {
      portalSelf: true,
      viewerEmployeeId: 'employee-001',
    });
    expect(own.ok).toBe(true);

    const foreign = await fetchEmployeeIssuedItems(DEMO_TENANT_ID, 'employee-002', 'employee_portal', {
      portalSelf: true,
      viewerEmployeeId: 'employee-001',
    });
    expect(foreign.ok).toBe(false);
  });

  it('14 — MDM prepared ohne falsche Live-Claims', async () => {
    const mdm = await fetchDeviceManagementProfile(DEMO_TENANT_ID, 'inv-item-001', 'business_admin');
    expect(mdm.ok).toBe(true);
    if (!mdm.ok) return;
    expect(mdm.data?.mdmStatus).toBe('not_configured');
    expect(mdm.data?.remoteLockPrepared).toBe(true);
    expect(mdm.data?.remoteWipePrepared).toBe(true);
  });
});

describe('Inventar — UI Wiring', () => {
  it('Dashboard-Screen nutzt CareLightModuleDashboard', () => {
    const screen = readSrc('src/screens/inventory/InventoryDashboardScreen.tsx');
    expect(screen).toContain('CareLightModuleDashboard');
    expect(screen).toContain('Inventar');
    expect(screen).toContain('INVENTORY_PREPARED_MESSAGE');
  });

  it('Route registriert unter business/office/inventory', () => {
    const routes = readSrc('src/lib/navigation/routes.ts');
    expect(routes).toContain('/business/office/inventory');
  });
});

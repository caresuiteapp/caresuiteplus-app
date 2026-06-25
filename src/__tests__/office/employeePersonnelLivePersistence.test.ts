import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/lib/services/mode', () => ({
  getServiceMode: vi.fn(() => 'demo'),
}));

import {
  getEmployeeHomeOfficeOverride,
  persistEmployeeHomeOfficeOverride,
  resetEmployeeHomeOfficeOverrideStore,
} from '@/lib/office/employeeHomeOfficeService';
import {
  appendEmployeeAuditEvent,
  getEmployeeAuditEvents,
  mapEmployeeAuditEventRow,
  resetEmployeePersonnelAuditStore,
} from '@/lib/office/employeePersonnelAuditService';
import { mapInventoryAssignmentToWorkMaterial } from '@/lib/office/employeePersonnelFileMapper';

const TENANT = '56180c22-b894-4fab-b55e-a563c94dd6e7';
const EMPLOYEE = '1bf39e72-8ae1-480e-9dfb-bcb5aa7b6a4f';

describe('employee personnel live persistence helpers', () => {
  beforeEach(() => {
    resetEmployeeHomeOfficeOverrideStore();
    resetEmployeePersonnelAuditStore();
    vi.unstubAllEnvs();
  });

  it('speichert Homeoffice-Override im lokalen Cache', async () => {
    const saved = await persistEmployeeHomeOfficeOverride(TENANT, EMPLOYEE, true);
    expect(saved.ok).toBe(true);
    expect(getEmployeeHomeOfficeOverride(EMPLOYEE, TENANT)).toBe(true);

    await persistEmployeeHomeOfficeOverride(TENANT, EMPLOYEE, null);
    expect(getEmployeeHomeOfficeOverride(EMPLOYEE, TENANT)).toBeNull();
  });

  it('mappt Inventar-Ausgaben auf Arbeitsmaterial', () => {
    const material = mapInventoryAssignmentToWorkMaterial({
      id: 'assign-1',
      tenant_id: TENANT,
      recipient_employee_id: EMPLOYEE,
      status: 'return_requested',
      issued_at: '2024-06-01T10:00:00.000Z',
      expected_return_at: '2026-05-15T00:00:00.000Z',
      created_at: '2024-06-01T10:00:00.000Z',
      updated_at: '2024-06-01T10:00:00.000Z',
      inventory_items: {
        name: 'Dienstkleidung Set',
        inventory_categories: { group_key: 'uniform' },
      },
    });

    expect(material.itemName).toBe('Dienstkleidung Set');
    expect(material.category).toBe('uniform');
    expect(material.status).toBe('return_pending');
  });

  it('hält Audit-Events tenant-scoped im Cache', async () => {
    await appendEmployeeAuditEvent({
      tenantId: TENANT,
      employeeId: EMPLOYEE,
      action: 'document_uploaded',
      actorId: null,
      actorRole: null,
      summary: 'Dokument hochgeladen.',
    });

    const events = getEmployeeAuditEvents(EMPLOYEE, TENANT);
    expect(events).toHaveLength(1);
    expect(events[0]?.action).toBe('document_uploaded');
  });

  it('mappt Audit-Zeilen aus Supabase', () => {
    const event = mapEmployeeAuditEventRow({
      id: 'audit-1',
      tenant_id: TENANT,
      employee_id: EMPLOYEE,
      action: 'roles_permissions_updated',
      actor_id: null,
      actor_role: 'business_admin',
      summary: 'Rolle geändert.',
      field_changes: { roleKey: { before: 'caregiver', after: 'dispatch' } },
      created_at: '2026-06-17T10:00:00.000Z',
      updated_at: '2026-06-17T10:00:00.000Z',
    });

    expect(event.actorRole).toBe('business_admin');
    expect(event.fieldChanges?.roleKey?.after).toBe('dispatch');
  });
});

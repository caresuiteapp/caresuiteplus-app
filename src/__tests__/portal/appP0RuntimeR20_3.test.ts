import { beforeEach, describe, expect, it, vi } from 'vitest';
import { normalizeEmployeePortalAssignmentDetail } from '@/lib/portal/normalizeEmployeePortalAssignmentDetail';

const rpc = vi.fn();
const from = vi.fn();

vi.mock('@/lib/supabase/client', () => ({
  getSupabaseClient: () => ({ rpc, from }),
}));

vi.mock('@/lib/permissions', () => ({
  enforcePermission: () => null,
}));

vi.mock('@/lib/services/liveServiceGuard', () => ({
  guardServiceTenant: () => null,
}));

vi.mock('@/lib/office/officemessageauditservice', () => ({
  auditFromThread: () => ({}),
  logOfficeMessageAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/office/officemessagenotifications', () => ({
  buildNewMessageNotification: () => ({ title: 'Neu', body: 'Neu' }),
  notifyOfficeMessageEvent: vi.fn().mockResolvedValue(undefined),
}));

import { createPortalOfficeThread } from '@/lib/office/portalofficemessageservice';

const tenantId = '11111111-1111-1111-1111-111111111111';
const actor = {
  audience: 'employee' as const,
  roleKey: 'employee_portal' as const,
  clientId: null,
  employeeId: '22222222-2222-2222-2222-222222222222',
  profileId: '33333333-3333-3333-3333-333333333333',
  displayName: 'Mitarbeiter Test',
};

describe('App P0 runtime gate R20.3', () => {
  beforeEach(() => {
    rpc.mockReset();
    from.mockReset();
  });

  it('normalizes malformed live/cache data without losing the executable visit', () => {
    const result = normalizeEmployeePortalAssignmentDetail(
      {
        assignmentId: null,
        tenantId: null,
        status: 'unexpected',
        tasks: [null, { id: 'task-2', title: null, required: true, status: 'unexpected' }],
        statusHistory: null,
        pauseEvents: { broken: true },
        enabledModules: ['photos', 'body_map', 'unknown'],
      },
      { assignmentId: 'visit-1', tenantId },
    );

    expect(result.assignmentId).toBe('visit-1');
    expect(result.tenantId).toBe(tenantId);
    expect(result.status).toBe('bestaetigt');
    expect(result.tasks).toHaveLength(2);
    expect(result.tasks.every((task) => task.required === false)).toBe(true);
    expect(result.statusHistory).toEqual([]);
    expect(result.pauseEvents).toEqual([]);
    expect(result.enabledModules).toEqual(['photos']);
    expect(result.requiresDocumentation).toBe(true);
    expect(result.canStartExecution).toBe(true);
  });

  it('creates a portal thread and first message through one atomic RPC', async () => {
    rpc.mockResolvedValue({
      error: null,
      data: {
        id: 'thread-1',
        tenant_id: tenantId,
        thread_type: 'employee',
        status: 'new',
        priority: 'normal',
        subject: 'Dienstplan',
        employee_id: actor.employeeId,
        created_at: '2026-09-02T10:00:00.000Z',
        updated_at: '2026-09-02T10:00:00.000Z',
      },
    });

    const result = await createPortalOfficeThread(tenantId, actor, {
      categoryId: null,
      subject: 'Dienstplan',
      initialMessage: 'Bitte prüfen.',
    });

    expect(result.ok).toBe(true);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('portal_create_office_thread', {
      p_tenant_id: tenantId,
      p_audience: 'employee',
      p_subject: 'Dienstplan',
      p_category_id: null,
      p_initial_message: 'Bitte prüfen.',
    });
    expect(from).not.toHaveBeenCalled();
  });

  it('does not retry a denied atomic message write with a duplicate legacy insert', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { code: '42501', message: 'permission denied' },
    });

    const result = await createPortalOfficeThread(tenantId, actor, {
      categoryId: null,
      subject: 'Dienstplan',
      initialMessage: 'Bitte prüfen.',
    });

    expect(result).toEqual({ ok: false, error: 'Kein Zugriff auf diesen Datensatz (RLS).' });
    expect(from).not.toHaveBeenCalled();
  });
});

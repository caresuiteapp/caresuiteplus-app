import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  assignmentStatusToRemote,
  remoteStatusToAssignment,
} from '@/lib/assist/assignmentStatusBridge';
import {
  getAllowedAssignmentTransitions,
  requiresDocumentationBeforeComplete,
  validateAssignmentTransition,
} from '@/lib/assist/assignmentStatusMachine';
import {
  hasAssignmentProductionErrors,
  validateAssignmentCreateForm,
} from '@/lib/assist/assignmentProductionValidation';
import { assignmentSupabaseRepository } from '@/lib/assist/repositories/assignmentRepository.supabase';
import { writeAssignmentAudit } from '@/lib/assist/assignmentAuditHelper';

const mockFrom = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockOrder = vi.fn();
const mockMaybeSingle = vi.fn();
const mockSingle = vi.fn();
const mockRpc = vi.fn();

function createQueryChain(finalData: unknown = [], finalError: unknown = null) {
  const chain = {
    select: mockSelect.mockReturnThis(),
    eq: mockEq.mockReturnThis(),
    order: mockOrder.mockReturnThis(),
    insert: mockInsert.mockReturnThis(),
    update: mockUpdate.mockReturnThis(),
    maybeSingle: mockMaybeSingle.mockResolvedValue({ data: finalData, error: finalError }),
    single: mockSingle.mockResolvedValue({ data: finalData, error: finalError }),
    then: undefined as unknown,
  };

  chain.then = (resolve: (value: { data: unknown; error: unknown }) => void) =>
    Promise.resolve({ data: finalData, error: finalError }).then(resolve);

  return chain;
}

vi.mock('@/lib/supabase/client', () => ({
  getSupabaseClient: () => ({
    from: mockFrom,
    rpc: mockRpc,
  }),
}));

vi.mock('@/lib/supabase/untypedTable', () => ({
  fromUnknownTable: (_client: unknown, table: string) => {
    if (table === 'assignment_audit_events') {
      return {
        insert: mockInsert.mockResolvedValue({ error: null }),
        update: mockUpdate.mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        }),
        select: mockSelect.mockReturnValue(createQueryChain([])),
      };
    }
    return {
      select: mockSelect.mockReturnValue(createQueryChain([])),
      update: mockUpdate.mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      }),
      insert: mockInsert.mockReturnThis(),
    };
  },
}));

const root = path.join(__dirname, '..', '..', '..');

describe('Assist assignment production stabilization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockImplementation(() => createQueryChain([]));
    mockRpc.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('assignmentStatusBridge', () => {
    it('mappt lokalen Status auf remote assignment_status', () => {
      expect(assignmentStatusToRemote('geplant')).toBe('planned');
      expect(assignmentStatusToRemote('unterwegs')).toBe('on_the_way');
      expect(assignmentStatusToRemote('abgeschlossen')).toBe('completed');
    });

    it('mappt remote assignment_status auf lokalen Status', () => {
      expect(remoteStatusToAssignment('started')).toBe('gestartet');
      expect(remoteStatusToAssignment('documentation_open')).toBe('dokumentation_offen');
    });
  });

  describe('assignmentStatusMachine', () => {
    it('erlaubt gültige Übergänge', () => {
      expect(validateAssignmentTransition('geplant', 'unterwegs').valid).toBe(true);
      expect(validateAssignmentTransition('gestartet', 'beendet').valid).toBe(true);
    });

    it('blockiert ungültige Übergänge', () => {
      const result = validateAssignmentTransition('geplant', 'abgeschlossen');
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain('nicht erlaubt');
      }
    });

    it('kennt erlaubte Folge-Status', () => {
      expect(getAllowedAssignmentTransitions('unterwegs')).toContain('angekommen');
    });

    it('fordert Dokumentation vor Abschluss', () => {
      expect(requiresDocumentationBeforeComplete('beendet')).toBe(true);
      expect(requiresDocumentationBeforeComplete('gestartet')).toBe(false);
    });
  });

  describe('assignmentProductionValidation', () => {
    it('validiert Pflichtfelder beim Anlegen', () => {
      const errors = validateAssignmentCreateForm({
        clientId: '',
        employeeId: '',
        assignmentDate: '',
        plannedStartTime: '',
        plannedEndTime: '',
        title: '',
        tasks: [],
      });
      expect(hasAssignmentProductionErrors(errors)).toBe(true);
      expect(errors.clientId).toBeTruthy();
      expect(errors.tasks).toBeTruthy();
    });

    it('akzeptiert gültiges Formular', () => {
      const errors = validateAssignmentCreateForm({
        clientId: 'client-1',
        employeeId: 'employee-1',
        assignmentDate: '2026-06-15',
        plannedStartTime: '09:00',
        plannedEndTime: '10:30',
        title: 'Alltagsbegleitung',
        tasks: ['Einkauf'],
      });
      expect(hasAssignmentProductionErrors(errors)).toBe(false);
    });
  });

  describe('assignmentSupabaseRepository.list', () => {
    it('filtert mandantenseitig nach tenant_id', async () => {
      mockSelect.mockReturnValue(createQueryChain([
          {
            id: 'a-1',
            tenant_id: 'tenant-a',
            client_id: 'c-1',
            employee_id: 'e-1',
            assignment_date: '2026-06-15',
            planned_start_at: '2026-06-15T07:00:00.000Z',
            planned_end_at: '2026-06-15T08:00:00.000Z',
            status: 'planned',
            title: 'Einsatz',
            address_snapshot: 'Berlin',
            updated_at: '2026-06-15T07:00:00.000Z',
            created_at: '2026-06-15T07:00:00.000Z',
            clients: { first_name: 'Anna', last_name: 'Aktiv' },
            employees: { first_name: 'Tom', last_name: 'Tester' },
          },
        ]));

      const result = await assignmentSupabaseRepository.list('tenant-a');

      expect(result.ok).toBe(true);
      expect(mockEq).toHaveBeenCalledWith('tenant_id', 'tenant-a');
    });
  });

  it('Migration 0044 fügt Produktions-Spalten mit IF NOT EXISTS hinzu', () => {
    const sql = readFileSync(
      path.join(root, 'supabase/migrations/0044_assignments_production.sql'),
      'utf8',
    );
    expect(sql).toContain('on_the_way_at');
    expect(sql).toContain('assignment_audit_events');
  });

  it('Migration 0070 spiegelt Live-Deploy für fehlende assignments-Spalten', () => {
    const sql = readFileSync(
      path.join(root, 'supabase/migrations/0070_assignments_production_live.sql'),
      'utf8',
    );
    const listSelect = readFileSync(
      path.join(root, 'src/lib/assist/repositories/assignmentRepository.supabase.ts'),
      'utf8',
    );
    for (const column of [
      'on_the_way_at',
      'arrived_at',
      'finished_at',
      'documentation_notes',
    ] as const) {
      expect(sql).toContain(column);
      expect(listSelect).toContain(column);
    }
    expect(sql).toContain('assignment_audit_events');
  });

  describe('writeAssignmentAudit', () => {
    it('schreibt Audit-Eintrag bei Statuswechsel', async () => {
      const supabase = { from: mockFrom } as never;
      await writeAssignmentAudit(supabase, {
        tenantId: 'tenant-a',
        assignmentId: 'a-1',
        action: 'status_change',
        fromStatus: 'geplant',
        toStatus: 'unterwegs',
        actor: { actorDisplayName: 'Tester' },
      });

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          tenant_id: 'tenant-a',
          assignment_id: 'a-1',
          action: 'status_change',
          from_status: 'geplant',
          to_status: 'unterwegs',
        }),
      );
    });
  });
});

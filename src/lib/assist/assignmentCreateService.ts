import type { RoleKey, ServiceResult } from '@/types';
import { createDemoAssignmentSeed } from '@/data/demo/assistAssignments';
import { enforcePermission } from '@/lib/permissions';
import { getServiceMode } from '@/lib/services/mode';
import { assertTenantForMode } from '@/lib/tenant/tenantResolver';
import {
  buildPlannedTimestamps,
  hasAssignmentProductionErrors,
  validateAssignmentCreateForm,
  type AssignmentCreateFormData,
} from '@/lib/assist/assignmentProductionValidation';
import { assignmentSupabaseRepository } from '@/lib/assist/repositories/assignmentRepository.supabase';
import type { AssignmentMutationContext } from '@/lib/assist/assignmentAuditHelper';

export async function createAssignment(
  tenantId: string,
  form: AssignmentCreateFormData,
  actorRoleKey?: RoleKey | null,
  mutationContext?: AssignmentMutationContext,
): Promise<ServiceResult<{ id: string }>> {
  const denied = enforcePermission<{ id: string }>(actorRoleKey, 'assist.assignments.manage');
  if (denied) return denied;

  const tenantErr = assertTenantForMode(tenantId);
  if (tenantErr) return { ok: false, error: tenantErr.error };

  const errors = validateAssignmentCreateForm(form);
  if (hasAssignmentProductionErrors(errors)) {
    return { ok: false, error: 'Bitte Pflichtfelder ausfüllen.' };
  }

  const { plannedStartAt, plannedEndAt } = buildPlannedTimestamps(form);
  const taskTitles = form.tasks.map((t) => t.trim()).filter(Boolean);

  if (getServiceMode() === 'supabase') {
    return assignmentSupabaseRepository.create(
      tenantId,
      {
        clientId: form.clientId,
        employeeId: form.employeeId,
        assignmentDate: form.assignmentDate,
        plannedStartAt,
        plannedEndAt,
        title: form.title,
        tasks: taskTitles,
      },
      mutationContext,
    );
  }

  await new Promise((r) => setTimeout(r, 320));
  const created = createDemoAssignmentSeed({
    clientId: form.clientId,
    employeeId: form.employeeId,
    title: form.title,
    scheduledStart: plannedStartAt,
    scheduledEnd: plannedEndAt,
    location: '—',
    notes: taskTitles.join(', '),
  });
  return { ok: true, data: { id: created.id } };
}

export type { AssignmentCreateFormData };

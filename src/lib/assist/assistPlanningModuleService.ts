import type { RoleKey, ServiceResult } from '@/types';
import { assistPlanningDemo } from '@/data/demo/domains/assistPlanningDemo';
import { fetchDomainModuleSnapshot } from '@/lib/services/fetchDomainModuleSnapshot';
import { assignmentSupabaseRepository } from '@/lib/services/repositories/assignmentRepository.supabase';

/** WP247 — Assist Planning Modul-Service */
export async function fetchAssignmentModuleSnapshot(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<{ wp: number; domain: string; recordCount: number; labels: string[] }>> {
  return fetchDomainModuleSnapshot(tenantId, actorRoleKey, {
    permission: 'assist.assignments.view',
    wp: 247,
    domain: 'assistPlanning',
    demoRecords: assistPlanningDemo.records,
    supabaseRepo: assignmentSupabaseRepository,
  });
}

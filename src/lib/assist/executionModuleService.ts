import type { RoleKey, ServiceResult } from '@/types';
import { executionDemo } from '@/data/demo/domains/executionDemo';
import { fetchDomainModuleSnapshot } from '@/lib/services/fetchDomainModuleSnapshot';
import { executionSupabaseRepository } from '@/lib/services/repositories/executionRepository.supabase';

/** WP267 — Execution Modul-Service */
export async function fetchExecutionModuleSnapshot(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<{ wp: number; domain: string; recordCount: number; labels: string[] }>> {
  return fetchDomainModuleSnapshot(tenantId, actorRoleKey, {
    permission: 'assist.execution.view',
    wp: 267,
    domain: 'execution',
    demoRecords: executionDemo.records,
    supabaseRepo: executionSupabaseRepository,
  });
}

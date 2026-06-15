import type { RoleKey, ServiceResult } from '@/types';
import type { AiJobListItem } from '@/types/modules/platform';
import { getDemoAiJobById, getDemoAiJobs } from '@/data/demo/aiJobs';
import { enforcePermission } from '@/lib/permissions';
import { runService } from '@/lib/services/serviceRunner';

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function fetchAiJobList(
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<AiJobListItem[]>> {
  const denied = enforcePermission<AiJobListItem[]>(actorRoleKey, 'platform.ai.view');
  if (denied) return denied;
  return runService(async () => {
    await delay(320);
    return { ok: true, data: getDemoAiJobs() };
  });
}

export async function fetchAiJobDetail(
  jobId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<AiJobListItem>> {
  const denied = enforcePermission<AiJobListItem>(actorRoleKey, 'platform.ai.view');
  if (denied) return denied;
  return runService(async () => {
    await delay(280);
    const job = getDemoAiJobById(jobId);
    if (!job) return { ok: false, error: 'KI-Job nicht gefunden.' };
    return { ok: true, data: job };
  });
}

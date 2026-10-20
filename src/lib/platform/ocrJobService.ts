import type { RoleKey, ServiceResult } from '@/types';
import type { OcrJobListItem } from '@/types/modules/platform';
import {
  createDemoOcrJob,
  getDemoOcrJobById,
  getDemoOcrJobs,
  retryDemoOcrJob,
} from '@/data/demo/ocrJobs';
import { enforcePermission } from '@/lib/permissions';
import { runService } from '@/lib/services/serviceRunner';

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function fetchOcrJobList(
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<OcrJobListItem[]>> {
  const denied = enforcePermission<OcrJobListItem[]>(actorRoleKey, 'platform.ocr.view');
  if (denied) return denied;
  return runService(async () => {
    await delay(320);
    return { ok: true, data: getDemoOcrJobs() };
  });
}

export async function fetchOcrJobDetail(
  jobId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<OcrJobListItem>> {
  const denied = enforcePermission<OcrJobListItem>(actorRoleKey, 'platform.ocr.view');
  if (denied) return denied;
  return runService(async () => {
    await delay(280);
    const job = getDemoOcrJobById(jobId);
    if (!job) return { ok: false, error: 'OCR-Job nicht gefunden.' };
    return { ok: true, data: job };
  });
}

export async function retryOcrJob(
  jobId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<OcrJobListItem>> {
  const denied = enforcePermission<OcrJobListItem>(actorRoleKey, 'platform.ocr.manage');
  if (denied) return denied;
  return runService(async () => {
    await delay(400);
    const job = retryDemoOcrJob(jobId);
    if (!job) return { ok: false, error: 'Job konnte nicht erneut gestartet werden.' };
    return { ok: true, data: job };
  });
}

export async function triggerOcrForDocument(
  documentId: string,
  title: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<OcrJobListItem>> {
  const denied = enforcePermission<OcrJobListItem>(actorRoleKey, 'platform.ocr.manage');
  if (denied) return denied;
  return runService(async () => {
    await delay(500);
    return { ok: true, data: createDemoOcrJob(documentId, title) };
  });
}

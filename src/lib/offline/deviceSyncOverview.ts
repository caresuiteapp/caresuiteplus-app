import { protectedDataStorage } from '@/lib/security/protectedDataStorage';
import { readAssignmentListCache } from './assignmentCacheService';
export type DeviceSyncScope = { tenantId: string; userId: string; employeeId: string | null; clientId: string | null; accountId: string; roleKey: string };
export type DevicePendingDraft = { key: string; title: string; assignmentId: string; route: string };
export type DeviceSyncOverview = { cachedAt: string | null; pending: DevicePendingDraft[] };

/** Inspect only the exact current actor's local drafts. Never replay business writes. */
export async function readDeviceSyncOverview(scope: DeviceSyncScope): Promise<DeviceSyncOverview> {
  const actorId = scope.employeeId ?? scope.clientId;
  if (!scope.tenantId || !scope.userId || !actorId) return { cachedAt: null, pending: [] };
  const cached = await readAssignmentListCache(scope.tenantId, actorId);
  if (!scope.employeeId) return { cachedAt: cached?.cachedAt ?? null, pending: [] };
  const taskPrefix = `employee-execution-task-drafts:${scope.tenantId}:${scope.employeeId}:`;
  const documentPrefix = `portal-visit-workflow-${scope.tenantId}:${scope.userId}:${scope.employeeId}:${scope.accountId}:${scope.roleKey}:visit:`;
  const keys = (await protectedDataStorage.getAllKeys()).filter(key => key.startsWith(taskPrefix) || key.startsWith(documentPrefix));
  const pending: DevicePendingDraft[] = [];
  for (const key of keys) {
    const raw = await protectedDataStorage.getItem(key);
    if (!raw) continue;
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
    const data = value as Record<string, unknown>;
    const tasks = key.startsWith(taskPrefix);
    const hasDraft = tasks ? Object.keys(data).length > 0 : data.documentationSubmitted !== true
      && ['documentationDraftText','documentationSpecialNotes','documentationDeviations','documentationDeviationJustification'].some(field => typeof data[field] === 'string' && String(data[field]).trim());
    if (!hasDraft) continue;
    const assignmentId = key.slice((tasks ? taskPrefix : documentPrefix).length);
    if (!/^[a-zA-Z0-9_:-]{1,200}$/.test(assignmentId)) continue;
    pending.push({ key, title: tasks ? 'Aufgabenentwurf' : 'Dokumentationsentwurf', assignmentId,
      route: `/portal/employee/assignments/${encodeURIComponent(assignmentId)}/execute` });
  }
  return { cachedAt: cached?.cachedAt ?? null, pending };
}

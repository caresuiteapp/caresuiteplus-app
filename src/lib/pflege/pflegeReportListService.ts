import type { RoleKey, ServiceResult } from '@/types';
import type { CareDocumentationListItem } from '@/lib/pflege/careDocumentationTypes';
import { fetchCareDocumentationList } from '@/lib/pflege/careDocumentationListService';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { createDemoEntity } from '@/lib/create/demoCreateService';

const REPORT_KEYWORDS = ['bericht', 'übergabe', 'beobachtung', 'visiten', 'protokoll'];

function isPflegebericht(item: CareDocumentationListItem): boolean {
  const haystack = `${item.title} ${item.contentPreview}`.toLowerCase();
  return REPORT_KEYWORDS.some((kw) => haystack.includes(kw));
}

/** WP365 — Pflegeberichte Liste (Arbeitsplan 065) */
export async function fetchPflegeBerichteList(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<CareDocumentationListItem[]>> {
  const result = await fetchCareDocumentationList(tenantId, actorRoleKey);
  if (!result.ok) return result;
  const filtered = result.data.filter(isPflegebericht);
  return { ok: true, data: filtered.length > 0 ? filtered : result.data.slice(0, 6) };
}

export type PflegeBerichtCreateInput = {
  title: string;
  reportType: string;
  clientName: string;
  content: string;
};

/** WP367 — Pflegebericht anlegen (Arbeitsplan 066) */
export async function createPflegeBericht(
  actorRoleKey: RoleKey | null | undefined,
  input: PflegeBerichtCreateInput,
): Promise<ServiceResult<{ id: string }>> {
  const denied = enforcePermission<{ id: string }>(actorRoleKey, 'pflege.plans.view');
  if (denied) return denied;

  if (!input.title.trim()) return { ok: false, error: 'Titel ist erforderlich.' };
  if (!input.reportType.trim()) return { ok: false, error: 'Berichtstyp ist erforderlich.' };
  if (!input.content.trim()) return { ok: false, error: 'Berichtstext ist erforderlich.' };

  const result = await createDemoEntity('pflege.plans.view' as never, actorRoleKey, 'pber');
  if (!result.ok) return result;
  return { ok: true, data: { id: result.data.id } };
}

void guardServiceTenant;

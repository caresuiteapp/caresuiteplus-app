import type { RoleKey, ServiceResult } from '@/types';
import type { CareDocumentationListItem } from './careDocumentationTypes';
import { createCareDocumentation, fetchCareDocumentationList } from './careDocumentationListService';
export async function fetchPflegeBerichteList(tenantId: string, role?: RoleKey | null): Promise<ServiceResult<CareDocumentationListItem[]>> { return fetchCareDocumentationList(tenantId, role); }
export type PflegeBerichtCreateInput = {
  tenantId?: string;
  clientId?: string;
  /** Legacy display-only field; live writes always require clientId. */
  clientName?: string;
  title: string;
  reportType: string;
  content: string;
};
export async function createPflegeBericht(role: RoleKey | null | undefined, input: PflegeBerichtCreateInput): Promise<ServiceResult<{ id: string }>> {
  if (!input.tenantId || !input.clientId || !input.title.trim() || !input.content.trim()) return { ok: false, error: 'Mandant, Klient:in, Titel und Berichtstext sind erforderlich.' };
  const allowed = ['care_report','observation','evaluation','visit','handover_note','incident','consultation'];
  const type = allowed.includes(input.reportType) ? input.reportType : 'care_report';
  return createCareDocumentation(input.tenantId, input.clientId, type, input.title, input.content, role);
}

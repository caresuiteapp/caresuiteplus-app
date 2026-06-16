import type { AssistServiceCatalogAuditEvent } from '@/types/assistServiceCatalog';
import { appendAssistServiceCatalogAuditEvent } from './assistServiceCatalogStore';

export function recordAssistServiceCatalogAudit(
  tenantId: string,
  input: Omit<AssistServiceCatalogAuditEvent, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>,
): AssistServiceCatalogAuditEvent {
  const now = new Date().toISOString();
  return appendAssistServiceCatalogAuditEvent(tenantId, {
    id: `asc-audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    tenantId,
    createdAt: now,
    updatedAt: now,
    ...input,
  });
}

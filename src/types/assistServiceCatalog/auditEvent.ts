import type { TenantScopedEntity } from '../core/base';

export type AssistServiceCatalogAuditAction =
  | 'service_created'
  | 'service_updated'
  | 'task_template_added'
  | 'rate_version_set'
  | 'billing_rule_set'
  | 'documentation_requirement_set'
  | 'assignment_template_generated';

export type AssistServiceCatalogAuditEvent = TenantScopedEntity & {
  serviceCatalogItemId: string | null;
  action: AssistServiceCatalogAuditAction;
  summary: string;
  payload: Record<string, unknown>;
  actorUserId: string | null;
};

import type { TemplateModuleKey } from '@/types/templates';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useTemplates } from './useTemplates';

/** Textbausteine = documentation_text + message Vorlagen */
export function useTextBlocks(moduleKey?: TemplateModuleKey) {
  const tenantId = useServiceTenantId();
  const docs = useTemplates({ templateType: 'documentation_text', moduleKey, status: 'active' });
  const messages = useTemplates({ templateType: 'message', moduleKey, status: 'active' });

  return {
    textBlocks: [...docs.templates, ...messages.templates],
    loading: docs.loading || messages.loading,
    error: docs.error ?? messages.error,
    refresh: async () => {
      await docs.refresh();
      await messages.refresh();
    },
    serviceMode: docs.serviceMode,
    tenantId: tenantId ?? docs.tenantId,
  };
}

import { useCallback, useEffect, useState } from 'react';
import type { DocumentEngineTemplateListItem } from '@/types/documents/documentEngine';
import { loadTemplatesForModuleContext } from '@/lib/documents/documentEngineService';
import { useAuth } from '@/lib/auth/context';

export type UseDocumentModuleTemplatesInput = {
  tenantId: string | null | undefined;
  targetModule: string;
  targetArea: string;
  triggerEvent?: string;
  assistOnly?: boolean;
};

export function useDocumentModuleTemplates(input: UseDocumentModuleTemplatesInput) {
  const { profile } = useAuth();
  const [templates, setTemplates] = useState<DocumentEngineTemplateListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!input.tenantId) {
      setTemplates([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const result = await loadTemplatesForModuleContext({
      tenantId: input.tenantId,
      targetModule: input.targetModule,
      targetArea: input.targetArea,
      triggerEvent: input.triggerEvent,
      assistOnly: input.assistOnly,
      actorRoleKey: profile?.roleKey,
    });
    if (result.ok) setTemplates(result.data);
    else setError(result.error);
    setLoading(false);
  }, [
    input.tenantId,
    input.targetModule,
    input.targetArea,
    input.triggerEvent,
    input.assistOnly,
    profile?.roleKey,
  ]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { templates, loading, error, reload };
}

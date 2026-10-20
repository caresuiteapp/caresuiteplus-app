import { useMemo, useState } from 'react';
import { renderTemplateWithVariables } from '@/lib/templates';
import { useServiceTenantId } from '@/hooks/useTenantId';

export function useTemplateVariables(initialContent = '') {
  const tenantId = useServiceTenantId();
  const [content, setContent] = useState(initialContent);
  const [variables, setVariables] = useState<Record<string, string>>({});

  const preview = useMemo(
    () => renderTemplateWithVariables(content, variables),
    [content, variables],
  );

  const setVariable = (key: string, value: string) => {
    setVariables((prev) => ({ ...prev, [key]: value }));
  };

  return {
    content,
    setContent,
    variables,
    setVariable,
    setVariables,
    preview,
    tenantId,
  };
}

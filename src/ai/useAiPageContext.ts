import { useEffect } from 'react';
import type { AiPageContextSnapshot } from './aiToolTypes';
import { clearRegisteredPageContext, setRegisteredPageContext } from './registerAiPageContext';

const CONTEXT_KEYS: (keyof AiPageContextSnapshot)[] = [
  'pageTitle',
  'entityType',
  'entityId',
  'entityLabel',
  'activeTab',
  'summary',
  'metadata',
];

export function useAiPageContext(context: Partial<AiPageContextSnapshot>): void {
  useEffect(() => {
    setRegisteredPageContext(context);
    return () => {
      clearRegisteredPageContext(CONTEXT_KEYS);
    };
  }, [
    context.pageTitle,
    context.entityType,
    context.entityId,
    context.entityLabel,
    context.activeTab,
    context.summary,
    JSON.stringify(context.metadata ?? {}),
  ]);
}

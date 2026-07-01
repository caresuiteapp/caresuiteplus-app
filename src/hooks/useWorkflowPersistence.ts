import { useCallback, useEffect, useRef } from 'react';
import { useLocalSearchParams, usePathname, useRouter } from 'expo-router';
import {
  clearVisitWorkflowSnapshot,
  mergeVisitWorkflowSnapshot,
  readVisitWorkflowSnapshot,
  writeVisitWorkflowSnapshot,
  type VisitWorkflowUiState,
} from '@/lib/portal/visitWorkflowPersistence';

export type { VisitWorkflowSnapshot, VisitWorkflowUiState } from '@/lib/portal/visitWorkflowPersistence';
export {
  clearVisitWorkflowSnapshot,
  mergeVisitWorkflowSnapshot,
  readVisitWorkflowSnapshot,
  writeVisitWorkflowSnapshot,
} from '@/lib/portal/visitWorkflowPersistence';

type Options = {
  enabled?: boolean;
};

/**
 * Persists visit execution UI state across rotation / soft reload within the same tab session.
 * Syncs workflow step to URL ?step= for deep-link restore.
 */
export function useWorkflowPersistence(visitId: string | undefined, options: Options = {}) {
  const { enabled = true } = options;
  const pathname = usePathname();
  const router = useRouter();
  const { step: urlStepRaw } = useLocalSearchParams<{ step?: string }>();
  const urlStep = Array.isArray(urlStepRaw) ? urlStepRaw[0] : urlStepRaw;
  const hydratedRef = useRef(false);

  const persist = useCallback(
    (partial: VisitWorkflowUiState) => {
      if (!enabled || !visitId) return;
      const next = mergeVisitWorkflowSnapshot(visitId, pathname, partial);
      writeVisitWorkflowSnapshot(next);
    },
    [enabled, visitId, pathname],
  );

  const setStep = useCallback(
    (step: string | null | undefined) => {
      if (!enabled || !visitId) return;
      persist({ step: step ?? null });
      router.setParams({ step: step ?? undefined } as Record<string, string | undefined>);
    },
    [enabled, visitId, persist, router],
  );

  const restore = useCallback((): ReturnType<typeof readVisitWorkflowSnapshot> => {
    if (!enabled || !visitId) return null;
    return readVisitWorkflowSnapshot(visitId);
  }, [enabled, visitId]);

  const clear = useCallback(() => {
    if (!visitId) return;
    clearVisitWorkflowSnapshot(visitId);
    router.setParams({ step: undefined } as Record<string, string | undefined>);
  }, [visitId, router]);

  const markHydrated = useCallback(() => {
    hydratedRef.current = true;
  }, []);

  useEffect(() => {
    if (!enabled || !visitId || hydratedRef.current) return;
    const snapshot = readVisitWorkflowSnapshot(visitId);
    if (snapshot?.step && !urlStep) {
      router.setParams({ step: snapshot.step } as Record<string, string | undefined>);
    }
  }, [enabled, visitId, urlStep, router]);

  return {
    urlStep: urlStep ?? null,
    setStep,
    persist,
    restore,
    clear,
    hydratedRef,
    markHydrated,
  };
}

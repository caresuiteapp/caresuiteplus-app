/**
 * ASSIST.WORKFLOW.3 — Optimistic task drafts with debounced batch save.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { EmployeePortalTaskItem } from '@/types/modules/employeePortalExecution';
import type { ExtendedAssignmentTaskStatus } from '@/types/modules/assignmentWorkflow';
import {
  saveTaskResultsBatch,
  type TaskResultBatchItem,
} from '@/features/assistWorkflow/saveTaskResultsBatch';
import type { AssistExecutionContext } from '@/features/assistWorkflow/types';

const DEBOUNCE_MS = 450;

type DraftEntry = {
  status: ExtendedAssignmentTaskStatus;
  note?: string;
  revision: number;
};

type DraftMap = Record<string, DraftEntry>;
type DraftScope = {
  pending: DraftMap;
  revision: number;
  flushing: Promise<boolean> | null;
  flushAgain: boolean;
  timer: ReturnType<typeof setTimeout> | null;
};

function taskDraftStorageKey(ctx: AssistExecutionContext): string {
  return `employee-execution-task-drafts:${ctx.tenantId}:${ctx.employeeId}:${ctx.assignmentId}`;
}

function parseDrafts(raw: string | null): DraftMap {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as DraftMap;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter(
        ([taskId, draft]) =>
          Boolean(taskId) &&
          Boolean(draft) &&
          typeof draft === 'object' &&
          typeof draft.status === 'string' &&
          Number.isFinite(draft.revision),
      ),
    );
  } catch {
    return {};
  }
}

export function useTaskResultDrafts(
  serverTasks: EmployeePortalTaskItem[],
  executionContext: AssistExecutionContext | null,
  onContextSynced: (ctx: AssistExecutionContext) => void,
  datasetKey?: string,
) {
  const scopeKey = datasetKey ?? (executionContext ? taskDraftStorageKey(executionContext) : null);
  const scope = useMemo<DraftScope>(() => ({ pending: {}, revision: 0,
    flushing: null, flushAgain: false, timer: null }), [scopeKey]);
  const activeScope = useRef(scope);
  activeScope.current = scope;
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const [draftState, setDraftState] = useState<{ scope: DraftScope; value: DraftMap }>({ scope, value: {} });
  const [saveState, setSaveState] = useState<{ scope: DraftScope; saving: boolean; error: string | null }>({ scope, saving: false, error: null });
  const drafts = draftState.scope === scope ? draftState.value : {};
  const saving = saveState.scope === scope && saveState.saving;
  const saveError = saveState.scope === scope ? saveState.error : null;
  const flushRef = useRef<() => Promise<boolean>>(async () => true);
  const storageKey = executionContext ? taskDraftStorageKey(executionContext) : null;

  const persistPending = useCallback(async (pending: DraftMap) => {
    if (!storageKey) return;
    try {
      if (Object.keys(pending).length === 0) await AsyncStorage.removeItem(storageKey);
      else await AsyncStorage.setItem(storageKey, JSON.stringify(pending));
    } catch {
      /* the in-memory draft remains available until the next retry */
    }
  }, [storageKey]);

  const flush = useCallback(async () => {
    if (activeScope.current !== scope || !mounted.current) return false;
    if (scope.flushing) {
      scope.flushAgain = true;
      const saved = await scope.flushing;
      if (!saved || activeScope.current !== scope || !mounted.current) return false;
      return flushRef.current();
    }

    const ctx = executionContext;
    const pending = { ...scope.pending };
    if (Object.keys(pending).length === 0) return true;
    if (!ctx) return false;

    const updates: TaskResultBatchItem[] = Object.entries(pending).map(([taskId, d]) => ({
      taskId,
      status: d.status,
      completionNote: d.note,
    }));

    setSaveState({ scope, saving: true, error: null });
    const current = () => mounted.current && activeScope.current === scope;
    const write = (async () => {
    try {
      const result = await saveTaskResultsBatch({ ctx, updates });

      if (!result.ok) {
        if (current()) setSaveState({ scope, saving: true, error: result.error ?? 'Aufgaben konnten nicht gespeichert werden.' });
        await persistPending(scope.pending);
        return false;
      } else {
        for (const [taskId, savedDraft] of Object.entries(pending)) {
          if (scope.pending[taskId]?.revision === savedDraft.revision) {
            delete scope.pending[taskId];
          }
        }
        if (current()) setDraftState({ scope, value: { ...scope.pending } });
        await persistPending(scope.pending);
        if (current()) onContextSynced(result.data);
        return Object.keys(scope.pending).length === 0;
      }
    } catch {
      if (current()) setSaveState({ scope, saving: true, error: 'Aufgaben konnten nicht gespeichert werden. Die Auswahl bleibt erhalten.' });
      await persistPending(scope.pending);
      return false;
    } finally {
      scope.flushing = null;
      if (current()) setSaveState((previous) => previous.scope === scope
        ? { ...previous, saving: false } : previous);

      if (scope.flushAgain && current()) {
        scope.flushAgain = false;
        if (scope.timer) clearTimeout(scope.timer);
        scope.timer = setTimeout(() => {
          scope.timer = null;
          void flushRef.current();
        }, DEBOUNCE_MS);
      }
    }
    })();
    scope.flushing = write;
    return write;
  }, [executionContext, onContextSynced, persistPending, scope]);

  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  const scheduleFlush = useCallback(() => {
    if (activeScope.current !== scope || !mounted.current) return;
    if (scope.timer) clearTimeout(scope.timer);
    scope.timer = setTimeout(() => {
      scope.timer = null;
      void flushRef.current();
    }, DEBOUNCE_MS);
  }, [scope]);

  useEffect(() => {
    if (!storageKey) return;
    let cancelled = false;
    void AsyncStorage.getItem(storageKey).then((raw) => {
      if (cancelled || activeScope.current !== scope || !mounted.current) return;
      const restored = parseDrafts(raw);
      if (Object.keys(restored).length === 0) return;
      const merged = { ...scope.pending };
      for (const [taskId, entry] of Object.entries(restored)) {
        if (!merged[taskId] || entry.revision > merged[taskId].revision) {
          merged[taskId] = entry;
        }
      }
      scope.pending = merged;
      scope.revision = Math.max(scope.revision, ...Object.values(merged).map((entry) => entry.revision));
      setDraftState({ scope, value: { ...merged } });
      scheduleFlush();
    }).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [storageKey, scheduleFlush, scope]);

  useEffect(() => {
    return () => {
      if (scope.timer) clearTimeout(scope.timer);
    };
  }, [scope]);

  const updateTask = useCallback(
    (taskId: string, status: ExtendedAssignmentTaskStatus, note?: string) => {
      if (activeScope.current !== scope || !mounted.current) return { ok: false as const };
      const entry: DraftEntry = {
        status,
        note: note?.trim() || undefined,
        revision: ++scope.revision,
      };
      scope.pending[taskId] = entry;
      setDraftState({ scope, value: { ...scope.pending } });
      void persistPending(scope.pending);
      scheduleFlush();
      return { ok: true as const };
    },
    [persistPending, scheduleFlush, scope],
  );

  const optimisticTasks = useMemo(() => {
    return serverTasks.map((task) => {
      const draft = drafts[task.id];
      if (!draft) return task;
      return {
        ...task,
        status: draft.status,
        completionNote: draft.note ?? task.completionNote,
      };
    });
  }, [serverTasks, drafts]);

  return {
    tasks: optimisticTasks,
    saving,
    saveError,
    updateTask,
    flush,
    hasPending: Object.keys(drafts).length > 0,
  };
}

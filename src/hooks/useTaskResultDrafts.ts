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
) {
  const [drafts, setDrafts] = useState<DraftMap>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const pendingRef = useRef<DraftMap>({});
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revisionRef = useRef(0);
  const flushingRef = useRef(false);
  const flushAgainRef = useRef(false);
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
    if (flushingRef.current) {
      flushAgainRef.current = true;
      return false;
    }

    const ctx = executionContext;
    const pending = { ...pendingRef.current };
    if (Object.keys(pending).length === 0) return true;
    if (!ctx) return false;

    const updates: TaskResultBatchItem[] = Object.entries(pending).map(([taskId, d]) => ({
      taskId,
      status: d.status,
      completionNote: d.note,
    }));

    flushingRef.current = true;
    setSaving(true);
    try {
      const result = await saveTaskResultsBatch({ ctx, updates });

      if (!result.ok) {
        setSaveError(result.error ?? 'Aufgaben konnten nicht gespeichert werden.');
        await persistPending(pendingRef.current);
        return false;
      } else {
        for (const [taskId, savedDraft] of Object.entries(pending)) {
          if (pendingRef.current[taskId]?.revision === savedDraft.revision) {
            delete pendingRef.current[taskId];
          }
        }
        setDrafts((prev) => {
          const next = { ...prev };
          for (const [taskId, savedDraft] of Object.entries(pending)) {
            if (next[taskId]?.revision === savedDraft.revision) {
              delete next[taskId];
            }
          }
          return next;
        });
        setSaveError(null);
        await persistPending(pendingRef.current);
        onContextSynced(result.data);
        return Object.keys(pendingRef.current).length === 0;
      }
    } catch {
      setSaveError('Aufgaben konnten nicht gespeichert werden. Die Auswahl bleibt erhalten.');
      await persistPending(pendingRef.current);
      return false;
    } finally {
      flushingRef.current = false;
      setSaving(false);

      if (flushAgainRef.current) {
        flushAgainRef.current = false;
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          timerRef.current = null;
          void flushRef.current();
        }, DEBOUNCE_MS);
      }
    }
  }, [executionContext, onContextSynced, persistPending]);

  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  const scheduleFlush = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      void flushRef.current();
    }, DEBOUNCE_MS);
  }, []);

  useEffect(() => {
    if (!storageKey) return;
    let cancelled = false;
    void AsyncStorage.getItem(storageKey).then((raw) => {
      if (cancelled) return;
      const restored = parseDrafts(raw);
      if (Object.keys(restored).length === 0) return;
      const merged = { ...pendingRef.current };
      for (const [taskId, entry] of Object.entries(restored)) {
        if (!merged[taskId] || entry.revision > merged[taskId].revision) {
          merged[taskId] = entry;
        }
      }
      pendingRef.current = merged;
      setDrafts((current) => ({ ...current, ...merged }));
      scheduleFlush();
    }).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [storageKey, scheduleFlush]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const updateTask = useCallback(
    (taskId: string, status: ExtendedAssignmentTaskStatus, note?: string) => {
      const entry: DraftEntry = {
        status,
        note: note?.trim() || undefined,
        revision: ++revisionRef.current,
      };
      pendingRef.current[taskId] = entry;
      setDrafts((prev) => ({ ...prev, [taskId]: entry }));
      void persistPending(pendingRef.current);
      scheduleFlush();
      return { ok: true as const };
    },
    [persistPending, scheduleFlush],
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

/**
 * ASSIST.WORKFLOW.3 — Optimistic task drafts with debounced batch save.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  const flushRef = useRef<() => Promise<void>>(async () => {});

  const flush = useCallback(async () => {
    if (flushingRef.current) {
      flushAgainRef.current = true;
      return;
    }

    const ctx = executionContext;
    const pending = { ...pendingRef.current };
    if (!ctx || Object.keys(pending).length === 0) return;

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
        onContextSynced(result.data);
      }
    } catch {
      setSaveError('Aufgaben konnten nicht gespeichert werden. Die Auswahl bleibt erhalten.');
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
  }, [executionContext, onContextSynced]);

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
      scheduleFlush();
      return { ok: true as const };
    },
    [scheduleFlush],
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
  };
}

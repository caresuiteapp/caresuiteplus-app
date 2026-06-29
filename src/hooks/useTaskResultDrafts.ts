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

type DraftMap = Record<string, { status: ExtendedAssignmentTaskStatus; note?: string }>;

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

  const flush = useCallback(async () => {
    const ctx = executionContext;
    const pending = { ...pendingRef.current };
    if (!ctx || Object.keys(pending).length === 0) return;

    const updates: TaskResultBatchItem[] = Object.entries(pending).map(([taskId, d]) => ({
      taskId,
      status: d.status,
      completionNote: d.note,
    }));

    setSaving(true);
    const result = await saveTaskResultsBatch({ ctx, updates });
    setSaving(false);

    if (!result.ok) {
      setSaveError(result.error ?? 'Aufgaben konnten nicht gespeichert werden.');
      return;
    }

    for (const taskId of Object.keys(pending)) {
      delete pendingRef.current[taskId];
    }
    setDrafts((prev) => {
      const next = { ...prev };
      for (const taskId of Object.keys(pending)) {
        delete next[taskId];
      }
      return next;
    });
    setSaveError(null);
    onContextSynced(result.data);
  }, [executionContext, onContextSynced]);

  const scheduleFlush = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      void flush();
    }, DEBOUNCE_MS);
  }, [flush]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const updateTask = useCallback(
    (taskId: string, status: ExtendedAssignmentTaskStatus, note?: string) => {
      const entry = { status, note: note?.trim() || undefined };
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

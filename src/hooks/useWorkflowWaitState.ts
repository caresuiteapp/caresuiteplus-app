import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

export const WORKFLOW_BLOCKING_FEEDBACK_LIMIT_MS = 20_000;

/** Release blocking feedback, never the write lock or the confirmation requirement. */
export function useWorkflowWaitState(pending: boolean, scopeKey: string): boolean {
  const [stalledScope, setStalledScope] = useState<string | null>(null);

  useEffect(() => {
    setStalledScope(null);
    if (!pending) return;

    const deadline = Date.now() + WORKFLOW_BLOCKING_FEEDBACK_LIMIT_MS;
    let active = true;
    const checkDeadline = () => {
      if (active && Date.now() >= deadline) setStalledScope(scopeKey);
    };
    const timer = setTimeout(checkDeadline, WORKFLOW_BLOCKING_FEEDBACK_LIMIT_MS);
    // Mobile/browser background timers can be suspended. Check elapsed wall time
    // immediately when returning to the visit, rather than starting another wait.
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') checkDeadline();
    });
    const onVisible = () => {
      if (!document.hidden) checkDeadline();
    };
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisible);

    return () => {
      active = false;
      clearTimeout(timer);
      subscription.remove();
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisible);
    };
  }, [pending, scopeKey]);

  return pending && stalledScope === scopeKey;
}

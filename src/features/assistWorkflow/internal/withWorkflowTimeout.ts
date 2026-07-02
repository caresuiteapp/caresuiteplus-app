/** ASSIST.STABILIZE.2 — bounded wait for portal workflow mutations. */
export const WORKFLOW_ACTION_TIMEOUT_MS = 20_000;
export const WORKFLOW_MARK_ARRIVED_TIMEOUT_MS = 30_000;
export const WORKFLOW_END_SERVICE_TIMEOUT_MS = 30_000;
export const WORKFLOW_START_SERVICE_TIMEOUT_MS = 30_000;
export const WORKFLOW_CONTEXT_REFRESH_TIMEOUT_MS = 30_000;

export class WorkflowActionTimeoutError extends Error {
  constructor(label: string, ms: number) {
    super(`${label} timeout after ${ms}ms`);
    this.name = 'WorkflowActionTimeoutError';
  }
}

export function withWorkflowTimeout<T>(
  promise: Promise<T>,
  ms: number = WORKFLOW_ACTION_TIMEOUT_MS,
  label = 'workflow',
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new WorkflowActionTimeoutError(label, ms));
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

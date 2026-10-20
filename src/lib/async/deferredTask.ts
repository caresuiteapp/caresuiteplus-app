type DeferredTask = () => Promise<unknown>;

const MAX_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [150, 450];

const running = new Map<string, Promise<void>>();
const queued = new Map<string, DeferredTask>();

async function drain(key: string, firstTask: DeferredTask): Promise<void> {
  let task: DeferredTask | undefined = firstTask;
  while (task) {
    let completed = false;
    let lastError: unknown;
    for (let attempt = 0; attempt < MAX_ATTEMPTS && !completed; attempt += 1) {
      try {
        await task();
        completed = true;
      } catch (error) {
        lastError = error;
        const delay = RETRY_DELAYS_MS[attempt];
        if (delay) {
          await new Promise<void>((resolve) => setTimeout(resolve, delay));
        }
      }
    }
    if (!completed) {
      console.warn(`[deferredTask] ${key} konnte nach ${MAX_ATTEMPTS} Versuchen nicht abgeglichen werden.`, lastError);
    }
    task = queued.get(key);
    queued.delete(key);
  }
}

/**
 * Runs a derived projection outside the employee-facing critical path.
 * Repeated jobs with the same key are coalesced; the newest job runs once more
 * after the active one. Callers must persist their canonical business record
 * before scheduling work here.
 */
export function scheduleDeferredTask(key: string, task: DeferredTask): void {
  if (running.has(key)) {
    queued.set(key, task);
    return;
  }

  const promise = drain(key, task).finally(() => {
    running.delete(key);
    const next = queued.get(key);
    queued.delete(key);
    if (next) scheduleDeferredTask(key, next);
  });
  running.set(key, promise);
}

/** Test/diagnostic hook; production UI never waits for derived projections. */
export async function flushDeferredTasks(): Promise<void> {
  while (running.size > 0) {
    await Promise.all([...running.values()]);
  }
}

/**
 * Gives an already-running projection a short chance to finish without ever
 * extending the employee-facing latency budget indefinitely.
 */
export async function waitForDeferredTask(key: string, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + Math.max(0, timeoutMs);
  while (Date.now() < deadline) {
    const active = running.get(key);
    if (!active) return true;
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    const completed = await Promise.race([
      active.then(() => true),
      new Promise<false>((resolve) => setTimeout(() => resolve(false), remaining)),
    ]);
    if (!completed) return false;
  }
  return !running.has(key);
}

export function resetDeferredTasksForTests(): void {
  running.clear();
  queued.clear();
}

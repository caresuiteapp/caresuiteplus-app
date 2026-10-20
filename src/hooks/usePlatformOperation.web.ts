import { useCallback, useEffect, useRef, useState } from 'react';
import { useUnsavedWebChanges } from './useUnsavedWebChanges.web';

export function usePlatformOperation() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useUnsavedWebChanges(false, busy);
  const report = useCallback((cause: unknown) => {
    if (alive.current) setError(cause instanceof Error ? cause.message : typeof cause === 'string' ? cause : 'Die Änderung konnte nicht gespeichert werden. Bitte erneut versuchen.');
  }, []);
  const clear = useCallback(() => { if (alive.current) setError(null); }, []);
  const run = useCallback(async (action: () => Promise<unknown>): Promise<boolean> => {
    if (lock.current) return false;
    lock.current = true; setBusy(true); setError(null);
    try { await action(); return alive.current; }
    catch (cause) { report(cause); return false; }
    finally { lock.current = false; if (alive.current) setBusy(false); }
  }, [report]);
  return { busy, error, report, clear, run };
}

export async function requirePlatformResult<T>(operation: Promise<{ ok: true; data: T } | { ok: false; error: string }>): Promise<T> {
  const result = await operation;
  if (!result.ok) throw new Error(result.error);
  return result.data;
}

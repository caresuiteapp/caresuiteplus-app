import { useCallback, useEffect, useRef } from 'react';
import { useNavigation } from 'expo-router';
import { usePreventRemove } from '@/hooks/useNativePreventRemove.native';
import { confirmNativeWorkspaceAction } from '@/lib/platform/nativeWorkspaceActions.native';

export type CaptureWebLeave = () => (() => boolean) | null;

/** Native confirmation retains the same original owner/phase guard as Web. */
export function useUnsavedWebChanges(dirty: boolean, busy = false, message = 'Ihre Eingaben sind noch nicht gespeichert. Möchten Sie die Bearbeitung verwerfen und die Seite verlassen?', captureLeave?: CaptureWebLeave) {
  const navigation = useNavigation(), confirming = useRef(false), alive = useRef(true);
  const latest = useRef({ dirty, busy, message, captureLeave, navigation });
  latest.current = { dirty, busy, message, captureLeave, navigation };
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const prepareLeave = useCallback(async (): Promise<(() => boolean) | null> => {
    const before = latest.current;
    if (!alive.current || before.busy || confirming.current) return null;
    let own: (() => boolean) | null = null;
    try { own = before.captureLeave ? before.captureLeave() : () => true; } catch { return null; }
    if (!own) return null;
    const current = () => {
      const now = latest.current;
      try {
        return alive.current && !now.busy && now.dirty === before.dirty && now.message === before.message
          && now.navigation === before.navigation && Boolean(now.captureLeave) === Boolean(before.captureLeave) && own!() === true;
      } catch { return false; }
    };
    if (!current()) return null;
    if (!before.dirty) return current;
    confirming.current = true;
    try {
      const accepted = await confirmNativeWorkspaceAction(before.message);
      return accepted && current() ? current : null;
    } catch { return null; }
    finally { confirming.current = false; }
  }, []);
  const confirmLeave = useCallback(async () => { const check = await prepareLeave(); return !!check && check(); }, [prepareLeave]);
  usePreventRemove(dirty || busy, ({ data }) => {
    void prepareLeave().then(check => { if (check && check()) navigation.dispatch(data.action); });
  });
  return confirmLeave;
}

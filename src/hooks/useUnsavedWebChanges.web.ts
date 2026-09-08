import { useCallback, useEffect, useRef } from 'react';
import { useNavigation } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { confirmAction } from '@/lib/platform/confirmAction';

/** Protect real route removal, browser reload and local tab changes without storing form data. */
export function useUnsavedWebChanges(dirty: boolean, busy = false, message = 'Ihre Eingaben sind noch nicht gespeichert. Möchten Sie die Bearbeitung verwerfen und die Seite verlassen?') {
  const navigation = useNavigation();
  const confirming = useRef(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const confirmLeave = useCallback(async () => {
    if (busy || confirming.current) return false;
    if (!dirty) return true;
    confirming.current = true;
    try {
      const accepted = await confirmAction({ title: 'Ungespeicherte Eingaben', message, confirmLabel: 'Eingaben verwerfen', cancelLabel: 'Weiter bearbeiten' });
      return alive.current && accepted;
    } finally { confirming.current = false; }
  }, [busy, dirty, message]);
  usePreventRemove(dirty || busy, ({ data }) => {
    void confirmLeave().then(accepted => { if (accepted && alive.current) navigation.dispatch(data.action); });
  });
  useEffect(() => {
    if ((!dirty && !busy) || typeof window === 'undefined') return;
    const unload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', unload);
    return () => window.removeEventListener('beforeunload', unload);
  }, [dirty, busy]);
  return confirmLeave;
}

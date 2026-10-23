import { useCallback, useEffect, useRef } from 'react';
import { useIsFocused, useNavigation, usePathname } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { WEB_PAGE_LEAVE_EVENT } from '@/lib/navigation/webPageLeaveGuard.web';

/** Reuses the workspace's existing Back/Close veto event. */
export function useGkvUnsavedChanges(dirty: boolean, busy: boolean) {
  const focused = useIsFocused();
  const navigation = useNavigation();
  const pathname = usePathname();
  const state = useRef({ dirty, busy });
  state.current = { dirty, busy };
  const allowed = useRef(false);
  useEffect(() => { allowed.current = false; }, [dirty, pathname]);
  const confirmLeave = useCallback(() => {
    if (state.current.busy) return false;
    const accepted = !state.current.dirty || window.confirm('Ihre Änderungen an der Pflegekassen-Abrechnung sind noch nicht gespeichert. Möchten Sie die Seite ohne Speichern verlassen?');
    if (accepted) allowed.current = true;
    return accepted;
  }, []);
  usePreventRemove(focused && (dirty || busy), ({ data }) => {
    if (allowed.current || confirmLeave()) {
      allowed.current = false;
      navigation.dispatch(data.action);
    }
  });
  useEffect(() => {
    if (!focused || typeof window === 'undefined') return;
    const onLeave = (event: Event) => { if (!confirmLeave()) event.preventDefault(); };
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (allowed.current || (!state.current.dirty && !state.current.busy)) return;
      event.preventDefault(); event.returnValue = '';
    };
    window.addEventListener(WEB_PAGE_LEAVE_EVENT, onLeave);
    window.addEventListener('beforeunload', beforeUnload);
    return () => { window.removeEventListener(WEB_PAGE_LEAVE_EVENT, onLeave); window.removeEventListener('beforeunload', beforeUnload); };
  }, [confirmLeave, focused]);
  return { confirmLeave };
}

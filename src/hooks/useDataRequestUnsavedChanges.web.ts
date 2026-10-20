import { useCallback, useEffect, useRef } from 'react';
import { useNavigation, usePathname } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { WEB_PAGE_LEAVE_EVENT } from '@/lib/navigation/webPageLeaveGuard.web';

/** Protect only the active data-request form, including the Desktop popup controls. */
export function useDataRequestUnsavedChanges(dirty: boolean, busy: boolean) {
  const navigation = useNavigation();
  const pathname = usePathname();
  const current = useRef({ dirty, busy });
  current.current = { dirty, busy };
  const allowRemoval = useRef(false);

  useEffect(() => { allowRemoval.current = false; }, [dirty, pathname]);

  const confirmLeave = useCallback(() => {
    if (current.current.busy) return false;
    if (allowRemoval.current) return true;
    const accepted = !current.current.dirty || window.confirm(
      'Der Eingang Ihrer Anfrage ist noch nicht bestätigt. Möchten Sie die Seite verlassen und den Entwurf verwerfen?',
    );
    if (accepted) allowRemoval.current = true;
    return accepted;
  }, []);

  usePreventRemove(dirty || busy, ({ data }) => {
    if (allowRemoval.current || confirmLeave()) {
      allowRemoval.current = false;
      navigation.dispatch(data.action);
    }
  });

  useEffect(() => {
    if (typeof window === 'undefined' || pathname !== '/settings/data-request') return;
    const onLeave = (event: Event) => {
      if (!confirmLeave()) event.preventDefault();
    };
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (allowRemoval.current || (!current.current.dirty && !current.current.busy)) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener(WEB_PAGE_LEAVE_EVENT, onLeave);
    window.addEventListener('beforeunload', beforeUnload);
    return () => {
      window.removeEventListener(WEB_PAGE_LEAVE_EVENT, onLeave);
      window.removeEventListener('beforeunload', beforeUnload);
    };
  }, [confirmLeave, pathname]);

  return { confirmLeave };
}

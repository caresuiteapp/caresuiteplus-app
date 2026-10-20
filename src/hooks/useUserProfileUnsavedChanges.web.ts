import { useCallback, useEffect, useRef } from 'react';
import { useNavigation, usePathname } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { WEB_PAGE_LEAVE_EVENT } from '@/lib/navigation/webPageLeaveGuard.web';

/** Protect the profile form, including the web workspace's own close/back controls. */
export function useUserProfileUnsavedChanges(dirty: boolean, busy: boolean) {
  const navigation = useNavigation();
  const pathname = usePathname();
  const current = useRef({ dirty, busy });
  current.current = { dirty, busy };
  const allowRemoval = useRef(false);

  useEffect(() => { allowRemoval.current = false; }, [dirty, pathname]);

  const confirmLeave = useCallback(() => {
    if (current.current.busy) return false;
    const accepted = !current.current.dirty || window.confirm(
      'Ihre Änderungen am Profil oder Profilbild sind noch nicht gespeichert. Möchten Sie die Seite ohne Speichern verlassen?',
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
    if (typeof window === 'undefined' || pathname !== '/settings/profile') return;
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

  const releaseAfterConfirmation = useCallback(() => { allowRemoval.current = true; }, []);
  const restoreProtection = useCallback(() => { allowRemoval.current = false; }, []);
  return { confirmLeave, releaseAfterConfirmation, restoreProtection };
}

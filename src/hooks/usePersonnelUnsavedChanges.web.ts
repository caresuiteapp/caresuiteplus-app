import { createContext, useCallback, useContext, useEffect, useRef } from 'react';
import { useNavigation } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';

export const PersonnelLeaveGuardContext = createContext<((guard: (() => boolean) | null) => void) | null>(null);

export function usePersonnelUnsavedChanges(dirty: boolean, busy = false) {
  const navigation = useNavigation();
  const registerDialogGuard = useContext(PersonnelLeaveGuardContext);
  const allowRemoval = useRef(false);
  useEffect(() => { allowRemoval.current = false; }, [dirty]);
  const confirmLeave = useCallback(() => {
    if (busy) return false;
    const accepted = !dirty || window.confirm('Nicht gespeicherte Angaben verwerfen?');
    if (accepted) allowRemoval.current = true;
    return accepted;
  }, [dirty, busy]);
  useEffect(() => {
    registerDialogGuard?.(confirmLeave);
    return () => registerDialogGuard?.(null);
  }, [confirmLeave, registerDialogGuard]);
  usePreventRemove(dirty || busy, ({ data }) => {
    if (allowRemoval.current || confirmLeave()) {
      allowRemoval.current = false;
      navigation.dispatch(data.action);
    }
  });
  useEffect(() => {
    if (!dirty && !busy) return;
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [dirty, busy]);
  const releaseAfterSave = useCallback(() => { allowRemoval.current = true; }, []);
  return { confirmLeave, releaseAfterSave };
}

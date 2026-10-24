// Generated native presentation from src/hooks/usePersonnelUnsavedChanges.web.ts. Update through scripts/port-native-workspaces.mjs.
import {useNativeWorkflowWindow} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {nativeWindow as window} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {confirmNativeWorkspaceAction,runNativeWorkspaceEffect} from '@/lib/platform/nativeWorkspaceActions.native';
import { createContext, useCallback, useContext, useEffect, useRef } from 'react';
import { useNavigation } from 'expo-router';
import { usePreventRemove } from "@/hooks/useNativePreventRemove.native";
export const PersonnelLeaveGuardContext = createContext<((guard: (() => boolean | Promise<boolean>) | null) => void) | null>(null);
export function usePersonnelUnsavedChanges(dirty: boolean, busy = false) {
    const window = useNativeWorkflowWindow();
    const navigation = useNavigation();
    const registerDialogGuard = useContext(PersonnelLeaveGuardContext);
    const allowRemoval = useRef(false);
    useEffect(() => { allowRemoval.current = false; }, [dirty]);
    const confirmLeave = useCallback(async () => {
        if (busy)
            return false;
        const accepted = !dirty || await confirmNativeWorkspaceAction('Nicht gespeicherte Angaben verwerfen?');
        if (accepted)
            allowRemoval.current = true;
        return accepted;
    }, [dirty, busy]);
    useEffect(() => runNativeWorkspaceEffect(async (confirmNativeWorkspaceAction) => {
        await registerDialogGuard?.(confirmLeave);
        return async () => await registerDialogGuard?.(null);
    }), [confirmLeave, registerDialogGuard]);
    usePreventRemove(dirty || busy, async ({ data }) => {
        if (allowRemoval.current || await confirmLeave()) {
            allowRemoval.current = false;
            navigation.dispatch(data.action);
        }
    });
    useEffect(() => {
        if (!dirty && !busy)
            return;
        const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
        window.addEventListener('beforeunload', beforeUnload);
        return () => window.removeEventListener('beforeunload', beforeUnload);
    }, [dirty, busy]);
    const releaseAfterSave = useCallback(() => { allowRemoval.current = true; }, []);
    return { confirmLeave, releaseAfterSave };
}

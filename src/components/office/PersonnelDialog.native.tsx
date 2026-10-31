// Generated native presentation from src/components/office/PersonnelDialog.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {nativeDocument as document} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {NativeStyle,NativeDialog,NativeHeader,NativeDiv,NativeSmall,NativeStrong,NativeButton,NativeWorkspaceStyleScope} from '@/components/layout/NativeWorkspaceElements.native';
import {confirmNativeWorkspaceAction,runNativeWorkspaceEffect} from '@/lib/platform/nativeWorkspaceActions.native';
import { useCallback, useEffect, useId, useRef, type ReactNode } from 'react';
import { PersonnelLeaveGuardContext } from "../../hooks/usePersonnelUnsavedChanges.native.ts";
import { PersonnelIcon } from "./PersonnelPrimitives.native.tsx";
import { personnelCss } from "./personnelCss.native.ts";
/** Native dialog provides focus trapping and restores focus without changing body styles. */
export function PersonnelDialog({ visible, title, form = false, onClose, children }: {
    visible: boolean;
    title: string;
    form?: boolean;
    onClose: () => void;
    children: ReactNode;
}) {
    const ref = useRef<HTMLDialogElement>(null);
    const id = useId();
    const leaveGuard = useRef<(() => boolean | Promise<boolean>) | null>(null);
    const registerGuard = useCallback((guard: (() => boolean | Promise<boolean>) | null) => { leaveGuard.current = guard; }, []);
    useEffect(() => {
        const dialog = ref.current;
        if (!dialog || !visible)
            return;
        dialog.showModal();
        return () => {
            if (dialog.open)
                dialog.close();
        };
    }, [visible]);
    async function close() {
        if (ref.current?.querySelector('form[aria-busy="true"]'))
            return;
        if (leaveGuard.current && !await leaveGuard.current())
            return;
        onClose();
    }
    if (!visible || typeof document === 'undefined')
        return null;
    return <NativeWorkspaceStyleScope css={[personnelCss, personnelCss]}>{<PersonnelLeaveGuardContext.Provider value={registerGuard}><NativeStyle>{personnelCss}</NativeStyle><NativeDialog ref={ref} className={`pe-dialog${form ? ' pe-dialog--form' : ''}`} aria-labelledby={id} onCancel={async (event) => { event.preventDefault(); await close(); }}><NativeHeader className="pe-dialog-header"><NativeDiv><NativeSmall>CARESUITE HEALTHOS · PERSONAL</NativeSmall><NativeStrong id={id}>{title}</NativeStrong></NativeDiv><NativeButton type="button" onClick={close} aria-label={`${title} schließen`}><PersonnelIcon name="close"/></NativeButton></NativeHeader><NativeDiv className="pe-dialog-body">{children}</NativeDiv></NativeDialog></PersonnelLeaveGuardContext.Provider>}</NativeWorkspaceStyleScope>;
}

// Generated native presentation from src/features/akademie/AcademyDialog.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeDialog,NativeDiv,NativeH2,NativeButton} from '@/components/layout/NativeWorkspaceElements.native';
import { useEffect, useId, useRef, type ReactNode } from 'react';
export function AcademyDialog({ title, children, busy = false, onClose }: {
    title: string;
    children: ReactNode;
    busy?: boolean;
    onClose: () => void;
}) {
    const ref = useRef<HTMLDialogElement>(null);
    const titleId = useId();
    useEffect(() => {
        const dialog = ref.current;
        dialog?.showModal?.();
        return () => dialog?.close?.();
    }, []);
    return <NativeDialog ref={ref} className="ac-dialog" aria-labelledby={titleId} onCancel={event => { event.preventDefault(); if (!busy)
        onClose(); }}>
    <NativeDiv className="ac-dialog-head"><NativeH2 id={titleId} className="ac-section-title">{title}</NativeH2><NativeButton type="button" className="ac-button subtle" disabled={busy} onClick={onClose}>Schließen</NativeButton></NativeDiv>
    <NativeDiv className="ac-dialog-body">{children}</NativeDiv>
  </NativeDialog>;
}

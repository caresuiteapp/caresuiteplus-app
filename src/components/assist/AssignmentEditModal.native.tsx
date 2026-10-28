// Generated native presentation from src/components/assist/AssignmentEditModal.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {confirmNativeWorkspaceAction,runNativeWorkspaceEffect} from '@/lib/platform/nativeWorkspaceActions.native';
import { useCallback, useRef } from 'react';
import { PlatformModal } from "./AssignmentFormControls.native.tsx";
import { AssignmentEditForm } from "./AssignmentEditForm.native.tsx";
import type { VisitDispositionDetail } from '@/lib/assist/visitTypes';
type AssignmentEditModalProps = {
    visible: boolean;
    visit: VisitDispositionDetail | null;
    onClose: () => void;
    onSaved?: (id: string) => void;
};
export function AssignmentEditModal({ visible, visit, onClose, onSaved }: AssignmentEditModalProps) {
    const guard = useRef<(() => boolean | Promise<boolean>) | null>(null);
    const setGuard = useCallback((next: (() => boolean | Promise<boolean>) | null) => { guard.current = next; }, []);
    if (!visible || !visit)
        return null;
    return <PlatformModal visible title="Einsatz bearbeiten" subtitle={visit.clientName} onClose={async () => { if (!guard.current || await guard.current())
        onClose(); }}><AssignmentEditForm key={visit.id} visitId={visit.id} initialVisit={visit} onGuardChange={setGuard} onCancel={onClose} onSaved={id => { onSaved?.(id); onClose(); }}/></PlatformModal>;
}

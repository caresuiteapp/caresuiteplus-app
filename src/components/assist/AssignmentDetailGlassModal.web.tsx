import { useCallback, useEffect, useState } from 'react';
import { PlatformModal } from '@/components/layout/platform';
import { AssignmentDetailTabsPanel } from '@/components/assist/AssignmentDetailTabsPanel.web';
import { AssignmentEditModal } from '@/components/assist/AssignmentEditModal';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import type { VisitDispositionDetail } from '@/lib/assist/visitTypes';
type Props = {
    visible: boolean;
    assignmentId: string | null;
    title?: string;
    onClose: () => void;
    onDeleted?: () => void;
    onChanged?: () => void;
};
export function AssignmentDetailGlassModal(props: Props) { const tenantId = useServiceTenantId(); const { profile } = useAuth(); if (!props.visible || !props.assignmentId)
    return null; return <DetailModal key={`${tenantId}:${profile?.id}:${props.assignmentId}`} {...props}/>; }
function DetailModal({ assignmentId, title, onClose, onDeleted, onChanged }: Props) {
    const [status, setStatus] = useState({ dirty: false, busy: false });
    const reportStatus = useCallback((dirty: boolean, busy: boolean) => setStatus({ dirty, busy }), []);
    const [full, setFull] = useState(false);
    const [edit, setEdit] = useState<VisitDispositionDetail | null>(null);
    const [refresh, setRefresh] = useState(0);
    useEffect(() => { setFull(false); setEdit(null); }, [assignmentId]);
    if (!assignmentId)
        return null;
    return <><PlatformModal visible={!edit} title={full ? 'Einsatzdetails' : title ?? 'Einsatzvorschau'} subtitle={full ? 'Planung, Durchführung und Nachweis' : 'Die wichtigsten Angaben auf einen Blick'} onClose={() => { if (!status.busy)
        onClose(); }} isDirty={status.dirty} onBack={full ? () => { if (!status.busy)
        setFull(false); } : undefined} surfaceScope="company" maxWidth={full ? 1200 : 1000} maxHeightRatio={.94} bodyStyle={{ padding: 18 }}><AssignmentDetailTabsPanel assignmentId={assignmentId} mode={full ? 'full' : 'preview'} layout="modal" onOpenFullRecord={() => setFull(true)} onEdit={setEdit} refreshTrigger={refresh} onStatusChange={reportStatus} onClose={onClose} onDeleted={() => { onDeleted?.(); onClose(); }}/></PlatformModal><AssignmentEditModal visible={!!edit} visit={edit} onClose={() => setEdit(null)} onSaved={() => { setRefresh(n => n + 1); onChanged?.(); }}/></>;
}

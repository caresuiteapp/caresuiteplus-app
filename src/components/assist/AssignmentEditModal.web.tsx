import { useCallback, useRef } from 'react';
import { PlatformModal } from './AssignmentFormControls.web';
import { AssignmentEditForm } from './AssignmentEditForm.web';
import type { VisitDispositionDetail } from '@/lib/assist/visitTypes';

type AssignmentEditModalProps = { visible: boolean; visit: VisitDispositionDetail | null; onClose: () => void; onSaved?: (id: string) => void; };
export function AssignmentEditModal({visible,visit,onClose,onSaved}:AssignmentEditModalProps) {
  const guard = useRef<(() => boolean) | null>(null);
  const setGuard=useCallback((next:(()=>boolean)|null)=>{guard.current=next;},[]);
  if(!visible||!visit)return null;
  return <PlatformModal visible title="Einsatz bearbeiten" subtitle={visit.clientName} onClose={()=>{if(!guard.current||guard.current())onClose();}}><AssignmentEditForm key={visit.id} visitId={visit.id} initialVisit={visit} onGuardChange={setGuard} onCancel={onClose} onSaved={id=>{onSaved?.(id);onClose();}}/></PlatformModal>;
}

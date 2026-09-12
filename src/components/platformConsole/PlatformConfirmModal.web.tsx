import { useEffect, useRef, useState } from 'react';
import { ConsoleDialog } from './ConsoleWorkspaceUi.web';
import { useUnsavedWebChanges } from '@/hooks/useUnsavedWebChanges.web';

type Props = {
  visible: boolean; title: string; description: string; confirmLabel?: string;
  requireTypedConfirmation?: string; requireReason?: boolean; danger?: boolean;
  loading?: boolean; error?: string | null; onCancel: () => void; onConfirm: (reason: string) => void;
};
export function PlatformConfirmModal({visible,title,description,confirmLabel='Bestätigen',requireTypedConfirmation,requireReason=true,danger=false,loading=false,error,onCancel,onConfirm}:Props){
  const [reason,setReason]=useState('');const [typed,setTyped]=useState('');
  const locked=useRef(false);
  const confirmLeave=useUnsavedWebChanges(visible&&Boolean(reason.trim()||typed.trim()),visible&&loading);
  useEffect(()=>{if(!visible){setReason('');setTyped('');}if(!loading)locked.current=false;},[visible,loading]);
  if(!visible)return null;
  const valid=(!requireReason||reason.trim().length>=5)&&(!requireTypedConfirmation||typed.trim()===requireTypedConfirmation);
  const close=async()=>{if(!loading&&await confirmLeave())onCancel();};
  const submit=()=>{if(locked.current||loading||!valid)return;locked.current=true;onConfirm(reason.trim());};
  return <ConsoleDialog title={title} description={description} busy={loading} onClose={()=>void close()} footer={<div className="cs-actions">
    <button className="cs-btn" disabled={loading} onClick={()=>void close()}>Abbrechen</button>
    <button className={`cs-btn ${danger?'danger':'primary'}`} type="submit" form="platform-confirm-form" disabled={loading||!valid}>{loading?'Wird gespeichert…':confirmLabel}</button>
  </div>}>
    <form id="platform-confirm-form" onSubmit={event=>{event.preventDefault();submit();}} className="cs-panel-body">
      {requireReason&&<label className="cs-field">Begründung *<textarea required minLength={5} value={reason} disabled={loading} onChange={event=>setReason(event.target.value)} placeholder="Anlass und Grundlage dieser Änderung"/></label>}
      {requireTypedConfirmation&&<label className="cs-field">Zur Bestätigung „{requireTypedConfirmation}“ eingeben<input required value={typed} disabled={loading} onChange={event=>setTyped(event.target.value)}/></label>}
      {error&&<p className="cs-notice error" role="alert">{error} Die Eingaben bleiben für die Korrektur erhalten.</p>}
    </form>
  </ConsoleDialog>;
}
